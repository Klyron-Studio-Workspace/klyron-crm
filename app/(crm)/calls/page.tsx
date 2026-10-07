import type { Metadata } from "next"
import Link from "next/link"
import { SparklesIcon, VideoIcon } from "lucide-react"

import { EmptyState } from "@/components/crm/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { requirePermission } from "@/lib/auth/dal"
import { isCallsConfigured } from "@/lib/calls/livekit"
import { isNotesConfigured } from "@/lib/calls/notes"
import { getCallHistory } from "@/lib/calls/queries"
import { FormAlert } from "@/components/forms/form-alert"
import { formatDateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Calls" }

function minutes(start: string, end: string | null) {
  if (!end) return null
  const m = Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 60000))
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`
}

export default async function CallsPage() {
  const user = await requirePermission("chat", "READ")
  const calls = await getCallHistory(user)
  const setup = [!isCallsConfigured() && "LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET", !isNotesConfigured() && "GROQ_API_KEY"].filter(Boolean)

  return (
    <>
      <PageHeader title="Calls" description="Video calls from your chats, with AI meeting notes. Start one with “Call” in any conversation." />
      {setup.length > 0 && user.role !== "MEMBER" && (
        <FormAlert tone="error">Not fully set up: add {setup.join(" and ")} to .env.</FormAlert>
      )}
      {calls.length === 0 ? (
        <EmptyState icon={VideoIcon} title="No calls yet." description="Open a chat and press “Call”. Everyone in the conversation can join." />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {calls.map((call) => (
            <li key={call.id} className="relative flex flex-col gap-1.5 px-5 py-4 hover:bg-muted/40">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/calls/${call.id}`} className="font-medium after:absolute after:inset-0">
                  {call.title}
                </Link>
                {call.status === "ACTIVE" && <Badge variant="brand" className="rounded-md">Live</Badge>}
                {call.notesStatus === "READY" && (
                  <Badge variant="neutral" className="rounded-md">
                    <SparklesIcon /> Notes
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {[call.channel.title, formatDateTime(new Date(call.startedAt)), minutes(call.startedAt, call.endedAt), call.participants.map((p) => p.name).join(", ")]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {call.summary && <p className="line-clamp-2 text-sm text-muted-foreground">{call.summary}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
