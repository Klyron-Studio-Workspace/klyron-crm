"use client"

import * as React from "react"
import { useActionState } from "react"
import { Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"
import { addReminder, deleteReminder, setReminderDone } from "@/lib/actions/leads"
import { formatDateTime, formatRelative } from "@/lib/format"
import type { PersonDTO, ReminderDTO } from "@/lib/leads/types"
import { cn } from "@/lib/utils"

/** "2026-10-08T10:00" for <input type="datetime-local">, in the browser's time zone. */
function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function tomorrowAt10() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return toLocalInput(d)
}

const subscribeNever = () => () => {}

function ReminderRow({ reminder, canWrite }: { reminder: ReminderDTO; canWrite: boolean }) {
  const toast = useToast()
  const [pending, startTransition] = React.useTransition()
  const [done, setDone] = React.useOptimistic(Boolean(reminder.completedAt))
  const due = new Date(reminder.dueAt)
  const overdue = !done && due < new Date()

  return (
    <li className="group/reminder flex items-start gap-3 py-2.5">
      <input
        type="checkbox"
        checked={done}
        disabled={!canWrite || pending}
        aria-label={`Mark "${reminder.note}" as ${done ? "not done" : "done"}`}
        onChange={(e) => {
          const next = e.target.checked
          startTransition(async () => {
            setDone(next)
            const result = await setReminderDone(reminder.id, next)
            if (!result.ok) toast.add({ type: "error", title: "Couldn't update follow-up", description: result.error })
          })
        }}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", done && "text-muted-foreground line-through")}>{reminder.note}</p>
        <p suppressHydrationWarning className={cn("text-xs", overdue ? "font-medium text-primary-strong" : "text-muted-foreground")}>
          <time suppressHydrationWarning dateTime={reminder.dueAt} title={formatDateTime(due)}>
            {overdue ? "Overdue · " : ""}
            {formatDateTime(due)} ({formatRelative(due)})
          </time>
          {reminder.assignee && ` · ${reminder.assignee.name}`}
        </p>
      </div>
      {canWrite && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Delete "${reminder.note}"`}
          className="text-muted-foreground opacity-0 group-hover/reminder:opacity-100 focus-visible:opacity-100"
          onClick={() =>
            startTransition(async () => {
              const result = await deleteReminder(reminder.id)
              if (!result.ok) toast.add({ type: "error", title: "Couldn't delete follow-up", description: result.error })
            })
          }
        >
          <Trash2Icon />
        </Button>
      )}
    </li>
  )
}

function ReminderForm({ leadId, members, currentUserId }: { leadId: string; members: PersonDTO[]; currentUserId: string }) {
  const [state, action, pending] = useActionState(addReminder, undefined)
  const [dueLocal, setDueLocal] = React.useState(tomorrowAt10)
  const dueIso = React.useMemo(() => {
    const d = new Date(dueLocal)
    return Number.isNaN(d.getTime()) ? "" : d.toISOString()
  }, [dueLocal])
  const errors = state?.fieldErrors
  const failed = Boolean(errors || state?.error)
  const items = members.map((m) => ({ value: m.id, label: m.id === currentUserId ? `${m.name} (you)` : m.name }))

  return (
    <form action={action} className="flex flex-col gap-2" noValidate>
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="dueAt" value={dueIso} />
      <Input
        key={failed ? "failed" : "fresh"}
        name="note"
        placeholder="e.g. Send revised proposal"
        aria-label="Follow-up"
        defaultValue={failed ? state?.values?.note : undefined}
        aria-invalid={errors?.note ? true : undefined}
        maxLength={255}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="datetime-local"
          aria-label="Due"
          value={dueLocal}
          onChange={(e) => setDueLocal(e.target.value)}
          aria-invalid={errors?.dueAt ? true : undefined}
        />
        <Select name="assigneeId" items={items} defaultValue={currentUserId}>
          <SelectTrigger aria-label="Assignee" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {(errors || state?.error) && (
        <p className="text-xs text-primary-strong">
          {errors?.note?.[0] ?? errors?.dueAt?.[0] ?? errors?.assigneeId?.[0] ?? state?.error}
        </p>
      )}
      <Button type="submit" size="sm" variant="secondary" disabled={pending} className="self-end">
        {pending ? "Scheduling…" : "Schedule follow-up"}
      </Button>
    </form>
  )
}

function FollowUps({
  leadId,
  reminders,
  members,
  currentUserId,
  canWrite,
}: {
  leadId: string
  reminders: ReminderDTO[]
  members: PersonDTO[]
  currentUserId: string
  canWrite: boolean
}) {
  // The default due time depends on the browser clock, so render the form after hydration.
  const isClient = React.useSyncExternalStore(subscribeNever, () => true, () => false)
  const open = reminders.filter((r) => !r.completedAt)
  const done = reminders.filter((r) => r.completedAt)
  return (
    <div className="flex flex-col gap-4">
      {canWrite && isClient && <ReminderForm leadId={leadId} members={members} currentUserId={currentUserId} />}
      {reminders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No follow-ups scheduled.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-t border-border">
          {[...open, ...done].map((r) => (
            <ReminderRow key={r.id} reminder={r} canWrite={canWrite} />
          ))}
        </ul>
      )}
    </div>
  )
}

export { FollowUps }
