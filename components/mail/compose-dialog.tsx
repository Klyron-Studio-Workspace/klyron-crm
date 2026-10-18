"use client"

import { useActionState } from "react"
import { XIcon, SendIcon } from "lucide-react"
import { sendMailAction } from "@/lib/actions/mail"

const initial = { values: {} }

type Props = {
  defaultTo?: string
  defaultSubject?: string
  inReplyToMessageId?: string
  onClose: () => void
}

export function ComposeDialog({ defaultTo = "", defaultSubject = "", inReplyToMessageId, onClose }: Props) {
  const [state, action, pending] = useActionState(sendMailAction, initial)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-6">
      <div className="w-full max-w-lg rounded-xl border bg-background shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">New message</span>
          <button onClick={onClose}><XIcon className="size-4" /></button>
        </div>

        <form action={action} className="flex flex-col gap-0">
          {inReplyToMessageId && (
            <input type="hidden" name="inReplyToMessageId" value={inReplyToMessageId} />
          )}

          <div className="border-b px-4 py-2">
            <input
              name="to"
              defaultValue={state.values?.to ?? defaultTo}
              placeholder="To"
              className="w-full bg-transparent text-sm outline-none"
              required
            />
          </div>
          <div className="border-b px-4 py-2">
            <input
              name="subject"
              defaultValue={state.values?.subject ?? defaultSubject}
              placeholder="Subject"
              className="w-full bg-transparent text-sm outline-none"
              required
            />
          </div>
          <textarea
            name="body"
            defaultValue={state.values?.body ?? ""}
            placeholder="Write your message…"
            rows={10}
            className="flex-1 resize-none bg-transparent px-4 py-3 text-sm outline-none"
            required
          />

          {state.fieldErrors?.body && (
            <p className="px-4 pb-2 text-xs text-destructive">{state.fieldErrors.body[0]}</p>
          )}

          <div className="flex items-center justify-between border-t px-4 py-3">
            {state.ok && <p className="text-xs text-green-600">{state.message}</p>}
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm hover:bg-muted">
                Discard
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-1.5 rounded-md bg-[#DC143C] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                <SendIcon className="size-3.5" />
                {pending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
