import Link from "next/link"
import { FlagIcon } from "lucide-react"

import { DueDate, ProgressBar, ProjectStatusBadge } from "@/components/projects/project-bits"
import { formatDateOnly } from "@/lib/format"
import type { ProjectSummaryDTO } from "@/lib/projects/types"

type ProjectCardProps = {
  project: ProjectSummaryDTO
  href: string
  showClient?: boolean
  /** Client portal: hide internal signals such as overdue task counts. */
  clientView?: boolean
}

function ProjectCard({ project, href, showClient = true, clientView = false }: ProjectCardProps) {
  const subtitle = [showClient ? project.client.name : null, project.service].filter(Boolean).join(" · ")
  return (
    <article className="relative flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-xs transition-colors duration-150 ease-out hover:border-input">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={href}
            className="font-heading font-semibold outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {project.name}
          </Link>
          {(subtitle || !clientView) && <p className="truncate text-sm text-muted-foreground">{subtitle || "No service"}</p>}
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      <ProgressBar progress={project.progress} label={project.name} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {project.progress.done}/{project.progress.total} tasks
          {!clientView && project.overdueTasks > 0 && <span className="font-medium text-primary-strong"> · {project.overdueTasks} overdue</span>}
        </span>
        {project.dueDate && <DueDate date={project.dueDate} done={project.status === "COMPLETED"} />}
        {project.owner && <span>Lead: {project.owner.name}</span>}
      </div>

      {project.nextMilestone && (
        <p className="flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
          <FlagIcon aria-hidden className="size-3.5" />
          Next: <span className="font-medium text-foreground">{project.nextMilestone.name}</span>
          {project.nextMilestone.dueDate && <> · {formatDateOnly(project.nextMilestone.dueDate, { short: true })}</>}
        </p>
      )}
    </article>
  )
}

export { ProjectCard }
