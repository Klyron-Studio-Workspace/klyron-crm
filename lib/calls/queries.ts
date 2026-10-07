import "server-only"

import type { CurrentUser } from "@/lib/auth/dal"
import { isTeamRole } from "@/lib/auth/permissions"
import type { ActionItem, CallDetailDTO, CallSummaryDTO } from "@/lib/calls/types"
import { channelScope, findAccessibleChannel } from "@/lib/chat/access"
import { db } from "@/lib/db"
import type { Prisma } from "@/lib/generated/prisma/client"

/** A call is visible to exactly the people who can see its chat conversation. */
export async function findAccessibleCall(user: CurrentUser, callId: string) {
  const call = await db.call.findUnique({ where: { id: callId } })
  if (!call) return null
  const channel = await findAccessibleChannel(user, call.channelId)
  return channel ? { call, channel } : null
}

const include = {
  channel: { include: { client: { select: { name: true } }, members: { include: { user: { select: { id: true, name: true } } } } } },
  startedBy: { select: { name: true } },
  participants: { include: { user: { select: { id: true, name: true } } }, orderBy: { joinedAt: "asc" } },
  _count: { select: { segments: true } },
} satisfies Prisma.CallInclude

type Row = Prisma.CallGetPayload<{ include: typeof include }>

function channelTitle(row: Row, viewerId: string) {
  const c = row.channel
  if (c.kind === "TEAM") return `#${c.name ?? "team"}`
  if (c.kind === "CLIENT") return c.client?.name ?? "Client"
  if (c.kind === "GROUP") return c.name ?? "Group"
  return c.members.filter((m) => m.userId !== viewerId).map((m) => m.user.name).join(", ") || "Direct message"
}

const strings = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [])
const actions = (value: unknown): ActionItem[] =>
  Array.isArray(value)
    ? value
        .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object")
        .map((v) => ({ text: String(v.text ?? ""), owner: typeof v.owner === "string" ? v.owner : null, due: typeof v.due === "string" ? v.due : null }))
        .filter((a) => a.text)
    : []

function toSummary(row: Row, viewerId: string): CallSummaryDTO {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    notesStatus: row.notesStatus,
    channel: { id: row.channelId, kind: row.channel.kind, title: channelTitle(row, viewerId) },
    startedBy: row.startedBy?.name ?? null,
    startedById: row.startedById,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    participants: row.participants.map((p) => p.user),
    summary: row.summary,
    segmentCount: row._count.segments,
  }
}

export async function getCallDetail(user: CurrentUser, callId: string): Promise<CallDetailDTO | null> {
  const access = await findAccessibleCall(user, callId)
  if (!access) return null
  const row = await db.call.findUniqueOrThrow({ where: { id: callId }, include })
  const segments = await db.transcriptSegment.findMany({ where: { callId }, orderBy: { spokenAt: "asc" }, take: 5000 })
  const summary = toSummary(row, user.id)
  return {
    id: summary.id,
    title: summary.title,
    status: summary.status,
    notesStatus: summary.notesStatus,
    channel: summary.channel,
    startedBy: summary.startedBy,
    startedById: summary.startedById,
    startedAt: summary.startedAt,
    endedAt: summary.endedAt,
    participants: summary.participants,
    notes: {
      summary: row.summary,
      decisions: strings(row.decisions),
      actionItems: actions(row.actionItems),
      model: row.notesModel,
      generatedAt: row.notesAt?.toISOString() ?? null,
      error: row.notesError,
    },
    transcript: segments.map((s) => ({ id: s.id, speakerName: s.speakerName, text: s.text, spokenAt: s.spokenAt.toISOString() })),
  }
}

/** Call history across every conversation the user can see. */
export async function getCallHistory(user: CurrentUser, take = 100): Promise<CallSummaryDTO[]> {
  const scope = await channelScope(user)
  if (!scope) return []
  const rows = await db.call.findMany({ where: { channel: scope }, include, orderBy: { startedAt: "desc" }, take })
  return rows.map((r) => toSummary(r, user.id))
}

export function callHref(user: { role: CurrentUser["role"] }, callId: string) {
  return isTeamRole(user.role) ? `/calls/${callId}` : `/portal/calls/${callId}`
}
