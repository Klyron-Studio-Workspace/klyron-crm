import "server-only"

import type { CurrentUser } from "@/lib/auth/dal"
import { isTeamRole } from "@/lib/auth/permissions"
import { channelScope, ensureClientChannel, ensureGeneralChannel } from "@/lib/chat/access"
import type { ChannelSummaryDTO, MessageDTO } from "@/lib/chat/types"
import { plainText } from "@/lib/chat/mentions"
import { db } from "@/lib/db"
import { toFileDTO } from "@/lib/files/access"
import type { Prisma } from "@/lib/generated/prisma/client"

export const PAGE_SIZE = 40

export const messageInclude = {
  files: { orderBy: { createdAt: "asc" } },
  author: { select: { role: true } },
  call: { select: { id: true, title: true, status: true, notesStatus: true, startedAt: true, endedAt: true } },
} satisfies Prisma.MessageInclude

type MessageRow = Prisma.MessageGetPayload<{ include: typeof messageInclude }>

export function toMessageDTO(m: MessageRow): MessageDTO {
  const deleted = Boolean(m.deletedAt)
  return {
    id: m.id,
    channelId: m.channelId,
    authorId: m.authorId,
    authorName: m.authorName,
    fromClient: m.author?.role === "CLIENT",
    fromAi: m.fromAi,
    body: deleted ? "" : m.body,
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt?.toISOString() ?? null,
    deleted,
    files: deleted ? [] : m.files.map(toFileDTO),
    call: m.call
      ? { ...m.call, startedAt: m.call.startedAt.toISOString(), endedAt: m.call.endedAt?.toISOString() ?? null }
      : null,
  }
}

function preview(body: string, files: number, voice = false) {
  const text = plainText(body).replace(/\s+/g, " ").trim()
  if (text) return text.length > 80 ? `${text.slice(0, 80)}…` : text
  if (voice) return "Voice message"
  return files === 1 ? "Sent a file" : `Sent ${files} files`
}

/** Channels the user can see, with unread counts. Creates General / the client's chat on first use. */
export async function getChannelList(user: CurrentUser): Promise<ChannelSummaryDTO[]> {
  const scope = await channelScope(user)
  if (!scope) return []
  if (isTeamRole(user.role)) {
    await ensureGeneralChannel()
    // Every client gets a chat; create any that don't exist yet.
    const missing = await db.client.findMany({ where: { channel: null }, select: { id: true } })
    if (missing.length) {
      await db.channel.createMany({ data: missing.map((c) => ({ kind: "CLIENT" as const, clientId: c.id })), skipDuplicates: true })
    }
  } else if (user.clientId) {
    await ensureClientChannel(user.clientId)
  }

  const channels = await db.channel.findMany({
    where: scope,
    include: {
      client: { select: { name: true } },
      members: { include: { user: { select: { id: true, name: true } } } },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { _count: { select: { files: true } }, files: { where: { voiceNote: true }, select: { id: true }, take: 1 } },
      },
    },
  })

  const reads = await db.channelMember.findMany({
    where: { userId: user.id, channelId: { in: channels.map((c) => c.id) } },
    select: { channelId: true, lastReadAt: true },
  })
  const lastRead = new Map(reads.map((r) => [r.channelId, r.lastReadAt]))

  const unreadCounts = await Promise.all(
    channels.map((c) =>
      db.message.count({
        where: {
          channelId: c.id,
          deletedAt: null,
          authorId: { not: user.id },
          ...(lastRead.get(c.id) ? { createdAt: { gt: lastRead.get(c.id)! } } : {}),
        },
      })
    )
  )

  const summaries = channels.map((c, i): ChannelSummaryDTO => {
    const last = c.messages[0]
    let title = c.name ?? "Chat"
    if (c.kind === "CLIENT") title = isTeamRole(user.role) ? (c.client?.name ?? "Client") : "Klyron Studio"
    if (c.kind === "DIRECT") {
      title = c.members.filter((m) => m.userId !== user.id).map((m) => m.user.name).join(", ") || "Just you"
    }
    return {
      id: c.id,
      kind: c.kind,
      title,
      clientId: c.clientId,
      unread: unreadCounts[i],
      lastMessage: last ? { authorName: last.authorName, preview: preview(last.body, last._count.files, last.files.length > 0), at: last.createdAt.toISOString() } : null,
    }
  })

  const order = { TEAM: 0, GROUP: 1, CLIENT: 2, DIRECT: 3 }
  return summaries.sort(
    (a, b) =>
      order[a.kind] - order[b.kind] ||
      (b.lastMessage?.at ?? "").localeCompare(a.lastMessage?.at ?? "") ||
      a.title.localeCompare(b.title)
  )
}

/** Newest page of messages (or the page before `beforeId`), returned oldest first. */
export async function getMessages(channelId: string, beforeId?: string) {
  let before: Date | undefined
  if (beforeId) {
    const anchor = await db.message.findFirst({ where: { id: beforeId, channelId }, select: { createdAt: true } })
    before = anchor?.createdAt
  }
  const rows = await db.message.findMany({
    where: { channelId, ...(before ? { createdAt: { lt: before } } : {}) },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    include: messageInclude,
  })
  const hasMore = rows.length > PAGE_SIZE
  return { messages: rows.slice(0, PAGE_SIZE).reverse().map(toMessageDTO), hasMore }
}

/** Unread total across channels, for the sidebar badge. */
export async function getUnreadTotal(user: CurrentUser) {
  const channels = await getChannelList(user)
  return channels.reduce((n, c) => n + c.unread, 0)
}
