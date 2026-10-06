import type { Metadata } from "next"
import Link from "next/link"
import { AlertCircleIcon } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { can, requirePermission } from "@/lib/auth/dal"
import { roleLabels } from "@/lib/auth/permissions"
import { initials } from "@/lib/format"
import { getWorkload, leadScope } from "@/lib/leads/queries"
import { getTaskLoad } from "@/lib/projects/queries"
import { formatTotals } from "@/lib/money"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Team" }

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "alert" }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-heading text-lg font-semibold tabular-nums", tone === "alert" && "text-primary-strong")}>{value}</dd>
    </div>
  )
}

export default async function TeamPage() {
  const user = await requirePermission("team", "READ")
  const [{ members, unassigned }, taskLoad, canManage, canReadLeads, scope] = await Promise.all([
    getWorkload(),
    getTaskLoad(),
    can(user, "team", "WRITE"),
    can(user, "leads", "READ"),
    leadScope(user),
  ])
  // Members limited to their own leads see workload counts, not others' deal values.
  const canSeeLeads = canReadLeads && !scope.ownerId
  const maxOpen = Math.max(1, ...members.map((m) => m.openLeads))

  return (
    <>
      <PageHeader
        title="Team"
        description="Who is carrying what: leads, follow-ups and project tasks."
        actions={
          canManage && (
            <Button variant="secondary" nativeButton={false} render={<Link href="/settings/team" />}>
              Manage members
            </Button>
          )
        }
      />

      {unassigned > 0 && canSeeLeads && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/20 bg-warning-tint px-4 py-3 text-sm text-warning">
          <span className="flex items-center gap-2">
            <AlertCircleIcon aria-hidden className="size-4" />
            {unassigned} open {unassigned === 1 ? "lead has" : "leads have"} no owner.
          </span>
          <Link href="/leads?owner=none" className="font-medium underline-offset-4 hover:underline">
            Assign them
          </Link>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((member) => (
          <li key={member.id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="text-xs font-medium">{initials(member.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-medium">{member.name}</p>
                <p className="truncate text-xs text-muted-foreground">{member.title ?? roleLabels[member.role]}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Open leads" value={member.openLeads} />
              <Metric label="Follow-ups" value={member.followUps} />
              <Metric label="Open tasks" value={taskLoad.get(member.id)?.open ?? 0} />
              <Metric
                label="Overdue"
                value={member.overdue + (taskLoad.get(member.id)?.overdue ?? 0)}
                tone={member.overdue + (taskLoad.get(member.id)?.overdue ?? 0) > 0 ? "alert" : undefined}
              />
            </dl>
            <div className="flex flex-col gap-1.5">
              <progress
                value={member.openLeads}
                max={maxOpen}
                aria-label={`${member.openLeads} open leads`}
                className="h-1.5 w-full appearance-none overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:bg-foreground [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-foreground"
              />
              {canSeeLeads && (
                <p className="text-xs text-muted-foreground">
                  Pipeline <span className="font-medium text-foreground tabular-nums">{formatTotals(member.openValue)}</span>
                </p>
              )}
            </div>
            {canSeeLeads && (
              <Link href={`/leads?owner=${member.id}`} className="link text-sm">
                View {member.id === user.id ? "your" : `${member.name.split(" ")[0]}'s`} leads
              </Link>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
