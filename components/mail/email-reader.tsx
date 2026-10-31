"use client"

import Link from "next/link"
import { ArchiveIcon, ArrowLeftIcon, Trash2Icon, ReplyIcon, MailIcon } from "lucide-react"
import { moveEmail } from "@/lib/actions/mail"
import { useState } from "react"
import { ComposeDialog } from "@/components/mail/compose-dialog"
import { Button } from "@/components/ui/button"

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

type Props = { email: FullEmail | null; backHref: string }

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(date)
}

export function EmailReader({ email, backHref }: Props) {
  const [composing, setComposing] = useState(false)

  if (!email) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <MailIcon className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Select a message to read</p>
      </div>
    )
  }

  const date = email.receivedAt ?? email.sentAt

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-2 md:gap-4 md:px-4">
        <Button variant="ghost" size="icon-sm" aria-label="Back to the list" className="md:hidden" nativeButton={false} render={<Link href={backHref} />}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{email.subject}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setComposing(true)} className="gap-1.5">
            <ReplyIcon className="size-4" />
            <span className="max-md:sr-only">Reply</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => moveEmail(email.id, "ARCHIVE")}
            title="Archive"
          >
            <ArchiveIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => moveEmail(email.id, "TRASH")}
            title="Move to trash"
            className="text-destructive hover:text-destructive"
          >
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Sender meta */}
      <div className="border-b border-border px-4 py-4 md:px-6">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
            {(email.fromName ?? email.fromAddress).slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">
              {email.fromName ?? email.fromAddress}
            </p>
            {email.fromName && (
              <p className="text-xs text-muted-foreground">{email.fromAddress}</p>
            )}
            {date && (
              <p className="mt-0.5 text-xs text-muted-foreground">{relativeTime(new Date(date))}</p>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
        {email.bodyHtml ? (
          <div
            className="prose prose-sm max-w-none text-foreground [&_a]:text-primary [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
            {email.bodyText}
          </pre>
        )}
      </div>

      {/* Inline reply hint */}
      <div className="border-t border-border px-4 py-3 md:px-6">
        <button
          onClick={() => setComposing(true)}
          className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          <ReplyIcon className="size-4 shrink-0" />
          Reply to {email.fromName ?? email.fromAddress}…
        </button>
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
