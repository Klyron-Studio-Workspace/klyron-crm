import type { Metadata } from "next"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { can, requirePermission } from "@/lib/auth/dal"
import { manageableRoles, roleLabels, teamRoles } from "@/lib/auth/permissions"
import { db } from "@/lib/db"
import { formatRelative, initials } from "@/lib/format"
import { AddMemberDialog } from "./add-member-dialog"
import { MemberActions } from "./member-actions"

export const metadata: Metadata = { title: "Team" }

export default async function TeamPage() {
  const user = await requirePermission("team", "READ")
  const canManage = await can(user, "team", "WRITE")
  const assignable = manageableRoles(user.role).filter((r) => r !== "CLIENT")

  const members = await db.user.findMany({
      where: { role: { in: [...teamRoles] } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true, title: true },
    })

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Members</h2>
            <p className="text-sm text-muted-foreground">
              {members.length} {members.length === 1 ? "person" : "people"} on the team
            </p>
          </div>
          {canManage && assignable.length > 0 && <AddMemberDialog roles={assignable} />}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const manageable =
                canManage && member.id !== user.id && manageableRoles(user.role).includes(member.role)
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback className="text-[10px] font-medium">{initials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium">
                          {member.name}
                          {member.id === user.id && <span className="ml-1.5 text-muted-foreground">(you)</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.role === "OWNER" ? "brand" : "neutral"} className="rounded-md">
                      {roleLabels[member.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.status === "ACTIVE" ? (
                      <Badge variant="success" className="rounded-md">Active</Badge>
                    ) : (
                      <Badge variant="neutral" className="rounded-md text-muted-foreground">Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.lastLoginAt ? formatRelative(member.lastLoginAt) : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    {manageable && (
                      <MemberActions
                        member={{ id: member.id, name: member.name, role: member.role, status: member.status }}
                        roles={assignable}
                      />
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </section>

    </div>
  )
}
