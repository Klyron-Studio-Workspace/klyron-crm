import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getPermissionMatrix, requireTeamUser } from "@/lib/auth/dal"
import { editableRoles, modules, roleLabels } from "@/lib/auth/permissions"
import { AccessSelect } from "./access-select"

export const metadata: Metadata = { title: "Permissions" }

export default async function PermissionsPage() {
  const user = await requireTeamUser()
  if (user.role !== "OWNER") notFound()
  const matrix = await getPermissionMatrix()

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Role permissions</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          What each role can view or edit. Owners always have full access. Client access is also limited to their own
          projects, chats, files and invoices.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Area</TableHead>
            {editableRoles.map((role) => (
              <TableHead key={role}>{roleLabels[role]}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {modules.map((module) => (
            <TableRow key={module.key}>
              <TableCell>
                <div className="font-medium">{module.label}</div>
                <div className="text-xs text-muted-foreground">{module.description}</div>
              </TableCell>
              {editableRoles.map((role) => (
                <TableCell key={role}>
                  <AccessSelect
                    role={role}
                    module={module.key}
                    value={matrix[role][module.key]}
                    label={`${roleLabels[role]} access to ${module.label}`}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
