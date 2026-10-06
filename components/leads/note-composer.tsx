"use client"

import * as React from "react"
import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { addLeadNote } from "@/lib/actions/leads"
import { noteTypeLabels, noteTypes, type NoteTypeKey } from "@/lib/leads/constants"
import { cn } from "@/lib/utils"

const placeholders: Record<NoteTypeKey, string> = {
  NOTE: "Add a note about this lead…",
  CALL: "What was discussed on the call?",
  MEETING: "Meeting summary, decisions and next steps…",
  EMAIL: "Paste or summarize the email…",
}

function NoteComposer({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState(addLeadNote, undefined)
  const [type, setType] = React.useState<NoteTypeKey>("NOTE")
  const failed = Boolean(state?.fieldErrors || state?.error)

  return (
    <form action={action} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-xs">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="type" value={type} />
      <div role="radiogroup" aria-label="Entry type" className="flex gap-1">
        {noteTypes.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => setType(t)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              type === t && "bg-muted text-foreground"
            )}
          >
            {noteTypeLabels[t]}
          </button>
        ))}
      </div>
      <Textarea
        key={failed ? "failed" : "fresh"}
        name="body"
        required
        aria-label={`${noteTypeLabels[type]} text`}
        placeholder={placeholders[type]}
        defaultValue={failed ? state?.values?.body : undefined}
        className="min-h-20 resize-y border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit()
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-xs", state?.fieldErrors?.body ? "text-primary-strong" : "text-muted-foreground")}>
          {state?.fieldErrors?.body?.[0] ?? state?.error ?? "Ctrl + Enter to save"}
        </p>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : `Add ${noteTypeLabels[type].toLowerCase()}`}
        </Button>
      </div>
    </form>
  )
}

export { NoteComposer }
