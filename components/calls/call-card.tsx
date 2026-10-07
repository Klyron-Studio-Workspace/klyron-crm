"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PhoneIcon, PhoneOffIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { CallCardDTO } from "@/lib/chat/types"
import { formatTime } from "@/lib/format"

function duration(startedAt: string, endedAt: string) {
  const minutes = Math.max(1, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 60000))
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

/** "Started a call" chat message: join while live, notes once it's over. */
function CallCard({ call }: { call: CallCardDTO }) {
  const portal = usePathname().startsWith("/portal")
  const href = `${portal ? "/portal/calls" : "/calls"}/${call.id}`
  const live = call.status === "ACTIVE"
  return (
    <div className="mt-1 flex w-full max-w-sm items-center gap-3 rounded-lg border border-border bg-card p-3">
      <span className={live ? "flex size-9 items-center justify-center rounded-full bg-primary-tint text-primary-strong" : "flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground"}>
        {live ? <PhoneIcon aria-hidden className="size-4" /> : <PhoneOffIcon aria-hidden className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{call.title}</p>
        <p className="text-xs text-muted-foreground">
          {live
            ? "In progress"
            : call.endedAt
              ? `Ended ${formatTime(new Date(call.endedAt))} · ${duration(call.startedAt, call.endedAt)}`
              : "Ended"}
          {call.notesStatus === "READY" && " · notes ready"}
          {call.notesStatus === "PENDING" && " · writing notes…"}
        </p>
      </div>
      {live ? (
        <Button size="sm" nativeButton={false} render={<Link href={href} />}>
          Join
        </Button>
      ) : (
        <Button size="sm" variant="secondary" nativeButton={false} render={<Link href={href} />}>
          {call.notesStatus === "READY" && <SparklesIcon data-icon="inline-start" />}
          {call.notesStatus === "READY" ? "Notes" : "Details"}
        </Button>
      )}
    </div>
  )
}

export { CallCard }
