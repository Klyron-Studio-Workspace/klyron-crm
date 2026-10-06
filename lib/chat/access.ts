import "server-only"

import { can, getPermissionMatrix, type CurrentUser } from "@/lib/auth/dal"
import { hasAccess, isTeamRole } from "@/lib/auth/permissions"
import { db } from "@/lib/db"
import type { Channel, Prisma } from "@/lib/generated/prisma/client"
import { getOrgSettings } from "@/lib/leads/queries"

/**
 * Who can see a channel:
 * - TEAM: every team member with chat access.
 * - CLIENT: the team (members limited to "assigned work" only see clients they
 *   own or have a project with) and that client's portal accounts.
 * - DIRECT: its members only.
 */

/** Clients a scoped Member works with; null means "all clients". */
export async function memberClientScope(user: CurrentUser): Promise<string[] | null> {
  if (user.role !== "MEMBER" || !(await getOrgSettings()).membersSeeAssignedOnly) return null
  const clients = await db.client.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        { projects: { some: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] } } },
      ],
    },
    select: { id: true },
  })
  return clients.map((c) => c.id)
}

/** Prisma filter for the channels a user may see. */
export async function channelScope(user: CurrentUser): Promise<Prisma.ChannelWhereInput | null> {
  if (!(await can(user, "chat", "READ"))) return null
  if (!isTeamRole(user.role)) {
    return user.clientId ? { kind: "CLIENT", clientId: user.clientId } : null
  }
  const clientIds = await memberClientScope(user)
  return {
    OR: [
      { kind: "TEAM" },
      { kind: "CLIENT", ...(clientIds ? { clientId: { in: clientIds } } : {}) },
      { kind: "DIRECT", members: { some: { userId: user.id } } },
    ],
  }
}

export async function findAccessibleChannel(user: CurrentUser, channelId: string) {
  const scope = await channelScope(user)
  if (!scope) return null
  return db.channel.findFirst({ where: { AND: [scope, { id: channelId }] }, include: { client: { select: { name: true } } } })
}

/**
 * Everyone who should receive live events for a channel: exactly the people
 * channelScope would let see it, so live updates never reach anyone else.
 */
export async function channelAudience(channel: Pick<Channel, "id" | "kind" | "clientId">): Promise<string[]> {
  if (channel.kind === "DIRECT") {
    const members = await db.channelMember.findMany({ where: { channelId: channel.id }, select: { userId: true } })
    return members.map((m) => m.userId)
  }

  const matrix = await getPermissionMatrix()
  const teamRolesWithChat = (["OWNER", "ADMIN", "MEMBER"] as const).filter(
    (role) => role === "OWNER" || hasAccess(matrix[role].chat, "READ")
  )
  const team = await db.user.findMany({
    where: { status: "ACTIVE", role: { in: teamRolesWithChat } },
    select: { id: true, role: true },
  })

  let ids = team.map((u) => u.id)
  if (channel.kind === "CLIENT" && channel.clientId) {
    if ((await getOrgSettings()).membersSeeAssignedOnly) {
      const related = await db.user.findMany({
        where: {
          role: "MEMBER",
          OR: [
            { clientsOwned: { some: { id: channel.clientId } } },
            { projectsOwned: { some: { clientId: channel.clientId } } },
            { projectMembership: { some: { project: { clientId: channel.clientId } } } },
          ],
        },
        select: { id: true },
      })
      const allowedMembers = new Set(related.map((u) => u.id))
      ids = team.filter((u) => u.role !== "MEMBER" || allowedMembers.has(u.id)).map((u) => u.id)
    }
    if (hasAccess(matrix.CLIENT.chat, "READ")) {
      const accounts = await db.user.findMany({
        where: { status: "ACTIVE", role: "CLIENT", clientId: channel.clientId },
        select: { id: true },
      })
      ids.push(...accounts.map((a) => a.id))
    }
  }
  return ids
}

/** The studio-wide "General" room, created on first use. */
export async function ensureGeneralChannel() {
  const existing = await db.channel.findFirst({ where: { kind: "TEAM" }, orderBy: { createdAt: "asc" } })
  return existing ?? db.channel.create({ data: { kind: "TEAM", name: "General" } })
}

/** One chat per client, created on first use. */
export async function ensureClientChannel(clientId: string) {
  return db.channel.upsert({ where: { clientId }, create: { kind: "CLIENT", clientId }, update: {} })
}

export function directKey(userIds: string[]) {
  return [...new Set(userIds)].sort().join(":")
}
