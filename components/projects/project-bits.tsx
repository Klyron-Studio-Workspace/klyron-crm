import { CalendarIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { dueState, formatDateOnly } from "@/lib/format"
import {
  projectStatusLabels,
  projectStatusTone,
  taskPriorityLabels,
  taskPriorityTone,
  type ProjectStatusKey,
  type TaskPriorityKey,
} from "@/lib/projects/constants"
import type { Progress } from "@/lib/projects/types"
import { cn } from "@/lib/utils"

function ProjectStatusBadge({ status, className }: { status: ProjectStatusKey; className?: string }) {
  return (
    <Badge
      variant={projectStatusTone[status]}
      className={cn("rounded-md", status === "CANCELLED" && "text-muted-foreground", className)}
    >
      {projectStatusLabels[status]}
    </Badge>
  )
}

/** Only Urgent and High get a badge; Medium/Low stay quiet to keep the board calm. */
function PriorityBadge({ priority, always }: { priority: TaskPriorityKey; always?: boolean }) {
  if (!always && (priority === "MEDIUM" || priority === "LOW")) return null
  return (
    <Badge variant={taskPriorityTone[priority]} className="h-4.5 rounded-sm px-1.5 text-[11px]">
      {taskPriorityLabels[priority]}
    </Badge>
  )
}

function ProgressBar({ progress, label, className }: { progress: Progress; label: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <progress
        value={progress.done}
        max={Math.max(progress.total, 1)}
        aria-label={`${label}: ${progress.percent}% complete`}
        className="h-1.5 flex-1 appearance-none overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:bg-success [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-success"
      />
      <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{progress.percent}%</span>
    </div>
  )
}

/** Calendar deadline with overdue / due-today emphasis. */
function DueDate({ date, done, short = true, className }: { date: string | null; done?: boolean; short?: boolean; className?: string }) {
  if (!date) return null
  const state = done ? "upcoming" : dueState(date)
  return (
    <span
      suppressHydrationWarning
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        state === "overdue" ? "font-medium text-primary-strong" : state === "today" ? "font-medium text-warning" : "text-muted-foreground",
        className
      )}
    >
      <CalendarIcon aria-hidden className="size-3" />
      {state === "overdue" && <span className="sr-only">Overdue:</span>}
      {state === "today" ? "Today" : formatDateOnly(date, { short })}
    </span>
  )
}

export { DueDate, PriorityBadge, ProgressBar, ProjectStatusBadge }
