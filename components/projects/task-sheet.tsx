"use client"

import * as React from "react"
import { useActionState } from "react"
import { Trash2Icon } from "lucide-react"

import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { SelectField } from "@/components/forms/select-field"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import { deleteTask, updateTask } from "@/lib/actions/projects"
import type { PersonDTO } from "@/lib/leads/types"
import { taskPriorities, taskPriorityLabels, taskStatuses, taskStatusLabels } from "@/lib/projects/constants"
import type { MilestoneDTO, TaskDTO } from "@/lib/projects/types"

type TaskSheetProps = {
  task: TaskDTO | null
  members: PersonDTO[]
  milestones: MilestoneDTO[]
  canWrite: boolean
  onClose: () => void
}

function TaskForm({ task, members, milestones, canWrite, onClose }: Omit<TaskSheetProps, "task"> & { task: TaskDTO }) {
  const toast = useToast()
  const [state, action, pending] = useActionState(updateTask, undefined)
  const [deleting, startDelete] = React.useTransition()
  const errors = state?.fieldErrors
  const echoed = state?.values
  const v = {
    title: echoed?.title ?? task.title,
    description: echoed?.description ?? task.description ?? "",
    status: echoed?.status ?? task.status,
    priority: echoed?.priority ?? task.priority,
    assigneeId: echoed?.assigneeId ?? task.assignee?.id ?? "none",
    milestoneId: echoed?.milestoneId ?? task.milestoneId ?? "none",
    dueDate: echoed?.dueDate ?? task.dueDate ?? "",
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-5 px-4 pb-6">
      <input type="hidden" name="taskId" value={task.id} />
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state?.ok && <FormAlert tone="success">{state.message}</FormAlert>}
      <fieldset key={JSON.stringify(echoed ?? task)} disabled={!canWrite} className="flex flex-col gap-4">
        <FormField label="Title" name="title" defaultValue={v.title} required errors={errors?.title} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Status"
            name="status"
            id="task-status"
            value={v.status}
            items={taskStatuses.map((s) => ({ value: s, label: taskStatusLabels[s] }))}
          />
          <SelectField
            label="Priority"
            name="priority"
            id="task-priority"
            value={v.priority}
            items={taskPriorities.map((p) => ({ value: p, label: taskPriorityLabels[p] }))}
          />
          <SelectField
            label="Assignee"
            name="assigneeId"
            id="task-assignee"
            value={v.assigneeId}
            items={[{ value: "none", label: "Unassigned" }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
            error={errors?.assigneeId?.[0]}
          />
          <FormField label="Due date" name="dueDate" type="date" defaultValue={v.dueDate} errors={errors?.dueDate} />
        </div>
        <SelectField
          label="Milestone"
          name="milestoneId"
          id="task-milestone"
          value={v.milestoneId}
          items={[{ value: "none", label: "No milestone" }, ...milestones.map((m) => ({ value: m.id, label: m.name }))]}
          error={errors?.milestoneId?.[0]}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="task-description">Notes</Label>
          <Textarea id="task-description" name="description" defaultValue={v.description} className="min-h-32" placeholder="Details, links, acceptance criteria…" />
        </div>
      </fieldset>
      {canWrite && (
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={deleting}
            className="text-muted-foreground hover:text-primary-strong"
            onClick={() =>
              startDelete(async () => {
                const result = await deleteTask(task.id)
                if (!result.ok) toast.add({ type: "error", title: "Couldn't delete task", description: result.error })
                else onClose()
              })
            }
          >
            <Trash2Icon data-icon="inline-start" />
            Delete
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save task"}
          </Button>
        </div>
      )}
    </form>
  )
}

function TaskSheet({ task, onClose, ...props }: TaskSheetProps) {
  return (
    <Sheet open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg!">
        <SheetHeader>
          <SheetTitle>Task</SheetTitle>
          <SheetDescription>{task?.title}</SheetDescription>
        </SheetHeader>
        {task && <TaskForm key={task.id} task={task} onClose={onClose} {...props} />}
      </SheetContent>
    </Sheet>
  )
}

export { TaskSheet }
