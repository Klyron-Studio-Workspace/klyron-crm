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
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)
}

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

// Stable color from string — picks from a set of muted hues
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-teal-100 text-teal-700",
]
function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function ThreadList({ emails, selectedId }: Props) {
  if (emails.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-sm text-muted-foreground">No messages here</p>
      </div>
    )
  }

  return (
    <ul className="flex-1 overflow-y-auto">
      {emails.map((email) => {
        const date = email.receivedAt ?? email.sentAt
        const sender = email.fromName ?? email.fromAddress
        const color = avatarColor(email.fromAddress)
        const isSelected = selectedId === email.id

        return (
          <li key={email.id} className={`border-b border-border last:border-0 ${isSelected ? "bg-muted" : ""}`}>
            <a
              href={`/mail?id=${email.id}`}
              className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
            >
              {/* Avatar */}
              <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${color}`}>
                {initials(email.fromName, email.fromAddress)}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`truncate text-sm ${!email.read ? "font-semibold text-foreground" : "font-normal text-foreground/80"}`}>
                    {sender}
                  </p>
                  {date && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {relativeTime(new Date(date))}
                    </span>
                  )}
                </div>
                <p className={`truncate text-[13px] ${!email.read ? "text-foreground/90" : "text-muted-foreground"}`}>
                  {email.subject}
                </p>
              </div>

              {/* Unread dot + star */}
              <div className="flex shrink-0 flex-col items-center gap-2 pt-0.5">
                {!email.read && (
                  <span className="size-2 rounded-full bg-primary" />
                )}
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    starEmail(email.id, !email.starred)
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <StarIcon
                    className={`size-3.5 ${email.starred ? "fill-amber-400 text-amber-400 opacity-100!" : "text-muted-foreground"}`}
                  />
                </button>
              </div>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
