import type { Metadata } from "next"
import Link from "next/link"
import { ScrollTextIcon } from "lucide-react"

import { EmptyState } from "@/components/crm/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requirePermission } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { formatDateTime } from "@/lib/format"
import { describeUserAgent } from "@/lib/user-agent"

export const metadata: Metadata = { title: "Audit log" }

const PAGE_SIZE = 50

const actionLabels: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.login.failed": "Failed sign-in",
  "auth.lockout": "Account locked",
  "auth.logout": "Signed out",
  "auth.password.change": "Changed password",
  "auth.password_reset.request": "Requested password reset",
  "auth.password_reset.complete": "Reset password",
  "auth.session.revoke": "Revoked a session",
  "auth.session.revoke_others": "Signed out other devices",
  "team.invite.create": "Created invite",
  "team.invite.revoke": "Revoked invite",
  "team.invite.accept": "Joined via invite",
  "team.member.create": "Added member",
  "team.member.role": "Changed role",
  "team.member.disable": "Disabled account",
  "team.member.enable": "Enabled account",
  "team.member.remove": "Removed member",
  "team.member.password_reset": "Reset member password",
  "settings.org.update": "Updated studio settings",
  "settings.permission.update": "Changed permission",
  "user.owner.seed": "Owner account created",
  "user.owner.password_reset": "Owner password restored",
  "lead.create": "Created lead",
  "lead.update": "Edited lead",
  "lead.delete": "Deleted lead",
  "lead.stage": "Moved lead",
  "lead.lost": "Marked lead lost",
  "lead.assign": "Reassigned lead",
  "lead.convert": "Converted lead to client",
  "lead.note.create": "Added lead note",
  "lead.note.delete": "Deleted lead note",
  "lead.reminder.create": "Scheduled follow-up",
  "lead.reminder.complete": "Completed follow-up",
  "client.create": "Created client",
  "client.update": "Edited client",
  "client.delete": "Deleted client",
  "client.project.create": "Started client project",
  "client.account.create": "Gave portal access",
  "client.account.remove": "Removed portal access",
  "client.account.disable": "Disabled portal sign-in",
  "client.account.enable": "Enabled portal sign-in",
  "client.account.password_reset": "Reset portal password",
  "project.create": "Created project",
  "project.update": "Edited project",
  "project.status": "Changed project status",
  "project.delete": "Deleted project",
  "milestone.create": "Added milestone",
  "milestone.complete": "Reached milestone",
  "milestone.delete": "Deleted milestone",
  "task.create": "Added task",
  "task.status": "Moved task",
  "task.assign": "Assigned task",
  "task.delete": "Deleted task",
  "file.upload": "Uploaded file",
  "file.delete": "Deleted file",
  "chat.channel.create": "Created chat channel",
  "chat.message.delete": "Removed a chat message",
  "invoice.create": "Created invoice",
  "invoice.update": "Edited invoice",
  "invoice.send": "Emailed invoice",
  "invoice.mark_sent": "Marked invoice sent",
  "invoice.view": "Client opened invoice",
  "invoice.reminder": "Sent payment reminder",
  "invoice.reminder.auto": "Sent automatic payment reminder",
  "invoice.payment": "Recorded payment",
  "invoice.payment.delete": "Removed payment",
  "invoice.void": "Voided invoice",
  "invoice.delete": "Deleted draft invoice",
  "proposal.create": "Created proposal",
  "proposal.update": "Edited proposal",
  "proposal.send": "Emailed proposal",
  "proposal.mark_sent": "Marked proposal sent",
  "proposal.view": "Recipient opened proposal",
  "proposal.accept": "Proposal accepted",
  "proposal.decline": "Proposal declined",
  "proposal.delete": "Deleted draft proposal",
  "expense.create": "Added expense",
  "expense.update": "Edited expense",
  "expense.delete": "Deleted expense",
  "settings.billing.update": "Changed billing settings",
  "pipeline.stage.create": "Added pipeline stage",
  "pipeline.stage.update": "Edited pipeline stage",
  "pipeline.stage.delete": "Deleted pipeline stage",
  "service.create": "Added service",
  "service.update": "Edited service",
  "service.archive": "Archived service",
  "service.restore": "Restored service",
  "service.delete": "Deleted service",
}

function describeMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null
  const m = metadata as Record<string, unknown>
  if (typeof m.from === "string" && typeof m.to === "string") {
    return typeof m.title === "string" ? `${m.title}: ${m.from} → ${m.to}` : `${m.from} → ${m.to}`
  }
  if (typeof m.role === "string" && typeof m.module === "string") return `${m.role} · ${m.module}: ${m.access}`
  if (typeof m.email === "string") return m.email
  if (typeof m.name === "string") return m.company ? `${m.name} (${m.company})` : m.name
  if (typeof m.number === "string") return [m.number, m.amount && m.currency ? `${m.amount} ${m.currency}` : null].filter(Boolean).join(" · ")
  if (typeof m.description === "string") return `${m.description}${m.amount ? ` · ${m.amount} ${m.currency}` : ""}`
  if (typeof m.client === "string") return m.client
  if (typeof m.title === "string") return m.title
  return null
}

export default async function AuditLogPage({ searchParams }: PageProps<"/settings/audit">) {
  await requirePermission("audit", "READ")
  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)

  const events = await db.event.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
  })
  const hasMore = events.length > PAGE_SIZE
  const rows = events.slice(0, PAGE_SIZE)

  if (rows.length === 0 && page === 1) {
    return (
      <EmptyState
        icon={ScrollTextIcon}
        title="Nothing recorded yet."
        description="Sign-ins, team changes and settings updates will appear here as they happen."
      />
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Audit log</h2>
        <p className="text-sm text-muted-foreground">Every action by people, AI agents and the system.</p>
      </div>
      <Table density="compact">
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Who</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((event) => (
            <TableRow key={event.id}>
              <TableCell className="text-muted-foreground">{formatDateTime(event.createdAt)}</TableCell>
              <TableCell>
                <span className="font-medium">{event.actorName ?? "Unknown"}</span>
                {event.actorType !== "USER" && (
                  <Badge variant={event.actorType === "AGENT" ? "info" : "neutral"} className="ml-2 rounded-md">
                    {event.actorType === "AGENT" ? "AI agent" : "System"}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <span className={event.action.includes("failed") || event.action.includes("lockout") ? "text-primary-strong" : undefined}>
                  {actionLabels[event.action] ?? event.action}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{describeMetadata(event.metadata) ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {event.ipAddress ?? "—"}
                {event.userAgent && <span className="block">{describeUserAgent(event.userAgent)}</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Page {page}</p>
        <div className="flex gap-2">
          {page > 1 && (
            <Button variant="secondary" size="sm" nativeButton={false} render={<Link href={`/settings/audit?page=${page - 1}`} />}>
              Newer
            </Button>
          )}
          {hasMore && (
            <Button variant="secondary" size="sm" nativeButton={false} render={<Link href={`/settings/audit?page=${page + 1}`} />}>
              Older
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
