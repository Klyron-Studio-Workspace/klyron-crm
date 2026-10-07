import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { CallNotes } from "@/components/calls/call-notes"
import { CallRoom } from "@/components/calls/call-room"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CallDetailDTO } from "@/lib/calls/types"
import { formatDateTime } from "@/lib/format"

const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })

type CallDetailProps = {
  call: CallDetailDTO
  backHref: string
  backLabel: string
  canEditNotes: boolean
  canEndForEveryone: boolean
  canJoin: boolean
}

/** Live room while the call runs; notes, attendees and transcript afterwards. */
function CallDetail({ call, backHref, backLabel, canEditNotes, canEndForEveryone, canJoin }: CallDetailProps) {
  const live = call.status === "ACTIVE"
  if (live && canJoin) {
    // In the call: one compact line, so the video gets the room.
    return (
      <>
        <div className="flex min-w-0 items-center gap-3">
          <Link href={backHref} aria-label={backLabel} className="rounded-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon aria-hidden className="size-4" />
          </Link>
          <h1 className="truncate font-heading text-lg font-semibold tracking-tight">{call.title}</h1>
          <Badge variant="brand" className="rounded-md">Live</Badge>
          <span className="hidden truncate text-sm text-muted-foreground sm:inline">{call.channel.title}</span>
        </div>
        <CallRoom callId={call.id} title={call.title} canEndForEveryone={canEndForEveryone} afterHref={backHref} />
      </>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href={backHref} className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon aria-hidden className="size-4" />
          {backLabel}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{call.title}</h1>
          <Badge variant={live ? "brand" : "neutral"} className="rounded-md">{live ? "Live" : "Ended"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {[call.channel.title, call.startedBy ? `Started by ${call.startedBy}` : null, formatDateTime(new Date(call.startedAt))].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <CallNotes call={call} canEdit={canEditNotes} />
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">Attended</CardTitle>
            </CardHeader>
            <CardContent>
              {call.participants.length ? (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {call.participants.map((p) => <li key={p.id}>{p.name}</li>)}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nobody joined.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              {call.transcript.length === 0 ? (
                <p className="text-sm text-muted-foreground">No transcript.</p>
              ) : (
                <ol className="flex max-h-[32rem] flex-col gap-2.5 overflow-y-auto pr-1 text-sm">
                  {call.transcript.map((line) => (
                    <li key={line.id}>
                      <span className="font-medium">{line.speakerName}</span>{" "}
                      <time suppressHydrationWarning className="text-xs text-muted-foreground tabular-nums">{clock.format(new Date(line.spokenAt))}</time>
                      <p>{line.text}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

export { CallDetail }
