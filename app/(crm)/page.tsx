import Link from "next/link"
import { BellIcon, CircleCheckIcon, CircleDotIcon } from "lucide-react"

import { StatCard } from "@/components/crm/stat-card"
import { StageBadge } from "@/components/leads/stage-badge"
import { DueDate, PriorityBadge } from "@/components/projects/project-bits"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { can, requireTeamUser } from "@/lib/auth/dal"
import { formatDateTime, formatRelative } from "@/lib/format"
import { getMyDueFollowUps, getPipelineSummary, getRecentLeads } from "@/lib/leads/queries"
import { getMyTasks } from "@/lib/projects/queries"
import { formatMoney, formatTotals } from "@/lib/money"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

export default async function DashboardPage() {
  const user = await requireTeamUser()
  const firstName = user.name.split(" ")[0]
  const [canSeeLeads, canSeeProjects] = await Promise.all([can(user, "leads", "READ"), can(user, "projects", "READ")])
  const myTasks = canSeeProjects ? await getMyTasks(user) : []
  const tasksCard = canSeeProjects && <MyTasksCard tasks={myTasks} />

  if (!canSeeLeads) {
    return (
      <>
        <PageHeader editorial title={`Welcome back, ${firstName}.`} description="Your workspace at Klyron Studio." />
        <div className="max-w-xl">{tasksCard}</div>
      </>
    )
  }

  const [summary, followUps, recent] = await Promise.all([
    getPipelineSummary(user),
    getMyDueFollowUps(user),
    getRecentLeads(user),
  ])
  const now = new Date()

  return (
    <>
      <PageHeader editorial title={`Welcome back, ${firstName}.`} description="Pipeline and follow-ups at a glance." />

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Open pipeline" value={formatTotals(summary.openValue, { compact: true })} hint={plural(summary.openCount, "open lead")} />
        <StatCard label="Won this month" value={formatTotals(summary.wonValue, { compact: true })} hint={`${plural(summary.wonCount, "deal")} closed`} />
        <StatCard label="Win rate this month" value={summary.winRate === null ? "—" : `${summary.winRate}%`} hint="Won vs. lost, closed this month" />
        <StatCard label="New leads this month" value={String(summary.newCount)} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-5">
            <CardTitle className="text-base font-semibold">Recently active</CardTitle>
            <CardDescription>Leads with the latest movement.</CardDescription>
            <CardAction>
              <Link href="/leads" className="link text-sm">
                Open pipeline
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            {recent.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">No leads yet.</p>
            ) : (
              <Table containerClassName="rounded-none border-0">
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((lead) => (
                    <TableRow key={lead.id} className="relative">
                      <TableCell>
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                        >
                          {lead.company ?? lead.name}
                        </Link>
                        {lead.company && <div className="text-xs text-muted-foreground">{lead.name}</div>}
                      </TableCell>
                      <TableCell>
                        <StageBadge name={lead.stage.name} tone={lead.stage.tone} muted={lead.stage.kind === "LOST"} />
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(lead.value, lead.currency)}</TableCell>
                      <TableCell suppressHydrationWarning className="text-right text-muted-foreground">
                        {formatRelative(new Date(lead.updatedAt))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base font-semibold">Your follow-ups</CardTitle>
            <CardDescription>Due today or overdue.</CardDescription>
          </CardHeader>
          <CardContent>
            {followUps.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CircleCheckIcon aria-hidden className="size-5 text-success" />
                <p className="text-sm text-muted-foreground">Nothing due. You&rsquo;re all caught up.</p>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {followUps.map((f) => {
                  const due = new Date(f.dueAt)
                  const overdue = due < now
                  return (
                    <li key={f.id} className="relative flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <BellIcon aria-hidden className={overdue ? "mt-0.5 size-4 text-primary" : "mt-0.5 size-4 text-warning"} />
                      <div className="min-w-0">
                        <Link
                          href={`/leads/${f.lead.id}`}
                          className="text-sm font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring"
                        >
                          {f.note}
                        </Link>
                        <p suppressHydrationWarning className="text-xs text-muted-foreground">
                          {f.lead.company ?? f.lead.name} ·{" "}
                          <span className={overdue ? "font-medium text-primary-strong" : undefined}>
                            {overdue ? `Overdue, ${formatRelative(due)}` : formatDateTime(due)}
                          </span>
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
        {tasksCard}
        </div>
      </div>
    </>
  )
}

type MyTask = Awaited<ReturnType<typeof getMyTasks>>[number]

function MyTasksCard({ tasks }: { tasks: MyTask[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base font-semibold">Your tasks</CardTitle>
        <CardDescription>Open tasks assigned to you, soonest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CircleCheckIcon aria-hidden className="size-5 text-success" />
            <p className="text-sm text-muted-foreground">No open tasks assigned to you.</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {tasks.map((task) => (
              <li key={task.id} className="relative flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <CircleDotIcon aria-hidden className={task.status === "DOING" ? "mt-0.5 size-4 text-info" : "mt-0.5 size-4 text-muted-foreground"} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/projects/${task.project.id}`}
                    className="text-sm font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring"
                  >
                    {task.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{task.project.name}</span>
                    <PriorityBadge priority={task.priority} />
                    <DueDate date={task.dueDate} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
