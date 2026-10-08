import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { MilestonesPanel } from "@/components/projects/milestones-panel"
import { ProjectActions } from "@/components/projects/project-actions"
import { ProjectActivity } from "@/components/projects/project-activity"
import { ProjectAiCard } from "@/components/projects/project-ai-card"
import { DueDate, ProgressBar, ProjectStatusBadge } from "@/components/projects/project-bits"
import { TaskBoard } from "@/components/projects/task-board"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { can, requirePermission } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { formatDateOnly, initials } from "@/lib/format"
import { getAssignableMembers, getServices } from "@/lib/leads/queries"
import { getProjectDetail } from "@/lib/projects/queries"

export const metadata: Metadata = { title: "Project" }

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const user = await requirePermission("projects", "READ")
  const { id } = await params
  const project = await getProjectDetail(user, id)
  if (!project) notFound()

  const [canWrite, canSeeClient, members, services, clients] = await Promise.all([
    can(user, "projects", "WRITE"),
    can(user, "clients", "READ"),
    getAssignableMembers(),
    getServices({ includeInactive: true }),
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])
  // Assignees: the project team first, then everyone else.
  const teamIds = new Set([project.owner?.id, ...project.members.map((m) => m.id)].filter(Boolean))
  const assignees = [...members.filter((m) => teamIds.has(m.id)), ...members.filter((m) => !teamIds.has(m.id))]

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link href="/projects" className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon aria-hidden className="size-4" />
          Projects
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl font-semibold tracking-tight">{project.name}</h1>
              {!canWrite && <ProjectStatusBadge status={project.status} />}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {canSeeClient ? (
                <Link href={`/clients/${project.client.id}`} className="link">
                  {project.client.name}
                </Link>
              ) : (
                <span>{project.client.name}</span>
              )}
              {project.serviceName && <span>{project.serviceName}</span>}
              {project.startDate && <span>Started {formatDateOnly(project.startDate)}</span>}
              {project.dueDate && <DueDate date={project.dueDate} done={project.status === "COMPLETED"} short={false} className="text-sm" />}
            </div>
          </div>
          {canWrite && (
            <ProjectActions
              projectId={project.id}
              projectName={project.name}
              status={project.status}
              canDelete={user.role !== "MEMBER"}
              form={{
                clients,
                services: services.filter((s) => s.active || s.id === project.serviceId),
                members,
                initial: {
                  name: project.name,
                  description: project.description ?? "",
                  clientId: project.client.id,
                  serviceId: project.serviceId ?? "",
                  ownerId: project.owner?.id ?? "",
                  status: project.status,
                  startDate: project.startDate ?? "",
                  dueDate: project.dueDate ?? "",
                  memberIds: project.members.map((m) => m.id),
                },
              }}
            />
          )}
        </div>
        <ProgressBar progress={project.progress} label="Project progress" className="max-w-md" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Tasks" className="flex min-w-0 flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Tasks</h2>
            <span className="text-sm text-muted-foreground tabular-nums">
              {project.progress.done} of {project.progress.total} done
            </span>
          </div>
          <TaskBoard projectId={project.id} tasks={project.tasks} members={assignees} milestones={project.milestones} canWrite={canWrite} />
        </section>

        <div className="flex flex-col gap-6">
          <ProjectAiCard projectId={project.id} />
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">Milestones</CardTitle>
            </CardHeader>
            <CardContent>
              <MilestonesPanel projectId={project.id} milestones={project.milestones} canWrite={canWrite} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">Team</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {project.owner && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Avatar size="sm">
                    <AvatarFallback className="text-[10px] font-medium">{initials(project.owner.name)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{project.owner.name}</span>
                  <span className="text-muted-foreground">Lead</span>
                </div>
              )}
              {project.members
                .filter((m) => m.id !== project.owner?.id)
                .map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 text-sm">
                    <Avatar size="sm">
                      <AvatarFallback className="text-[10px] font-medium">{initials(m.name)}</AvatarFallback>
                    </Avatar>
                    {m.name}
                  </div>
                ))}
              {!project.owner && project.members.length === 0 && <p className="text-sm text-muted-foreground">Nobody assigned yet.</p>}
            </CardContent>
          </Card>

          {project.description && (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base font-semibold">Brief</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{project.description}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectActivity events={project.activity} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
