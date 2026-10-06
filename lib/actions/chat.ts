"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { logEvent, userActor } from "@/lib/audit"
import { can, requireUser, type CurrentUser } from "@/lib/auth/dal"
import { isTeamRole } from "@/lib/auth/permissions"
import { channelAudience, directKey, findAccessibleChannel } from "@/lib/chat/access"
import { getMessages, messageInclude, toMessageDTO } from "@/lib/chat/queries"
import { db } from "@/lib/db"
import { deleteStored } from "@/lib/files/storage"
import type { Channel } from "@/lib/generated/prisma/client"
import type { Role } from "@/lib/generated/prisma/enums"
import { notify } from "@/lib/notifications"
import { isOnline, publish } from "@/lib/realtime/bus"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

async function requireChatWriter() {
  const user = await requireUser()
  if (!(await can(user, "chat", "WRITE"))) throw new Error("You don't have permission to send messages.")
  return user
}

function chatLink(user: { role: Role }, channelId: string) {
  return isTeamRole(user.role) ? `/chat/${channelId}` : "/portal/chat"
}

// ─── Messages ───────────────────────────────────────────────────────────────

const sendSchema = z.object({
  channelId: z.string().min(1),
  body: z.string().max(10_000, "Messages can be up to 10,000 characters."),
  fileIds: z.array(z.string()).max(20, "Attach up to 20 files per message."),
})

export async function sendMessage(input: z.input<typeof sendSchema>): Promise<Result> {
  const user = await requireChatWriter()
  const parsed = sendSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid message." }
  const body = parsed.data.body.trim()
  const fileIds = [...new Set(parsed.data.fileIds)]
  if (!body && fileIds.length === 0) return { ok: false, error: "Write a message or attach a file." }

  const channel = await findAccessibleChannel(user, parsed.data.channelId)
  if (!channel) return { ok: false, error: "Conversation not found." }

  // Only the sender's own pending uploads for this channel can be attached.
  if (fileIds.length) {
    const owned = await db.storedFile.count({
      where: { id: { in: fileIds }, uploadedById: user.id, channelId: channel.id, messageId: null },
    })
    if (owned !== fileIds.length) return { ok: false, error: "Some attachments are no longer available. Remove them and try again." }
  }

  const now = new Date()
  const created = await db.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: { channelId: channel.id, authorId: user.id, authorName: user.name, body },
    })
    if (fileIds.length) await tx.storedFile.updateMany({ where: { id: { in: fileIds } }, data: { messageId: message.id } })
    await tx.channel.update({ where: { id: channel.id }, data: { lastMessageAt: now } })
    await tx.channelMember.upsert({
      where: { channelId_userId: { channelId: channel.id, userId: user.id } },
      create: { channelId: channel.id, userId: user.id, lastReadAt: now },
      update: { lastReadAt: now },
    })
    return tx.message.findUniqueOrThrow({ where: { id: message.id }, include: messageInclude })
  })

  const dto = toMessageDTO(created)
  const audience = await channelAudience(channel)
  publish(audience, { type: "message", channelId: channel.id, message: dto })
  await notifyAboutMessage(user, channel, audience, body, fileIds.length)
  return { ok: true }
}

/**
 * Chat notifications go to people who are offline, once per conversation until
 * they read it. Online users already see unread badges live.
 */
async function notifyAboutMessage(
  author: CurrentUser,
  channel: Channel & { client: { name: string } | null },
  audience: string[],
  body: string,
  fileCount: number
) {
  if (channel.kind === "TEAM") return
  const preview = body ? (body.length > 140 ? `${body.slice(0, 140)}…` : body) : fileCount === 1 ? "Sent a file" : `Sent ${fileCount} files`

  let recipients: string[]
  let title: string
  if (channel.kind === "DIRECT") {
    recipients = audience
    title = `${author.name} sent you a message`
  } else if (!isTeamRole(author.role)) {
    // From the client: the people who work with them (or Owners/Admins if nobody does).
    const related = await db.user.findMany({
      where: {
        status: "ACTIVE",
        id: { in: audience },
        OR: [
          { clientsOwned: { some: { id: channel.clientId! } } },
          { projectsOwned: { some: { clientId: channel.clientId!, status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } } } },
          { projectMembership: { some: { project: { clientId: channel.clientId!, status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } } } } },
        ],
      },
      select: { id: true },
    })
    recipients = related.length
      ? related.map((u) => u.id)
      : (await db.user.findMany({ where: { status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] }, id: { in: audience } }, select: { id: true } })).map((u) => u.id)
    title = `${channel.client?.name ?? "A client"}: message from ${author.name}`
  } else {
    // From the team: the client's portal accounts.
    const accounts = await db.user.findMany({
      where: { role: "CLIENT", clientId: channel.clientId!, status: "ACTIVE", id: { in: audience } },
      select: { id: true },
    })
    recipients = accounts.map((a) => a.id)
    title = `New message from Klyron Studio`
  }

  const offline = recipients.filter((id) => id !== author.id && !isOnline(id))
  if (offline.length === 0) return
  const pending = await db.notification.findMany({
    where: { userId: { in: offline }, type: "chat.message", readAt: null, link: { in: [`/chat/${channel.id}`, "/portal/chat"] } },
    select: { userId: true, link: true },
  })
  const recipientsRows = await db.user.findMany({ where: { id: { in: offline } }, select: { id: true, role: true } })
  for (const recipient of recipientsRows) {
    const link = chatLink(recipient, channel.id)
    if (pending.some((p) => p.userId === recipient.id && p.link === link)) continue
    await notify({ userIds: [recipient.id], type: "chat.message", title, body: preview, link, email: "if-offline" })
  }
}

export async function editMessage(messageId: string, body: string): Promise<Result> {
  const user = await requireChatWriter()
  const text = body.trim()
  if (!text) return { ok: false, error: "A message can't be empty. Delete it instead." }
  if (text.length > 10_000) return { ok: false, error: "Messages can be up to 10,000 characters." }
  const message = await db.message.findUnique({ where: { id: messageId } })
  if (!message || message.deletedAt || message.authorId !== user.id) return { ok: false, error: "You can only edit your own messages." }
  const channel = await findAccessibleChannel(user, message.channelId)
  if (!channel) return { ok: false, error: "Conversation not found." }

  const updated = await db.message.update({ where: { id: messageId }, data: { body: text, editedAt: new Date() }, include: messageInclude })
  publish(await channelAudience(channel), { type: "message.update", channelId: channel.id, message: toMessageDTO(updated) })
  return { ok: true }
}

/** Soft-deletes the message and removes its attachments from storage. */
export async function deleteMessage(messageId: string): Promise<Result> {
  const user = await requireUser()
  const message = await db.message.findUnique({ where: { id: messageId }, include: { files: true } })
  if (!message || message.deletedAt) return { ok: false, error: "Message not found." }
  const channel = await findAccessibleChannel(user, message.channelId)
  if (!channel) return { ok: false, error: "Message not found." }
  const isModerator = user.role === "OWNER" || user.role === "ADMIN"
  if (message.authorId !== user.id && !isModerator) return { ok: false, error: "You can only delete your own messages." }

  await db.$transaction([
    db.storedFile.deleteMany({ where: { messageId } }),
    db.message.update({ where: { id: messageId }, data: { deletedAt: new Date(), body: "" } }),
  ])
  await Promise.all(message.files.map((f) => deleteStored(f.storageKey, f.hasThumbnail)))
  if (message.authorId !== user.id) {
    await logEvent({
      actor: userActor(user),
      action: "chat.message.delete",
      entity: { type: "channel", id: channel.id },
      metadata: { author: message.authorName },
    })
  }
  const updated = await db.message.findUniqueOrThrow({ where: { id: messageId }, include: messageInclude })
  publish(await channelAudience(channel), { type: "message.update", channelId: channel.id, message: toMessageDTO(updated) })
  return { ok: true }
}

export async function loadOlderMessages(channelId: string, beforeId: string) {
  const user = await requireUser()
  const channel = await findAccessibleChannel(user, channelId)
  if (!channel) return { messages: [], hasMore: false }
  return getMessages(channel.id, beforeId)
}

export async function markChannelRead(channelId: string) {
  const user = await requireUser()
  const channel = await findAccessibleChannel(user, channelId)
  if (!channel) return
  const now = new Date()
  await db.channelMember.upsert({
    where: { channelId_userId: { channelId, userId: user.id } },
    create: { channelId, userId: user.id, lastReadAt: now },
    update: { lastReadAt: now },
  })
  // Opening the conversation also clears its chat notifications.
  const cleared = await db.notification.updateMany({
    where: { userId: user.id, type: "chat.message", readAt: null, link: chatLink(user, channelId) },
    data: { readAt: now },
  })
  publish([user.id], { type: "read", channelId })
  if (cleared.count) publish([user.id], { type: "notifications.read" })
}

/** Live "is typing" signal. Not stored. */
export async function sendTyping(channelId: string) {
  const user = await requireUser()
  const channel = await findAccessibleChannel(user, channelId)
  if (!channel) return
  const audience = (await channelAudience(channel)).filter((id) => id !== user.id)
  publish(audience, { type: "typing", channelId, userId: user.id, name: user.name })
}

// ─── Channels ───────────────────────────────────────────────────────────────

/** Opens (or creates) a private conversation with one or more teammates. */
export async function openDirectChat(userIds: string[]): Promise<Result<{ channelId: string }>> {
  const user = await requireChatWriter()
  if (!isTeamRole(user.role)) return { ok: false, error: "Direct messages are for the team." }
  const others = [...new Set(userIds)].filter((id) => id !== user.id).slice(0, 8)
  if (others.length === 0) return { ok: false, error: "Choose someone to message." }

  const valid = await db.user.findMany({
    where: { id: { in: others }, status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "MEMBER"] } },
    select: { id: true },
  })
  if (valid.length !== others.length) return { ok: false, error: "Choose active team members." }

  const key = directKey([user.id, ...others])
  const channel = await db.channel.upsert({
    where: { directKey: key },
    create: {
      kind: "DIRECT",
      directKey: key,
      members: { create: [user.id, ...others].map((userId) => ({ userId })) },
    },
    update: {},
  })
  revalidatePath("/chat", "layout")
  return { ok: true, channelId: channel.id }
}

const channelNameSchema = z.string().trim().min(1, "Name the channel.").max(60).regex(/^[\p{L}\p{N} _-]+$/u, "Use letters, numbers, spaces, - and _.")

export async function createTeamChannel(name: string): Promise<Result<{ channelId: string }>> {
  const user = await requireChatWriter()
  if (user.role !== "OWNER" && user.role !== "ADMIN") return { ok: false, error: "Only Owners and Admins can create channels." }
  const parsed = channelNameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name." }
  if (await db.channel.findFirst({ where: { kind: "TEAM", name: parsed.data } })) return { ok: false, error: "A channel with this name exists." }

  const channel = await db.channel.create({ data: { kind: "TEAM", name: parsed.data } })
  await logEvent({ actor: userActor(user), action: "chat.channel.create", entity: { type: "channel", id: channel.id }, metadata: { name: parsed.data } })
  revalidatePath("/chat", "layout")
  return { ok: true, channelId: channel.id }
}
