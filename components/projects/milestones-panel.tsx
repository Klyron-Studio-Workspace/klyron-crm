"use client"

import * as React from "react"
import { useActionState } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"

import { DueDate, ProgressBar } from "@/components/projects/project-bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { addMilestone, deleteMilestone, setMilestoneDone } from "@/lib/actions/projects"
import type { MilestoneDTO } from "@/lib/projects/types"
import { cn } from "@/lib/utils"

function MilestoneRow({ milestone, canWrite }: { milestone: MilestoneDTO; canWrite: boolean }) {
  const toast = useToast()
  const [pending, startTransition] = React.useTransition()
  const [done, setDone] = React.useOptimistic(Boolean(milestone.completedAt))

  function run(task: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await task()
      if (!result.ok) toast.add({ type: "error", title: "Couldn't update milestone", description: result.error })
    })
  }

  return (
    <li className="group/ms flex flex-col gap-2 py-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={done}
          disabled={!canWrite || pending}
          aria-label={`Mark ${milestone.name} as ${done ? "not reached" : "reached"}`}
          onChange={(e) => {
            const next = e.target.checked
            startTransition(async () => {
              setDone(next)
              const result = await setMilestoneDone(milestone.id, next)
              if (!result.ok) toast.add({ type: "error", title: "Couldn't update milestone", description: result.error })
            })
          }}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", done && "text-muted-foreground line-through")}>{milestone.name}</p>
          <DueDate date={milestone.dueDate} done={done} />
        </div>
        {canWrite && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Delete ${milestone.name}`}
            disabled={pending}
            className="text-muted-foreground opacity-0 group-hover/ms:opacity-100 focus-visible:opacity-100"
            onClick={() => run(() => deleteMilestone(milestone.id))}
          >
            <Trash2Icon />
          </Button>
        )}
      </div>
      {milestone.progress.total > 0 && <ProgressBar progress={milestone.progress} label={milestone.name} className="pl-7" />}
    </li>
  )
}

function AddMilestoneForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(addMilestone, undefined)
  const failed = Boolean(state?.fieldErrors || state?.error)
  return (
    <form action={action} className="flex flex-col gap-2" noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      <div className="flex gap-2">
        <Input
          key={failed ? "f" : "n"}
          name="name"
          placeholder="e.g. Design approved"
          aria-label="New milestone"
          maxLength={120}
          defaultValue={failed ? state?.values?.name : undefined}
          className="h-8 flex-1"
        />
        <Input key={failed ? "fd" : "nd"} name="dueDate" type="date" aria-label="Milestone date" defaultValue={failed ? state?.values?.dueDate : undefined} className="h-8 w-36" />
        <Button type="submit" size="icon-sm" variant="secondary" aria-label="Add milestone" disabled={pending}>
          <PlusIcon />
        </Button>
      </div>
      {(state?.fieldErrors || state?.error) && (
        <p className="text-xs text-primary-strong">{state?.fieldErrors?.name?.[0] ?? state?.fieldErrors?.dueDate?.[0] ?? state?.error}</p>
      )}
    </form>
  )
}

function MilestonesPanel({ projectId, milestones, canWrite }: { projectId: string; milestones: MilestoneDTO[]; canWrite: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {milestones.length === 0 ? (
        <p className="text-sm text-muted-foreground">No milestones yet. Add the checkpoints the client cares about.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border">
          {milestones.map((m) => (
            <MilestoneRow key={m.id} milestone={m} canWrite={canWrite} />
          ))}
        </ol>
      )}
      {canWrite && <AddMilestoneForm projectId={projectId} />}
    </div>
  )
}

export { MilestonesPanel }
