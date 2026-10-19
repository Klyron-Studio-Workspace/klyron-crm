"use client"

import { useActionState, useState } from "react"
import { XIcon, SendIcon, ChevronDownIcon } from "lucide-react"
import { sendMailAction } from "@/lib/actions/mail"
import type { FormState } from "@/lib/actions/state"
import { Button } from "@/components/ui/button"

const initial: NonNullable<FormState> = { values: {} }

type Props = {
  defaultTo?: string
  defaultSubject?: string
  inReplyToMessageId?: string
  onClose: () => void
}

export function ComposeDialog({ defaultTo = "", defaultSubject = "", inReplyToMessageId, onClose }: Props) {
  const [_state, action, pending] = useActionState(sendMailAction, initial)
  const state = _state ?? initial
  const [showCc, setShowCc] = useState(false)

  return (
    <>
      {/* Backdrop — click to close */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden
      />

      {/* Compose panel */}
      <div className="fixed bottom-4 right-4 z-50 flex w-[520px] max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-border bg-background shadow-2xl">
        {/* Title bar */}
        <div className="flex h-11 items-center justify-between rounded-t-xl border-b border-border bg-muted/40 px-4">
          <span className="text-sm font-semibold">
            {inReplyToMessageId ? "Reply" : "New message"}
          </span>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <form action={action} className="flex flex-col">
          {inReplyToMessageId && (
            <input type="hidden" name="inReplyToMessageId" value={inReplyToMessageId} />
          )}

          {/* To */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <span className="w-8 shrink-0 text-xs font-medium text-muted-foreground">To</span>
            <input
              name="to"
              defaultValue={state.values?.to ?? defaultTo}
              placeholder="Recipients"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              required
            />
            <button
              type="button"
              onClick={() => setShowCc((v) => !v)}
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
            >
              Cc
            </button>
          </div>

          {/* Cc (toggleable) */}
          {showCc && (
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
              <span className="w-8 shrink-0 text-xs font-medium text-muted-foreground">Cc</span>
              <input
                name="cc"
                defaultValue={state.values?.cc ?? ""}
                placeholder="Carbon copy"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}

          {/* Subject */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <span className="w-8 shrink-0 text-xs font-medium text-muted-foreground">Re</span>
            <input
              name="subject"
              defaultValue={state.values?.subject ?? defaultSubject}
              placeholder="Subject"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              required
            />
          </div>

          {/* Body */}
          <textarea
            name="body"
            defaultValue={state.values?.body ?? ""}
            placeholder="Write your message…"
            rows={12}
            className="resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
            required
          />

          {/* Error */}
          {(state.fieldErrors?.body ?? state.fieldErrors?.to) && (
            <p className="px-4 pb-1 text-xs text-destructive">
              {state.fieldErrors?.to?.[0] ?? state.fieldErrors?.body?.[0]}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <div className="flex items-center gap-2">
              {state.ok && (
                <p className="text-xs text-emerald-600 font-medium">{state.message}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Discard
              </Button>
              <Button type="submit" disabled={pending} size="sm" className="gap-1.5">
                <SendIcon className="size-3.5" />
                {pending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}
