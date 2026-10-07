import "server-only"

import type { CurrentUser } from "@/lib/auth/dal"
import { isTeamRole } from "@/lib/auth/permissions"
import { channelAudience, memberClientScope } from "@/lib/chat/access"
import { isChatAiConfigured } from "@/lib/chat/ai"
import { AI_LABEL, mentionsIn, parseBody, toToken, type MentionOption } from "@/lib/chat/mentions"
import { db } from "@/lib/db"
import type { Channel, Prisma } from "@/lib/generated/prisma/client"

/**
 * Files that may be referenced in a conversation. In a client chat only files
 * the client can already open are offered, so names of internal files never leak.
 */
async function mentionableFilesWhere(user: CurrentUser, channel: Channel): Promise<Prisma.StoredFileWhereInput> {
  const inChannel: Prisma.StoredFileWhereInput = { channelId: channel.id, messageId: { not: null } }
  if (channel.kind === "CLIENT" && channel.clientId) {
    return { OR: [inChannel, { clientId: channel.clientId, channelId: null, sharedWithClient: true }] }
  }
  if (isTeamRole(user.role)) {
    // Team-only conversations: files here, plus client files the sender can see.
    const clientIds = await memberClientScope(user)
    return {
      OR: [
        inChannel,
        { channelId: null, clientId: clientIds ? { in: clientIds } : { not: null } },
        // Restricted vault documents are never offered: everyone in the chat (and the AI) would see them.
        { company: true, restricted: false },
      ],
    }
  }
  return inChannel
}

/** What the "@" menu offers in this conversation. */
export async function getMentionOptions(user: CurrentUser, channel: Channel): Promise<MentionOption[]> {
  const audience = (await channelAudience(channel)).filter((id) => id !== user.id)
  const [people, files] = await Promise.all([
    db.user.findMany({ where: { id: { in: audience }, status: "ACTIVE" }, select: { id: true, name: true, title: true, role: true }, orderBy: { name: "asc" } }),
    db.storedFile.findMany({
      where: { AND: [await mentionableFilesWhere(user, channel), { voiceNote: false }] },
      select: { id: true, name: true, kind: true, company: true, folder: true, client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ])
  const options: MentionOption[] = []
  if (isTeamRole(user.role) && isChatAiConfigured()) {
    options.push({ kind: "ai", id: null, label: AI_LABEL, hint: "Ask the AI about this conversation" })
  }
  for (const p of people) options.push({ kind: "user", id: p.id, label: p.name, hint: p.role === "CLIENT" ? "Client" : (p.title ?? undefined) })
  for (const f of files) {
    const hint = f.company ? `Company${f.folder ? ` · ${f.folder}` : ""}` : (f.client?.name ?? f.kind.toLowerCase())
    options.push({ kind: "file", id: f.id, label: f.name, hint })
  }
  return options
}

/**
 * Drops mentions the sender isn't allowed to make (someone outside the
 * conversation, a file they can't reference, the AI for clients), turning
 * them back into plain "@Label" text. Returns the cleaned body and who to notify.
 */
export async function validateMentions(user: CurrentUser, channel: Channel, body: string) {
  const mentions = mentionsIn(body)
  if (mentions.length === 0) return { body, userIds: [] as string[], askAi: false, fileIds: [] as string[] }

  const audience = new Set(await channelAudience(channel))
  const fileIds = [...new Set(mentions.filter((m) => m.kind === "file" && m.id).map((m) => m.id!))]
  const allowedFiles = fileIds.length
    ? new Set((await db.storedFile.findMany({ where: { AND: [{ id: { in: fileIds } }, await mentionableFilesWhere(user, channel)] }, select: { id: true } })).map((f) => f.id))
    : new Set<string>()
  const aiAllowed = isTeamRole(user.role) && isChatAiConfigured()

  const userIds = new Set<string>()
  let askAi = false
  const cleaned = parseBody(body)
    .map((part) => {
      if (part.type === "text") return part.text
      const m = part.mention
      const ok =
        (m.kind === "user" && m.id && audience.has(m.id) && m.id !== user.id) ||
        (m.kind === "file" && m.id && allowedFiles.has(m.id)) ||
        (m.kind === "ai" && aiAllowed)
      if (!ok) return `@${m.label}`
      if (m.kind === "user") userIds.add(m.id!)
      if (m.kind === "ai") askAi = true
      return toToken(m)
    })
    .join("")
  return { body: cleaned, userIds: [...userIds], askAi, fileIds: [...allowedFiles] }
}
