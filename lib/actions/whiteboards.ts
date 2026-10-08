"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { logEvent, userActor } from "@/lib/audit"
import { can, requireTeamUser } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { publish } from "@/lib/realtime/bus"
import { notify } from "@/lib/notifications"
import { canAccessWhiteboard, canManageWhiteboard } from "@/lib/whiteboard/access"
import { boardDocumentSchema, emptyBoard, parseBoardDocument } from "@/lib/whiteboard/document"

type Result = { ok: true; updatedAt?: string; revision?: number } | { ok: false; error: string; conflict?: boolean; revision?: number; document?: unknown }
const nameSchema = z.string().trim().min(1).max(120)

const templates = {
  brainstorm: { version: 1 as const, nodes: [
    { id: "idea", type: "sticky" as const, x: -90, y: -90, width: 180, height: 180, text: "Main idea", fill: "#ffe48d", stroke: "#e6c34d" },
    { id: "thought-1", type: "sticky" as const, x: -330, y: -40, width: 160, height: 140, text: "Idea", fill: "#cdd9ff", stroke: "#8ca2e8" },
    { id: "thought-2", type: "sticky" as const, x: 170, y: -40, width: 160, height: 140, text: "Idea", fill: "#bce6d2", stroke: "#77b995" },
  ] },
  flowchart: { version: 1 as const, nodes: [
    { id: "start", type: "ellipse" as const, x: -300, y: -50, width: 150, height: 90, text: "Start", fill: "#bce6d2", stroke: "#4f8d6b" },
    { id: "step", type: "rectangle" as const, x: -40, y: -65, width: 180, height: 120, text: "Next step", fill: "#ffffff", stroke: "#555555" },
    { id: "link", type: "line" as const, x: -150, y: -5, width: 110, height: 0.1, text: "", fill: "#ffffff", stroke: "#555555", startId: "start", startSide: "right" as const, endId: "step", endSide: "left" as const, endArrow: true },
  ] },
  retrospective: { version: 1 as const, nodes: [
    { id: "good", type: "sticky" as const, x: -310, y: -100, width: 190, height: 200, text: "What went well?", fill: "#bce6d2", stroke: "#77b995" },
    { id: "learn", type: "sticky" as const, x: -95, y: -100, width: 190, height: 200, text: "What did we learn?", fill: "#ffe48d", stroke: "#e6c34d" },
    { id: "next", type: "sticky" as const, x: 120, y: -100, width: 190, height: 200, text: "What should change?", fill: "#fbb7b7", stroke: "#df7f7f" },
  ] },
} satisfies Record<string, z.infer<typeof boardDocumentSchema>>

export async function createWhiteboard() {
  const user = await requireTeamUser()
  if (!(await can(user, "whiteboard", "WRITE"))) return
  const board = await db.whiteboard.create({
    data: { name: "Untitled board", content: emptyBoard, createdById: user.id, versions: { create: { revision: 0, content: emptyBoard, createdById: user.id } }, members: { create: { userId: user.id, access: "WRITE" } } },
  })
  await logEvent({ actor: userActor(user), action: "whiteboard.create", entity: { type: "whiteboard", id: board.id } })
  redirect(`/whiteboard/${board.id}`)
}

export async function createWhiteboardFromTemplate(template: keyof typeof templates) {
  const user = await requireTeamUser()
  if (!(await can(user, "whiteboard", "WRITE"))) return
  const content = templates[template]
  if (!content) return
  const names = { brainstorm: "Brainstorm", flowchart: "Flowchart", retrospective: "Retrospective" }
  const board = await db.whiteboard.create({ data: { name: names[template], content, createdById: user.id, versions: { create: { revision: 0, content, createdById: user.id } }, members: { create: { userId: user.id, access: "WRITE" } } } })
  redirect(`/whiteboard/${board.id}`)
}

export async function duplicateWhiteboard(id: string) {
  const user = await requireTeamUser()
  if (!(await can(user, "whiteboard", "WRITE")) || !(await canAccessWhiteboard(user, id, "READ"))) return
  const source = await db.whiteboard.findUnique({ where: { id }, select: { name: true, content: true } })
  if (!source) return
  const content = parseBoardDocument(source.content)
  const board = await db.whiteboard.create({ data: { name: `${source.name} copy`, content, createdById: user.id, versions: { create: { revision: 0, content, createdById: user.id } }, members: { create: { userId: user.id, access: "WRITE" } } } })
  redirect(`/whiteboard/${board.id}`)
}

export async function deleteWhiteboard(id: string) {
  const user = await requireTeamUser()
  if (!(await canManageWhiteboard(user, id))) return
  await db.whiteboard.deleteMany({ where: { id } })
  revalidatePath("/whiteboard")
}

export async function toggleWhiteboardFavorite(id: string) {
  const user = await requireTeamUser()
  if (!(await canAccessWhiteboard(user, id, "READ"))) return
  const board = await db.whiteboard.findUnique({ where: { id }, select: { favorite: true } })
  if (board) await db.whiteboard.update({ where: { id }, data: { favorite: !board.favorite } })
  revalidatePath("/whiteboard")
}

export async function markWhiteboardOpened(id: string) {
  const user = await requireTeamUser()
  if (await canAccessWhiteboard(user, id, "READ")) await db.$executeRaw`UPDATE whiteboard SET lastOpenedAt = NOW() WHERE id = ${id}`
}

export async function saveWhiteboard(id: string, content: unknown, expectedRevision: number): Promise<Result> {
  const user = await requireTeamUser()
  if (!(await can(user, "whiteboard", "WRITE"))) return { ok: false, error: "You don't have permission to edit boards." }
  if (!(await canAccessWhiteboard(user, id, "WRITE"))) return { ok: false, error: "You don't have access to edit this board." }
  const parsed = boardDocumentSchema.safeParse(content)
  if (!parsed.success) return { ok: false, error: "This board contains invalid content." }
  const current = await db.whiteboard.findUnique({ where: { id }, select: { revision: true, content: true } })
  if (!current) return { ok: false, error: "Board not found." }
  if (current.revision !== expectedRevision) return { ok: false, error: "This board changed in another session.", conflict: true, revision: current.revision, document: current.content }
  const revision = expectedRevision + 1
  const updated = await db.$transaction(async (tx) => {
    const changed = await tx.whiteboard.updateMany({ where: { id, revision: expectedRevision }, data: { content: parsed.data, revision } })
    if (!changed.count) return null
    await tx.whiteboardVersion.create({ data: { boardId: id, revision, content: parsed.data, createdById: user.id } })
    await tx.whiteboardVersion.deleteMany({ where: { boardId: id, revision: { lt: Math.max(0, revision - 50) } } })
    return tx.whiteboard.findUnique({ where: { id }, select: { updatedAt: true } })
  })
  if (!updated) {
    const latest = await db.whiteboard.findUnique({ where: { id }, select: { revision: true, content: true } })
    return { ok: false, error: "This board changed in another session.", conflict: true, revision: latest?.revision, document: latest?.content }
  }
  const audience = await db.user.findMany({ where: { status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "MEMBER"] }, NOT: { id: user.id } }, select: { id: true } })
  publish(audience.map((member) => member.id), { type: "whiteboard.update", boardId: id, revision, document: parsed.data, actorId: user.id })
  return { ok: true, updatedAt: updated.updatedAt.toISOString(), revision }
}

export async function updateWhiteboardPresence(id: string, cursor: { x: number | null; y: number | null }, selected: string[]) {
  const user = await requireTeamUser()
  if (!(await can(user, "whiteboard", "READ"))) return
  if (!(await canAccessWhiteboard(user, id, "READ"))) return
  const audience = await db.user.findMany({ where: { status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "MEMBER"] }, NOT: { id: user.id } }, select: { id: true } })
  publish(audience.map((member) => member.id), { type: "whiteboard.presence", boardId: id, userId: user.id, name: user.name, x: cursor.x, y: cursor.y, selected: selected.slice(0, 100) })
}

export async function getWhiteboardVersions(id: string) {
  const user = await requireTeamUser()
  if (!(await can(user, "whiteboard", "READ"))) return []
  if (!(await canAccessWhiteboard(user, id, "READ"))) return []
  const versions = await db.whiteboardVersion.findMany({ where: { boardId: id }, orderBy: { revision: "desc" }, take: 50, select: { revision: true, content: true, createdAt: true, createdBy: { select: { name: true } } } })
  return versions.map((version) => ({ revision: version.revision, document: version.content, createdAt: version.createdAt.toISOString(), author: version.createdBy?.name ?? "System" }))
}

export async function addWhiteboardComment(boardId: string, input: { body: string; x: number; y: number }) {
  const user = await requireTeamUser()
  if (!(await canAccessWhiteboard(user, boardId, "READ"))) return { ok: false as const, error: "Board not found." }
  const parsed = z.object({ body: z.string().trim().min(1).max(2000), x: z.number().finite(), y: z.number().finite() }).safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Write a comment first." }
  const comment = await db.whiteboardComment.create({ data: { boardId, authorId: user.id, ...parsed.data } })
  const dto = { id: comment.id, body: comment.body, x: comment.x, y: comment.y, author: user.name, createdAt: comment.createdAt.toISOString(), resolvedAt: null }
  const team = await db.user.findMany({ where: { status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "MEMBER"] } }, select: { id: true, name: true } })
  const audience = team.map((member) => member.id)
  publish(audience, { type: "whiteboard.comment", boardId, comment: dto })
  const mentioned = team.filter((member) => parsed.data.body.toLowerCase().includes(`@${member.name.toLowerCase()}`)).map((member) => member.id)
  await notify({ userIds: mentioned, excludeUserId: user.id, type: "whiteboard.mention", title: `${user.name} mentioned you on a whiteboard`, body: parsed.data.body, link: `/whiteboard/${boardId}` })
  return { ok: true as const, comment: dto }
}

export async function resolveWhiteboardComment(boardId: string, commentId: string) {
  const user = await requireTeamUser()
  if (!(await canAccessWhiteboard(user, boardId, "WRITE"))) return
  await db.whiteboardComment.updateMany({ where: { id: commentId, boardId }, data: { resolvedAt: new Date() } })
  const audience = await db.user.findMany({ where: { status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "MEMBER"] } }, select: { id: true } })
  publish(audience.map((member) => member.id), { type: "whiteboard.comment.resolve", boardId, commentId })
}

export async function updateWhiteboardSharing(boardId: string, members: { userId: string; access: "READ" | "WRITE" }[]) {
  const user = await requireTeamUser()
  if (!(await canManageWhiteboard(user, boardId))) return { ok: false as const, error: "Only the board owner or an admin can change sharing." }
  const parsed = z.array(z.object({ userId: z.string().min(1), access: z.enum(["READ", "WRITE"]) })).max(100).safeParse(members)
  if (!parsed.success) return { ok: false as const, error: "Invalid sharing settings." }
  await db.$transaction([db.whiteboardMember.deleteMany({ where: { boardId } }), db.whiteboardMember.createMany({ data: parsed.data.map((member) => ({ boardId, ...member })), skipDuplicates: true })])
  return { ok: true as const }
}

export async function renameWhiteboard(id: string, name: string): Promise<Result> {
  const user = await requireTeamUser()
  if (!(await can(user, "whiteboard", "WRITE"))) return { ok: false, error: "You don't have permission to edit boards." }
  if (!(await canAccessWhiteboard(user, id, "WRITE"))) return { ok: false, error: "You don't have access to edit this board." }
  const parsed = nameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, error: "Use a name between 1 and 120 characters." }
  const updated = await db.whiteboard.updateMany({ where: { id }, data: { name: parsed.data } })
  if (!updated.count) return { ok: false, error: "Board not found." }
  await logEvent({ actor: userActor(user), action: "whiteboard.rename", entity: { type: "whiteboard", id }, metadata: { name: parsed.data } })
  revalidatePath("/whiteboard")
  return { ok: true }
}

