import "server-only"

import { cache } from "react"
import { notFound, redirect } from "next/navigation"

import {
  defaultPermissions,
  hasAccess,
  isTeamRole,
  type ModuleKey,
  type PermissionMatrix,
} from "@/lib/auth/permissions"
import { readSessionToken, validateSessionToken } from "@/lib/auth/session"
import { db } from "@/lib/db"
import type { Access, Role } from "@/lib/generated/prisma/enums"

/** Safe subset of the user to pass around (never the password hash). */
export type CurrentUser = {
  id: string
  email: string
  name: string
  title: string | null
  role: Role
  mustChangePassword: boolean
  /** Client record for CLIENT accounts; null for the team. */
  clientId: string | null
  sessionId: string
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await readSessionToken()
  if (!token) return null
  const session = await validateSessionToken(token)
  if (!session) return null
  const { user } = session
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    title: user.title,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    clientId: user.clientId,
    sessionId: session.id,
  }
})

export const getPermissionMatrix = cache(async (): Promise<PermissionMatrix> => {
  const overrides = await db.rolePermission.findMany()
  const matrix = structuredClone(defaultPermissions)
  for (const row of overrides) {
    if (row.role === "OWNER") continue
    if (row.module in matrix[row.role]) {
      matrix[row.role][row.module as ModuleKey] = row.access
    }
  }
  return matrix
})

type RequireOptions = {
  /** Skip the forced password-change redirect (used by the change-password page itself). */
  allowPasswordChange?: boolean
}

/** Any signed-in user. Redirects to /login otherwise. */
export async function requireUser(options: RequireOptions = {}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.mustChangePassword && !options.allowPasswordChange) redirect("/change-password")
  return user
}

/** Owner, Admin or Member. Clients are sent to their portal. */
export async function requireTeamUser() {
  const user = await requireUser()
  if (!isTeamRole(user.role)) redirect("/portal")
  return user
}

/** Client portal accounts. Always linked to a client record. */
export async function requireClientUser() {
  const user = await requireUser()
  if (isTeamRole(user.role)) redirect("/")
  if (!user.clientId) redirect("/login")
  return user as CurrentUser & { clientId: string }
}

export async function getAccess(role: Role, module: ModuleKey): Promise<Access> {
  if (role === "OWNER") return defaultPermissions.OWNER[module]
  const matrix = await getPermissionMatrix()
  return matrix[role][module]
}

export async function can(user: CurrentUser, module: ModuleKey, level: "READ" | "WRITE") {
  return hasAccess(await getAccess(user.role, module), level)
}

/** For pages: renders 404 when the user lacks access, so restricted areas are not revealed. */
export async function requirePermission(module: ModuleKey, level: "READ" | "WRITE") {
  const user = await requireUser()
  if (!(await can(user, module, level))) notFound()
  return user
}
