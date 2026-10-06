import type { Metadata } from "next"
import Link from "next/link"
import { FolderKanbanIcon } from "lucide-react"

import { EmptyState } from "@/components/crm/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { NewProjectDialog } from "@/components/projects/new-project-dialog"
import { ProjectCard } from "@/components/projects/project-card"
import { Button } from "@/components/ui/button"
import { can, requirePermission } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { getAssignableMembers, getServices } from "@/lib/leads/queries"
import { projectStatuses, type ProjectStatusKey } from "@/lib/projects/constants"
import { getProjects, type ProjectFilters } from "@/lib/projects/queries"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Projects" }

const tabs = [
  { value: "open", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "all", label: "All" },
] as const

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const user = await requirePermission("projects", "READ")
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const statusParam = one(sp.status) ?? "open"
  const mine = one(sp.mine) === "1"

  const filters: ProjectFilters = {
    status:
      statusParam === "all"
        ? undefined
        : statusParam === "open"
          ? "open"
          : projectStatuses.includes(statusParam as ProjectStatusKey)
            ? (statusParam as ProjectStatusKey)
            : "open",
    mine,
  }

  const [projects, canWrite, clients, services, members] = await Promise.all([
    getProjects(user, filters),
    can(user, "projects", "WRITE"),
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getServices(),
    getAssignableMembers(),
  ])

  const href = (next: { status?: string; mine?: boolean }) => {
    const params = new URLSearchParams()
    const status = next.status ?? statusParam
    if (status !== "open") params.set("status", status)
    if (next.mine ?? mine) params.set("mine", "1")
    const qs = params.toString()
    return qs ? `/projects?${qs}` : "/projects"
  }

  return (
    <>
      <PageHeader
        title="Projects"
        description="Client work in flight: progress, deadlines and milestones."
        actions={
          canWrite &&
          (clients.length > 0 ? (
            <NewProjectDialog clients={clients} services={services} members={members} currentUserId={user.id} />
          ) : (
            <Button variant="secondary" nativeButton={false} render={<Link href="/clients" />}>
              Add a client first
            </Button>
          ))
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Project status" className="inline-flex rounded-md border border-border bg-background p-0.5">
          {tabs.map((tab) => (
            <Link
              key={tab.value}
              href={href({ status: tab.value })}
              aria-current={statusParam === tab.value ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center rounded-sm px-3 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground",
                statusParam === tab.value && "bg-muted font-medium text-foreground"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <Link
          href={href({ mine: !mine })}
          aria-pressed={mine}
          className={cn(
            "inline-flex h-8 items-center rounded-md border px-3 text-sm transition-colors duration-150 ease-out",
            mine ? "border-primary/40 bg-primary-tint text-primary-strong" : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          Only my projects
        </Link>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanbanIcon}
          title={statusParam === "open" && !mine ? "No projects in flight." : "Nothing here."}
          description={
            statusParam === "open" && !mine
              ? "Create a project for a client to plan milestones and track tasks."
              : "No projects match this view."
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} href={`/projects/${project.id}`} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
