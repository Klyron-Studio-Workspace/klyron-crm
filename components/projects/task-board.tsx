"use client"

import * as React from "react"
import { useActionState } from "react"
import { FlagIcon, PlusIcon } from "lucide-react"

import { DueDate, PriorityBadge } from "@/components/projects/project-bits"
import { TaskSheet } from "@/components/projects/task-sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { moveTask, quickAddTask } from "@/lib/actions/projects"
import { initials } from "@/lib/format"
import type { PersonDTO } from "@/lib/leads/types"
import { taskStatuses, taskStatusLabels, type TaskStatusKey } from "@/lib/projects/constants"
import type { MilestoneDTO, TaskDTO } from "@/lib/projects/types"
import { cn } from "@/lib/utils"

type Move = { taskId: string; status: TaskStatusKey; beforeTaskId: string | null }

function applyMove(tasks: TaskDTO[], move: Move): TaskDTO[] {
  const moving = tasks.find((t) => t.id === move.taskId)
  if (!moving) return tasks
  const rest = tasks.filter((t) => t.id !== move.taskId)
  const moved = { ...moving, status: move.status }
  const index = move.beforeTaskId ? rest.findIndex((t) => t.id === move.beforeTaskId) : -1
  if (index === -1) return [...rest, moved]
  return [...rest.slice(0, index), moved, ...rest.slice(index)]
}

function QuickAdd({ projectId, status }: { projectId: string; status: TaskStatusKey }) {
  const [state, action, pending] = useActionState(quickAddTask, undefined)
  const [open, setOpen] = React.useState(false)
  const failed = Boolean(state?.fieldErrors || state?.error)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <PlusIcon aria-hidden className="size-4" />
        Add task
      </button>
    )
  }
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="status" value={status} />
      <Input
        key={failed ? "failed" : "fresh"}
        name="title"
        autoFocus
        placeholder="Task title, then Enter"
        aria-label={`New task in ${taskStatusLabels[status]}`}
        maxLength={200}
        disabled={pending}
        defaultValue={failed ? state?.values?.title : undefined}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        onBlur={(e) => !e.currentTarget.value && setOpen(false)}
        className="h-8"
      />
      {state?.fieldErrors?.title && <p className="text-xs text-primary-strong">{state.fieldErrors.title[0]}</p>}
    </form>
  )
}

function TaskCard({
  task,
  milestone,
  canWrite,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  task: TaskDTO
  milestone: MilestoneDTO | undefined
  canWrite: boolean
  dragging: boolean
  onOpen: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}) {
  const done = task.status === "DONE"
  return (
    <article
      data-task-id={task.id}
      draggable={canWrite}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "relative rounded-lg border border-border bg-card p-3 shadow-xs transition-[border-color,opacity] duration-150 ease-out hover:border-input",
        canWrite && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-40"
      )}
    >
      <button
        type="button"
        draggable={false}
        onClick={onOpen}
        className={cn(
          "block w-full text-left text-sm font-medium outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring",
          done && "text-muted-foreground line-through"
        )}
      >
        {task.title}
      </button>
      {(task.priority === "URGENT" || task.priority === "HIGH" || task.dueDate || task.assignee || milestone) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!done && <PriorityBadge priority={task.priority} />}
          <DueDate date={task.dueDate} done={done} />
          {milestone && (
            <span className="inline-flex max-w-32 items-center gap-1 truncate text-xs text-muted-foreground">
              <FlagIcon aria-hidden className="size-3 shrink-0" />
              {milestone.name}
            </span>
          )}
          {task.assignee && (
            <Avatar size="sm" className="ml-auto size-5" title={task.assignee.name}>
              <AvatarFallback className="text-[9px] font-medium">{initials(task.assignee.name)}</AvatarFallback>
            </Avatar>
          )}
        </div>
      )}
    </article>
  )
}

type TaskBoardProps = {
  projectId: string
  tasks: TaskDTO[]
  members: PersonDTO[]
  milestones: MilestoneDTO[]
  canWrite: boolean
}

function TaskBoard({ projectId, tasks, members, milestones, canWrite }: TaskBoardProps) {
  const toast = useToast()
  const [optimistic, addOptimisticMove] = React.useOptimistic(tasks, applyMove)
  const [, startTransition] = React.useTransition()
  const [draggingId, setDraggingId] = React.useState<string | null>(null)
  const [dropTarget, setDropTarget] = React.useState<{ status: TaskStatusKey; beforeTaskId: string | null } | null>(null)
  const [openTaskId, setOpenTaskId] = React.useState<string | null>(null)
  const milestoneById = new Map(milestones.map((m) => [m.id, m]))
  const openTask = optimistic.find((t) => t.id === openTaskId) ?? null

  function commitMove(move: Move) {
    const task = optimistic.find((t) => t.id === move.taskId)
    if (!task || (task.status === move.status && move.beforeTaskId === task.id)) return
    startTransition(async () => {
      addOptimisticMove(move)
      const result = await moveTask(move.taskId, move.status, move.beforeTaskId)
      if (!result.ok) toast.add({ type: "error", title: "Couldn't move task", description: result.error })
    })
  }

  function handleDragOver(e: React.DragEvent, status: TaskStatusKey) {
    if (!draggingId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    const cards = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-task-id]"))
    const before = cards.find((card) => {
      const rect = card.getBoundingClientRect()
      return e.clientY < rect.top + rect.height / 2
    })
    const beforeTaskId = before?.dataset.taskId ?? null
    if (dropTarget?.status !== status || dropTarget.beforeTaskId !== beforeTaskId) setDropTarget({ status, beforeTaskId })
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        {taskStatuses.map((status) => {
          const column = optimistic.filter((t) => t.status === status)
          const isTarget = dropTarget?.status === status
          return (
            <section
              key={status}
              aria-label={`${taskStatusLabels[status]}, ${column.length} tasks`}
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                const taskId = e.dataTransfer.getData("text/plain") || draggingId
                if (taskId) commitMove({ taskId, status, beforeTaskId: dropTarget?.beforeTaskId ?? null })
                setDropTarget(null)
                setDraggingId(null)
              }}
              className={cn(
                "flex min-h-48 flex-col gap-2 rounded-xl border border-border bg-surface p-2 transition-colors duration-150 ease-out",
                isTarget && "border-primary/40 bg-primary-tint"
              )}
            >
              <header className="flex items-center gap-2 px-1.5 pt-1 pb-1">
                <h3 className="text-sm font-semibold">{taskStatusLabels[status]}</h3>
                <span className="text-xs text-muted-foreground tabular-nums">{column.length}</span>
              </header>
              {column.map((task) => (
                <React.Fragment key={task.id}>
                  {isTarget && dropTarget?.beforeTaskId === task.id && draggingId !== task.id && (
                    <div aria-hidden className="h-0.5 rounded-full bg-primary" />
                  )}
                  <TaskCard
                    task={task}
                    milestone={task.milestoneId ? milestoneById.get(task.milestoneId) : undefined}
                    canWrite={canWrite}
                    dragging={draggingId === task.id}
                    onOpen={() => setOpenTaskId(task.id)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", task.id)
                      e.dataTransfer.effectAllowed = "move"
                      setDraggingId(task.id)
                    }}
                    onDragEnd={() => {
                      setDraggingId(null)
                      setDropTarget(null)
                    }}
                  />
                </React.Fragment>
              ))}
              {isTarget && dropTarget?.beforeTaskId === null && <div aria-hidden className="h-0.5 rounded-full bg-primary" />}
              {canWrite && <QuickAdd projectId={projectId} status={status} />}
            </section>
          )
        })}
      </div>
      <TaskSheet task={openTask} members={members} milestones={milestones} canWrite={canWrite} onClose={() => setOpenTaskId(null)} />
    </>
  )
}

export { TaskBoard }
