"use client"

import { StarIcon } from "lucide-react"
import { starEmail } from "@/lib/actions/mail"

type EmailRow = {
  id: string
  subject: string
  fromAddress: string
  fromName: string | null
  read: boolean
  starred: boolean
  receivedAt: Date | null
  sentAt: Date | null
  direction: "INBOUND" | "OUTBOUND"
}

type Props = {
  emails: EmailRow[]
  selectedId: string | null
}

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

export function ThreadList({ emails, selectedId }: Props) {
  if (emails.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No messages
      </div>
    )
  }

  return (
    <ul className="flex-1 overflow-y-auto divide-y">
      {emails.map((email) => {
        const date = email.receivedAt ?? email.sentAt
        return (
          <li key={email.id}>
            <a
              href={`/mail?id=${email.id}`}
              className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
                selectedId === email.id ? "bg-muted" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-sm ${!email.read ? "font-semibold" : "font-normal"}`}>
                    {email.fromName ?? email.fromAddress}
                  </p>
                  {date && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {relativeTime(new Date(date))}
                    </span>
                  )}
                </div>
                <p className={`truncate text-sm ${!email.read ? "text-foreground" : "text-muted-foreground"}`}>
                  {email.subject}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  starEmail(email.id, !email.starred)
                }}
                className="shrink-0 mt-0.5"
              >
                <StarIcon
                  className={`size-4 ${email.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-400"}`}
                />
              </button>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
