import Link from "next/link"
import { MailIcon, ArrowUpRightIcon, ArrowDownLeftIcon } from "lucide-react"

type EmailRow = {
  id: string
  subject: string
  fromAddress: string
  fromName: string | null
  direction: "INBOUND" | "OUTBOUND"
  read: boolean
  receivedAt: Date | null
  sentAt: Date | null
}

type Props = {
  emails: EmailRow[]
  composeHref: string
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)
}

export function EmailsTab({ emails, composeHref }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Emails</h3>
        <Link
          href={composeHref}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
        >
          <MailIcon className="size-3.5" /> Send email
        </Link>
      </div>

      {emails.length === 0 ? (
        <p className="text-sm text-muted-foreground">No emails yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {emails.map((email) => {
            const date = email.receivedAt ?? email.sentAt
            return (
              <li key={email.id}>
                <Link
                  href={`/mail?id=${email.id}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  {email.direction === "INBOUND" ? (
                    <ArrowDownLeftIcon className="mt-0.5 size-4 shrink-0 text-blue-500" />
                  ) : (
                    <ArrowUpRightIcon className="mt-0.5 size-4 shrink-0 text-green-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${!email.read ? "font-semibold" : ""}`}>
                      {email.subject}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {email.fromName ?? email.fromAddress}
                    </p>
                  </div>
                  {date && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {relativeTime(new Date(date))}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
