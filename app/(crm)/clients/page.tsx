import type { Metadata } from "next"
import Link from "next/link"
import { BuildingIcon } from "lucide-react"

import { NewClientDialog } from "@/components/clients/client-dialogs"
import { EmptyState } from "@/components/crm/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { can, requirePermission } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { formatDate } from "@/lib/format"
import { getAssignableMembers } from "@/lib/leads/queries"

export const metadata: Metadata = { title: "Clients" }

export default async function ClientsPage() {
  const user = await requirePermission("clients", "READ")
  const [clients, canWrite, members] = await Promise.all([
    db.client.findMany({
      orderBy: { name: "asc" },
      include: {
        owner: { select: { name: true } },
        projects: { select: { status: true } },
        _count: { select: { accounts: true } },
      },
    }),
    can(user, "clients", "WRITE"),
    getAssignableMembers(),
  ])

  return (
    <>
      <PageHeader
        title="Clients"
        description="Everyone the studio works with: projects, contacts and portal access."
        actions={canWrite && <NewClientDialog members={members} currentUserId={user.id} />}
      />
      {clients.length === 0 ? (
        <EmptyState
          icon={BuildingIcon}
          title="No clients yet."
          description="Convert a won lead from its lead page, or add a client directly with “New client”."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Active projects</TableHead>
              <TableHead>Portal</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Client since</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => {
              const active = client.projects.filter((p) => p.status === "ACTIVE" || p.status === "PLANNING" || p.status === "ON_HOLD").length
              return (
                <TableRow key={client.id} className="relative">
                  <TableCell>
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                    >
                      {client.name}
                    </Link>
                    {client.contactName && <div className="text-xs text-muted-foreground">{client.contactName}</div>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{client.email ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">
                    {active}
                    {client.projects.length > active && (
                      <span className="text-muted-foreground"> of {client.projects.length}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {client._count.accounts ? `${client._count.accounts} ${client._count.accounts === 1 ? "login" : "logins"}` : "No access"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{client.owner?.name ?? "Unassigned"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(client.createdAt)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </>
  )
}
