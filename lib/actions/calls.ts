"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { logEvent, userActor } from "@/lib/audit"
import { can, requireUser } from "@/lib/auth/dal"
import { isTeamRole } from "@/lib/auth/permissions"
import { finishCall } from "@/lib/calls/lifecycle"
import { isCallsConfigured } from "@/lib/calls/livekit"
import { generateCallNotes, isNotesConfigured, refreshCallCards } from "@/lib/calls/notes"
import { callHref, findAccessibleCall } from "@/lib/calls/queries"
import { channelAudience, findAccessibleChannel } from "@/lib/chat/access"
import { messageInclude, toMessageDTO } from "@/lib/chat/queries"
import { db } from "@/lib/db"
import { notify } from "@/lib/notifications"
import { publish } from "@/lib/realtime/bus"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

async function requireCaller() {
  const user = await requireUser()
  if (!(await can(user, "chat", "WRITE"))) throw new Error("You don't have permission to start or join calls.")
  return user
}

/**
 * Starts a call in a conversation, or returns the one already running there,
 * so two people pressing "Call" at once end up in the same room.
 */
export async function startCall(channelId: string): Promise<Result<{ href: string }>> {
  const user = await requireCaller()
  if (!isCallsConfigured()) return { ok: false, error: "Video calls aren't set up yet (LIVEKIT_URL and keys in .env)." }
  const channel = await findAccessibleChannel(user, channelId)
  if (!channel) return { ok: false, error: "Conversation not found." }

  const running = await db.call.findFirst({ where: { channelId, status: "ACTIVE" }, orderBy: { startedAt: "desc" } })
  if (running) return { ok: true, href: callHref(user, running.id) }

  const title =
    channel.kind === "CLIENT"
      ? `Call with ${channel.client?.name ?? "client"}`
      : channel.kind === "TEAM" || channel.kind === "GROUP"
        ? `${channel.kind === "TEAM" ? "#" : ""}${channel.name ?? "team"} call`
        : `Call with ${user.name}`
  const now = new Date()
  const { call, message } = await db.$transaction(async (tx) => {
    const call = await tx.call.create({
      data: { title, channelId, roomName: `call-${randomBytes(12).toString("hex")}`, startedById: user.id },
    })
    const message = await tx.message.create({
      data: { channelId, authorId: user.id, authorName: user.name, body: "Started a call", callId: call.id },
      include: messageInclude,
    })
    await tx.channel.update({ where: { id: channelId }, data: { lastMessageAt: now } })
    return { call, message }
  })

  const audience = await channelAudience(channel)
  publish(audience, { type: "message", channelId, message: toMessageDTO(message) })
  // Ring everyone else in-app; email would arrive after the call is over.
  const others = await db.user.findMany({ where: { id: { in: audience.filter((id) => id !== user.id) } }, select: { id: true, role: true } })
  for (const portal of [false, true]) {
    await notify({
      userIds: others.filter((o) => (o.role === "CLIENT") === portal).map((o) => o.id),
      type: "call.started",
      title: `${user.name} started a call`,
      body: title,
      link: portal ? `/portal/calls/${call.id}` : `/calls/${call.id}`,
      email: "never",
    })
  }
  await logEvent({ actor: userActor(user), action: "call.start", entity: { type: "call", id: call.id }, metadata: { title } })
  return { ok: true, href: callHref(user, call.id) }
}

/** Ends the call for everyone. The starter and Owners/Admins can do this; everyone else just leaves. */
export async function endCall(callId: string): Promise<Result> {
  const user = await requireCaller()
  const access = await findAccessibleCall(user, callId)
  if (!access) return { ok: false, error: "Call not found." }
  const { call } = access
  const allowed = call.startedById === user.id || user.role === "OWNER" || user.role === "ADMIN"
  if (!allowed) return { ok: false, error: "Only the person who started the call or an admin can end it for everyone." }
  await finishCall(callId, userActor(user))
  revalidatePath(`/calls/${callId}`)
  return { ok: true }
}

/** Re-runs the AI notes (after adding a key, or if the first try failed). Team only. */
export async function regenerateNotes(callId: string): Promise<Result> {
  const user = await requireCaller()
  if (!isTeamRole(user.role)) return { ok: false, error: "Only the team can regenerate notes." }
  const access = await findAccessibleCall(user, callId)
  if (!access || access.call.status !== "ENDED") return { ok: false, error: "Notes can be generated once the call has ended." }
  if (!isNotesConfigured()) return { ok: false, error: "Add GROQ_API_KEY to .env first." }
  const segments = await db.transcriptSegment.count({ where: { callId } })
  if (segments === 0) return { ok: false, error: "There's no transcript for this call." }

  await db.call.update({ where: { id: callId }, data: { notesStatus: "PENDING", notesModel: null, notesError: null } })
  await refreshCallCards(callId)
  await generateCallNotes(callId)
  await logEvent({ actor: userActor(user), action: "call.notes.regenerate", entity: { type: "call", id: callId } })
  revalidatePath(`/calls/${callId}`)
  const after = await db.call.findUnique({ where: { id: callId }, select: { notesStatus: true, notesError: true } })
  return after?.notesStatus === "READY" ? { ok: true } : { ok: false, error: after?.notesError ?? "Couldn't generate notes." }
}

const editSchema = z.object({
  summary: z.string().trim().max(4000),
  decisions: z.array(z.string().trim().min(1).max(500)).max(30),
  actionItems: z.array(z.object({ text: z.string().trim().min(1).max(500), owner: z.string().trim().max(120).nullable(), due: z.string().trim().max(60).nullable() })).max(50),
})

/** The team can correct the AI's notes. */
export async function updateNotes(callId: string, input: z.input<typeof editSchema>): Promise<Result> {
  const user = await requireCaller()
  if (!isTeamRole(user.role)) return { ok: false, error: "Only the team can edit notes." }
  const access = await findAccessibleCall(user, callId)
  if (!access) return { ok: false, error: "Call not found." }
  const parsed = editSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the notes." }
  await db.call.update({
    where: { id: callId },
    data: { summary: parsed.data.summary || null, decisions: parsed.data.decisions, actionItems: parsed.data.actionItems, notesStatus: "READY", notesError: null },
  })
  await logEvent({ actor: userActor(user), action: "call.notes.edit", entity: { type: "call", id: callId } })
  await refreshCallCards(callId)
  revalidatePath(`/calls/${callId}`)
  return { ok: true }
}
