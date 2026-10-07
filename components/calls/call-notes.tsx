"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, PencilIcon, PlusIcon, RefreshCwIcon, SparklesIcon, Trash2Icon } from "lucide-react"

import { FormAlert } from "@/components/forms/form-alert"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import { regenerateNotes, updateNotes } from "@/lib/actions/calls"
import type { ActionItem, CallDetailDTO } from "@/lib/calls/types"
import { formatDateTime } from "@/lib/format"

type CallNotesProps = {
  call: CallDetailDTO
  /** Team members can edit and regenerate; clients only read. */
  canEdit: boolean
}

function NotesEditor({ call, onDone }: { call: CallDetailDTO; onDone: () => void }) {
  const toast = useToast()
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [summary, setSummary] = React.useState(call.notes.summary ?? "")
  const [decisions, setDecisions] = React.useState<string[]>(call.notes.decisions)
  const [items, setItems] = React.useState<ActionItem[]>(call.notes.actionItems)

  function save() {
    startTransition(async () => {
      const result = await updateNotes(call.id, {
        summary,
        decisions: decisions.map((d) => d.trim()).filter(Boolean),
        actionItems: items.filter((i) => i.text.trim()).map((i) => ({ text: i.text, owner: i.owner?.trim() || null, due: i.due?.trim() || null })),
      })
      if (!result.ok) toast.add({ type: "error", title: "Couldn't save notes", description: result.error })
      else {
        toast.add({ type: "success", title: "Notes saved" })
        router.refresh()
        onDone()
      }
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="notes-summary" className="text-sm font-medium">Summary</label>
        <Textarea id="notes-summary" rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={4000} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Decisions</legend>
        {decisions.map((d, i) => (
          <div key={i} className="flex gap-2">
            <Input aria-label={`Decision ${i + 1}`} value={d} maxLength={500} onChange={(e) => setDecisions(decisions.map((x, j) => (j === i ? e.target.value : x)))} />
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove decision ${i + 1}`} onClick={() => setDecisions(decisions.filter((_, j) => j !== i))}>
              <Trash2Icon />
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => setDecisions([...decisions, ""])}>
          <PlusIcon data-icon="inline-start" /> Add decision
        </Button>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Action items</legend>
        {items.map((item, i) => {
          const update = (patch: Partial<ActionItem>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
          return (
            <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_8rem_auto]">
              <Input aria-label={`Action ${i + 1}`} value={item.text} maxLength={500} onChange={(e) => update({ text: e.target.value })} />
              <Input aria-label={`Action ${i + 1} owner`} placeholder="Owner" value={item.owner ?? ""} maxLength={120} onChange={(e) => update({ owner: e.target.value })} />
              <Input aria-label={`Action ${i + 1} due`} placeholder="Due" value={item.due ?? ""} maxLength={60} onChange={(e) => update({ due: e.target.value })} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove action ${i + 1}`} onClick={() => setItems(items.filter((_, j) => j !== i))}>
                <Trash2Icon />
              </Button>
            </div>
          )
        })}
        <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => setItems([...items, { text: "", owner: null, due: null }])}>
          <PlusIcon data-icon="inline-start" /> Add action item
        </Button>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button disabled={pending} onClick={save}>
          <CheckIcon data-icon="inline-start" />
          {pending ? "Saving…" : "Save notes"}
        </Button>
      </div>
    </div>
  )
}

function CallNotes({ call, canEdit }: CallNotesProps) {
  const toast = useToast()
  const router = useRouter()
  const [editing, setEditing] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const { notes } = call
  const hasTranscript = call.transcript.length > 0

  function regenerate() {
    startTransition(async () => {
      const result = await regenerateNotes(call.id)
      if (!result.ok) toast.add({ type: "error", title: "Couldn't generate notes", description: result.error })
      else toast.add({ type: "success", title: "Notes generated" })
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <SparklesIcon aria-hidden className="size-4 text-primary" />
          Meeting notes
        </CardTitle>
        <CardDescription>
          {call.notesStatus === "READY" && notes.generatedAt
            ? `Written by AI from the transcript${notes.model && notes.model !== "…" ? ` (${notes.model})` : ""}, ${formatDateTime(new Date(notes.generatedAt))}. Check before sharing.`
            : "Written by AI from the call transcript."}
        </CardDescription>
        {canEdit && !editing && (
          <CardAction className="flex gap-1">
            {call.notesStatus === "READY" && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <PencilIcon data-icon="inline-start" /> Edit
              </Button>
            )}
            {hasTranscript && call.status === "ENDED" && (
              <Button variant="ghost" size="sm" disabled={pending} onClick={regenerate}>
                <RefreshCwIcon data-icon="inline-start" className={pending ? "animate-spin" : undefined} />
                {call.notesStatus === "READY" ? "Regenerate" : "Generate notes"}
              </Button>
            )}
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <NotesEditor call={call} onDone={() => setEditing(false)} />
        ) : call.status === "ACTIVE" ? (
          <p className="text-sm text-muted-foreground">Notes are written when the call ends.</p>
        ) : call.notesStatus === "PENDING" || pending ? (
          <p className="text-sm text-muted-foreground">Writing notes from the transcript… this usually takes a few seconds. Refresh to see them.</p>
        ) : call.notesStatus === "FAILED" ? (
          <FormAlert tone="error">{notes.error ?? "Notes couldn't be generated."}</FormAlert>
        ) : call.notesStatus === "NONE" ? (
          <p className="text-sm text-muted-foreground">
            {hasTranscript ? "No notes yet." : "Nobody was transcribed on this call, so there are no notes. Transcription works in Chrome and Edge."}
          </p>
        ) : (
          <div className="flex flex-col gap-6 text-sm">
            {notes.summary && <p className="leading-relaxed whitespace-pre-wrap">{notes.summary}</p>}
            <section aria-labelledby="notes-decisions" className="flex flex-col gap-2">
              <h3 id="notes-decisions" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Decisions</h3>
              {notes.decisions.length ? (
                <ul className="flex list-disc flex-col gap-1 pl-5">
                  {notes.decisions.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              ) : (
                <p className="text-muted-foreground">None recorded.</p>
              )}
            </section>
            <section aria-labelledby="notes-actions" className="flex flex-col gap-2">
              <h3 id="notes-actions" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Action items</h3>
              {notes.actionItems.length ? (
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {notes.actionItems.map((a, i) => (
                    <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2">
                      <span>{a.text}</span>
                      <span className="text-xs text-muted-foreground">{[a.owner, a.due].filter(Boolean).join(" · ") || "Unassigned"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">None recorded.</p>
              )}
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { CallNotes }
