import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, CircleCheckIcon, CircleIcon } from "lucide-react"

import { DueDate, ProgressBar, ProjectStatusBadge } from "@/components/projects/project-bits"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requireClientUser } from "@/lib/auth/dal"
import { formatDateOnly } from "@/lib/format"
import { getPortalProject } from "@/lib/projects/queries"

export const metadata: Metadata = { title: "Project" }

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-card p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

/** Read-only, client-safe view: progress and milestones, never internal task details. */
export default async function PortalProjectPage({ params }: PageProps<"/portal/projects/[id]">) {
  const user = await requireClientUser()
  const { id } = await params
  const project = await getPortalProject(user.clientId, id)
  if (!project) notFound()

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link href="/portal" className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon aria-hidden className="size-4" />
          All projects
        </Link>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {project.service && <span>{project.service}</span>}
            {project.lead && <span>Your lead: {project.lead}</span>}
            {project.startDate && <span>Started {formatDateOnly(project.startDate)}</span>}
            {project.dueDate && (
              <span className="inline-flex items-center gap-1">
                Target <DueDate date={project.dueDate} done={project.status === "COMPLETED"} short={false} className="text-sm" />
              </span>
            )}
          </p>
        </div>
      </div>

      <section aria-label="Progress" className="flex flex-col gap-4">
        <ProgressBar progress={project.progress} label="Overall progress" />
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Up next" value={project.taskCounts.todo} />
          <Stat label="In progress" value={project.taskCounts.doing} />
          <Stat label="Done" value={project.taskCounts.done} />
        </dl>
      </section>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base font-semibold">Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          {project.milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Milestones will appear here once they&rsquo;re planned.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-border">
              {project.milestones.map((m) => {
                const done = Boolean(m.completedAt)
                const Icon = done ? CircleCheckIcon : CircleIcon
                return (
                  <li key={m.id} className="flex flex-col gap-2 py-3">
                    <div className="flex items-start gap-3">
                      <Icon aria-hidden className={done ? "mt-0.5 size-4 text-success" : "mt-0.5 size-4 text-muted-foreground"} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {m.name}
                          <span className="sr-only">{done ? " (reached)" : " (upcoming)"}</span>
                        </p>
                        {done ? (
                          <p className="text-xs text-success">Reached</p>
                        ) : (
                          <DueDate date={m.dueDate} />
                        )}
                      </div>
                    </div>
                    {!done && m.progress.total > 0 && <ProgressBar progress={m.progress} label={m.name} className="pl-7" />}
                  </li>
                )
              })}
            </ol>
          )}
        </CardContent>
      </Card>

    </>
  )
}
