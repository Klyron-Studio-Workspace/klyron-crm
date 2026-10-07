"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { logEvent, userActor } from "@/lib/audit"
import { can, requireUser, type CurrentUser } from "@/lib/auth/dal"
import { isTeamRole } from "@/lib/auth/permissions"
import { channelAudience, directKey, findAccessibleChannel } from "@/lib/chat/access"
import { replyWithAi } from "@/lib/chat/ai"
import { getMentionOptions, validateMentions } from "@/lib/chat/mention-server"
import { plainText, type MentionOption } from "@/lib/chat/mentions"
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
  const mentions = await validateMentions(user, channel, body)

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
      data: { channelId: channel.id, authorId: user.id, authorName: user.name, body: mentions.body },
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
  await notifyMentioned(user, channel, mentions.userIds, mentions.body)
  await notifyAboutMessage(user, channel, audience, plainText(mentions.body), fileIds.length, new Set(mentions.userIds))
  if (mentions.askAi) void replyWithAi(channel.id, { id: user.id, name: user.name }, [...mentions.fileIds, ...fileIds])
  return { ok: true }
}

/** "@Sara" always notifies Sara (even in busy team channels), by email too when she's away. */
async function notifyMentioned(author: CurrentUser, channel: Channel & { client: { name: string } | null }, userIds: string[], body: string) {
  if (userIds.length === 0) return
  const where =
    channel.kind === "CLIENT" ? (channel.client?.name ?? "a client chat") : channel.kind === "DIRECT" ? "a direct message" : `${channel.kind === "TEAM" ? "#" : ""}${channel.name ?? "a conversation"}`
  const text = plainText(body)
  const preview = text.length > 160 ? `${text.slice(0, 160)}…` : text
  const rows = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, role: true } })
  for (const row of rows) {
    await notify({
      userIds: [row.id],
      type: "chat.mention",
      title: `${author.name} mentioned you in ${where}`,
      body: preview,
      link: chatLink(row, channel.id),
      email: "if-offline",
    })
  }
}

/** Options for the composer's "@" menu. */
export async function getMentionMenu(channelId: string): Promise<MentionOption[]> {
  const user = await requireUser()
  const channel = await findAccessibleChannel(user, channelId)
  if (!channel) return []
  return getMentionOptions(user, channel)
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
  fileCount: number,
  /** Already notified as a mention. */
  skip: Set<string> = new Set()
) {
  if (channel.kind === "TEAM") return
  const preview = body ? (body.length > 140 ? `${body.slice(0, 140)}…` : body) : fileCount === 1 ? "Sent a file" : `Sent ${fileCount} files`

  let recipients: string[]
  let title: string
  if (channel.kind === "DIRECT" || channel.kind === "GROUP") {
    recipients = audience
    title = channel.kind === "GROUP" ? `${author.name} in ${channel.name ?? "a group"}` : `${author.name} sent you a message`
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

  const offline = recipients.filter((id) => id !== author.id && !skip.has(id) && !isOnline(id))
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

  const { body: cleaned } = await validateMentions(user, channel, text)
  const updated = await db.message.update({ where: { id: messageId }, data: { body: cleaned, editedAt: new Date() }, include: messageInclude })
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

// ─── Private groups ─────────────────────────────────────────────────────────

const MAX_GROUP_MEMBERS = 50

async function activeTeamIds(ids: string[]) {
  const rows = await db.user.findMany({
    where: { id: { in: ids }, status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "MEMBER"] } },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

/** A group the user belongs to, plus whether they may manage it (creator, Owner or Admin). */
async function loadGroup(user: CurrentUser, channelId: string) {
  const channel = await findAccessibleChannel(user, channelId)
  if (!channel || channel.kind !== "GROUP") return null
  const canManage = channel.createdById === user.id || user.role === "OWNER" || user.role === "ADMIN"
  return { channel, canManage }
}

/** Posts a small line ("Sara added Ali") so membership changes are visible in the thread. */
async function postGroupNotice(channel: Channel, author: CurrentUser, body: string, extraAudience: string[] = []) {
  const message = await db.message.create({
    data: { channelId: channel.id, authorId: author.id, authorName: author.name, body },
    include: messageInclude,
  })
  await db.channel.update({ where: { id: channel.id }, data: { lastMessageAt: message.createdAt } })
  const audience = [...new Set([...(await channelAudience(channel)), ...extraAudience])]
  publish(audience, { type: "message", channelId: channel.id, message: toMessageDTO(message) })
}

export async function createGroup(input: { name: string; memberIds: string[] }): Promise<Result<{ channelId: string }>> {
  const user = await requireChatWriter()
  if (!isTeamRole(user.role)) return { ok: false, error: "Groups are for the team." }
  const parsed = channelNameSchema.safeParse(input.name)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name." }
  const wanted = [...new Set(input.memberIds)].filter((id) => id !== user.id)
  if (wanted.length === 0) return { ok: false, error: "Add at least one other person." }
  if (wanted.length + 1 > MAX_GROUP_MEMBERS) return { ok: false, error: `Groups can have up to ${MAX_GROUP_MEMBERS} people.` }
  const valid = await activeTeamIds(wanted)
  if (valid.length !== wanted.length) return { ok: false, error: "Choose active team members." }

  const channel = await db.channel.create({
    data: {
      kind: "GROUP",
      name: parsed.data,
      createdById: user.id,
      members: { create: [user.id, ...valid].map((userId) => ({ userId })) },
    },
  })
  await postGroupNotice(channel, user, `created the group “${parsed.data}”`)
  await notify({ userIds: valid, type: "chat.group.added", title: `${user.name} added you to ${parsed.data}`, link: `/chat/${channel.id}`, email: "if-offline" })
  await logEvent({ actor: userActor(user), action: "chat.group.create", entity: { type: "channel", id: channel.id }, metadata: { name: parsed.data, members: valid.length + 1 } })
  revalidatePath("/chat", "layout")
  return { ok: true, channelId: channel.id }
}

export async function renameGroup(channelId: string, name: string): Promise<Result> {
  const user = await requireChatWriter()
  const group = await loadGroup(user, channelId)
  if (!group) return { ok: false, error: "Group not found." }
  if (!group.canManage) return { ok: false, error: "Only the group's creator or an admin can rename it." }
  const parsed = channelNameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name." }
  if (parsed.data === group.channel.name) return { ok: true }
  await db.channel.update({ where: { id: channelId }, data: { name: parsed.data } })
  await postGroupNotice(group.channel, user, `renamed the group to “${parsed.data}”`)
  revalidatePath("/chat", "layout")
  return { ok: true }
}

export async function addGroupMembers(channelId: string, userIds: string[]): Promise<Result> {
  const user = await requireChatWriter()
  const group = await loadGroup(user, channelId)
  if (!group) return { ok: false, error: "Group not found." }
  if (!group.canManage) return { ok: false, error: "Only the group's creator or an admin can add people." }
  const current = await db.channelMember.findMany({ where: { channelId }, select: { userId: true } })
  const existing = new Set(current.map((m) => m.userId))
  const wanted = [...new Set(userIds)].filter((id) => !existing.has(id))
  if (wanted.length === 0) return { ok: false, error: "They're already in the group." }
  if (existing.size + wanted.length > MAX_GROUP_MEMBERS) return { ok: false, error: `Groups can have up to ${MAX_GROUP_MEMBERS} people.` }
  const valid = await activeTeamIds(wanted)
  if (valid.length !== wanted.length) return { ok: false, error: "Choose active team members." }

  await db.channelMember.createMany({ data: valid.map((userId) => ({ channelId, userId })), skipDuplicates: true })
  const names = (await db.user.findMany({ where: { id: { in: valid } }, select: { name: true } })).map((u) => u.name)
  await postGroupNotice(group.channel, user, `added ${names.join(", ")}`)
  await notify({ userIds: valid, type: "chat.group.added", title: `${user.name} added you to ${group.channel.name ?? "a group"}`, link: `/chat/${channelId}`, email: "if-offline" })
  await logEvent({ actor: userActor(user), action: "chat.group.members.add", entity: { type: "channel", id: channelId }, metadata: { name: group.channel.name, added: names } })
  revalidatePath("/chat", "layout")
  return { ok: true }
}

/** Removes someone (managers only), or yourself (anyone can leave). */
export async function removeGroupMember(channelId: string, userId: string): Promise<Result> {
  const user = await requireChatWriter()
  const group = await loadGroup(user, channelId)
  if (!group) return { ok: false, error: "Group not found." }
  const leaving = userId === user.id
  if (!leaving && !group.canManage) return { ok: false, error: "Only the group's creator or an admin can remove people." }
  const member = await db.channelMember.findUnique({ where: { channelId_userId: { channelId, userId } }, include: { user: { select: { name: true } } } })
  if (!member) return { ok: false, error: "They're not in this group." }
  const count = await db.channelMember.count({ where: { channelId } })
  if (count <= 1) return { ok: false, error: "You're the last member. Delete the group instead." }

  await db.channelMember.delete({ where: { channelId_userId: { channelId, userId } } })
  // The removed person still gets this last update, so their list drops the group live.
  await postGroupNotice(group.channel, user, leaving ? "left the group" : `removed ${member.user.name}`, [userId])
  await logEvent({
    actor: userActor(user),
    action: leaving ? "chat.group.leave" : "chat.group.members.remove",
    entity: { type: "channel", id: channelId },
    metadata: { name: group.channel.name, member: member.user.name },
  })
  revalidatePath("/chat", "layout")
  return { ok: true }
}

export async function deleteGroup(channelId: string): Promise<Result> {
  const user = await requireChatWriter()
  const group = await loadGroup(user, channelId)
  if (!group) return { ok: false, error: "Group not found." }
  if (!group.canManage) return { ok: false, error: "Only the group's creator or an admin can delete it." }
  const files = await db.storedFile.findMany({ where: { channelId }, select: { storageKey: true, hasThumbnail: true } })
  await db.channel.delete({ where: { id: channelId } })
  await Promise.all(files.map((f) => deleteStored(f.storageKey, f.hasThumbnail)))
  await logEvent({ actor: userActor(user), action: "chat.group.delete", entity: { type: "channel", id: channelId }, metadata: { name: group.channel.name } })
  revalidatePath("/chat", "layout")
  return { ok: true }
}

/** Members and whether the viewer can manage them, for the group panel. */
export async function getGroupMembers(channelId: string) {
  const user = await requireUser()
  const group = await loadGroup(user, channelId)
  if (!group) return null
  const members = await db.channelMember.findMany({
    where: { channelId },
    include: { user: { select: { id: true, name: true, title: true } } },
    orderBy: { user: { name: "asc" } },
  })
  return {
    canManage: group.canManage,
    createdById: group.channel.createdById,
    members: members.map((m) => ({ id: m.user.id, name: m.user.name, title: m.user.title })),
  }
}
