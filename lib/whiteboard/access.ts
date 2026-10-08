import "server-only"

import type { CurrentUser } from "@/lib/auth/dal"
import { db } from "@/lib/db"

const rank = { NONE: 0, READ: 1, WRITE: 2 } as const

export async function canAccessWhiteboard(user: CurrentUser, boardId: string, needed: "READ" | "WRITE") {
  const board = await db.whiteboard.findUnique({ where: { id: boardId }, select: { createdById: true, members: { where: { userId: user.id }, select: { access: true } }, _count: { select: { members: true } } } })
  if (!board) return false
  if (user.role === "OWNER" || user.role === "ADMIN" || board.createdById === user.id) return true
  // Existing boards remain team-visible until their owner configures explicit sharing.
  if (!board._count.members) return true
  return rank[board.members[0]?.access ?? "NONE"] >= rank[needed]
}

export async function canManageWhiteboard(user: CurrentUser, boardId: string) {
  if (user.role === "OWNER" || user.role === "ADMIN") return true
  return Boolean(await db.whiteboard.findFirst({ where: { id: boardId, createdById: user.id }, select: { id: true } }))
}
