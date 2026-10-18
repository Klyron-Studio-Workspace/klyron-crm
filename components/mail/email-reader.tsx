"use client"

import { ArchiveIcon, Trash2Icon, ReplyIcon } from "lucide-react"
import { moveEmail } from "@/lib/actions/mail"
import { useState } from "react"
import { ComposeDialog } from "@/components/mail/compose-dialog"

type FullEmail = {
  id: string
  subject: string
  fromAddress: string
  fromName: string | null
  toAddresses: unknown
  bodyHtml: string | null
  bodyText: string | null
  receivedAt: Date | null
  sentAt: Date | null
  messageId: string
}

type Props = { email: FullEmail | null }

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)
}

export function EmailReader({ email }: Props) {
  const [composing, setComposing] = useState(false)

  if (!email) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Select a message to read
      </div>
    )
  }

  const date = email.receivedAt ?? email.sentAt

  return (
    <div className="flex flex-1 flex-col overflow-hidden border-l">
      <div className="flex items-start justify-between gap-4 border-b p-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold truncate">{email.subject}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress}
            {date && ` · ${relativeTime(new Date(date))}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setComposing(true)}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <ReplyIcon className="size-3.5" /> Reply
          </button>
          <button
            onClick={() => moveEmail(email.id, "ARCHIVE")}
            className="rounded-md border p-1.5 hover:bg-muted"
            title="Archive"
          >
            <ArchiveIcon className="size-4" />
          </button>
          <button
            onClick={() => moveEmail(email.id, "TRASH")}
            className="rounded-md border p-1.5 hover:bg-muted text-destructive"
            title="Trash"
          >
            <Trash2Icon className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {email.bodyHtml ? (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
          />
        ) : (
          <pre className="whitespace-pre-wrap text-sm font-sans">{email.bodyText}</pre>
        )}
      </div>

      {composing && (
        <ComposeDialog
          defaultTo={email.fromAddress}
          defaultSubject={`Re: ${email.subject}`}
          inReplyToMessageId={email.messageId}
          onClose={() => setComposing(false)}
        />
      )}
    </div>
  )
}
