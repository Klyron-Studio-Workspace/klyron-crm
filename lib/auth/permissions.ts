import type { Access, Role } from "@/lib/generated/prisma/enums"

export const modules = [
  { key: "leads", label: "Leads", description: "Pipeline, lead notes and follow-ups" },
  { key: "clients", label: "Clients", description: "Client records and accounts" },
  { key: "projects", label: "Projects", description: "Projects, tasks and milestones" },
  { key: "finance", label: "Finance", description: "Proposals, invoices and expenses" },
  { key: "chat", label: "Chat", description: "Messages, calls and shared media" },
  { key: "files", label: "Files", description: "Documents and uploads" },
  { key: "whiteboard", label: "Whiteboard", description: "Shared visual boards and diagrams" },
  { key: "team", label: "Team", description: "Members, accounts and roles" },
  { key: "settings", label: "Settings", description: "Organization settings" },
  { key: "audit", label: "Audit log", description: "History of every action" },
  { key: "mail", label: "Mail", description: "Inbound and outbound email" },
] as const

export type ModuleKey = (typeof modules)[number]["key"]
export type PermissionMatrix = Record<Role, Record<ModuleKey, Access>>

/**
 * Defaults, overridable per role in Settings → Permissions (RolePermission rows).
 * Owner is always full access and cannot be edited, so nobody can lock the studio out.
 * Client access is additionally scoped to their own records in every query.
 */
export const defaultPermissions: PermissionMatrix = {
  OWNER: {
    leads: "WRITE", clients: "WRITE", projects: "WRITE", finance: "WRITE", chat: "WRITE",
    files: "WRITE", whiteboard: "WRITE", team: "WRITE", settings: "WRITE", audit: "READ", mail: "WRITE",
  },
  ADMIN: {
    leads: "WRITE", clients: "WRITE", projects: "WRITE", finance: "WRITE", chat: "WRITE",
    files: "WRITE", whiteboard: "WRITE", team: "WRITE", settings: "WRITE", audit: "READ", mail: "WRITE",
  },
  MEMBER: {
    leads: "WRITE", clients: "READ", projects: "WRITE", finance: "NONE", chat: "WRITE",
    files: "WRITE", whiteboard: "WRITE", team: "READ", settings: "NONE", audit: "NONE", mail: "WRITE",
  },
  CLIENT: {
    leads: "NONE", clients: "NONE", projects: "READ", finance: "READ", chat: "WRITE",
    files: "WRITE", whiteboard: "NONE", team: "NONE", settings: "NONE", audit: "NONE", mail: "NONE",
  },
}

export const editableRoles = ["ADMIN", "MEMBER", "CLIENT"] as const satisfies Role[]

export const teamRoles = ["OWNER", "ADMIN", "MEMBER"] as const satisfies Role[]

export function isTeamRole(role: Role) {
  return role !== "CLIENT"
}

const rank: Record<Access, number> = { NONE: 0, READ: 1, WRITE: 2 }

export function hasAccess(granted: Access, needed: Exclude<Access, "NONE">) {
  return rank[granted] >= rank[needed]
}

export const roleLabels: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  CLIENT: "Client",
}

/** Which roles an actor may assign or manage. Owners manage everyone; Admins manage Members and Clients. */
export function manageableRoles(actorRole: Role): Role[] {
  if (actorRole === "OWNER") return ["OWNER", "ADMIN", "MEMBER", "CLIENT"]
  if (actorRole === "ADMIN") return ["MEMBER", "CLIENT"]
  return []
}
