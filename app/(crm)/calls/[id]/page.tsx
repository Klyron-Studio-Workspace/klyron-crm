import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CallDetail } from "@/components/calls/call-detail"
import { can, requirePermission } from "@/lib/auth/dal"
import { getCallDetail } from "@/lib/calls/queries"

export const metadata: Metadata = { title: "Call" }

export default async function CallPage({ params }: PageProps<"/calls/[id]">) {
  const user = await requirePermission("chat", "READ")
  const { id } = await params
  const [call, canWrite] = await Promise.all([getCallDetail(user, id), can(user, "chat", "WRITE")])
  if (!call) notFound()
  const startedByMe = call.startedById === user.id
  return (
    <CallDetail
      call={call}
      backHref={`/chat/${call.channel.id}`}
      backLabel="Back to chat"
      canJoin={canWrite}
      canEditNotes={canWrite}
      canEndForEveryone={canWrite && (startedByMe || user.role === "OWNER" || user.role === "ADMIN")}
    />
  )
}
