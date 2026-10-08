import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { can, requirePermission } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { parseBoardDocument } from "@/lib/whiteboard/document"
import { canAccessWhiteboard, canManageWhiteboard } from "@/lib/whiteboard/access"
import { WhiteboardEditor } from "./whiteboard-editor"

export const metadata: Metadata = { title: "Whiteboard" }

export default async function WhiteboardPage({ params }: PageProps<"/whiteboard/[id]">) {
  const user = await requirePermission("whiteboard", "READ")
  const { id } = await params
  const [board, canWrite] = await Promise.all([
    db.whiteboard.findUnique({ where: { id } }),
    can(user, "whiteboard", "WRITE"),
  ])
  if (!board) notFound()
  if (!(await canAccessWhiteboard(user, id, "READ"))) notFound()
  const boardWrite = canWrite && await canAccessWhiteboard(user, id, "WRITE")
  const [comments, members, team, manageable] = await Promise.all([
    db.whiteboardComment.findMany({ where: { boardId: id, resolvedAt: null }, orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } }),
    db.whiteboardMember.findMany({ where: { boardId: id }, select: { userId: true, access: true } }),
    db.user.findMany({ where: { status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "MEMBER"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    canManageWhiteboard(user, id),
  ])
  return <WhiteboardEditor id={board.id} initialName={board.name} initialDocument={parseBoardDocument(board.content)} initialRevision={board.revision} canWrite={boardWrite} canManage={manageable} initialComments={comments.map((comment) => ({ id: comment.id, body: comment.body, x: comment.x, y: comment.y, author: comment.author?.name ?? "Former member", createdAt: comment.createdAt.toISOString(), resolvedAt: null }))} team={team} initialMembers={members.map((member) => ({ userId: member.userId, access: member.access as "READ" | "WRITE" }))} />
}
