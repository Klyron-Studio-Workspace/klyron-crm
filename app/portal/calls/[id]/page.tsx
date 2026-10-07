import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CallDetail } from "@/components/calls/call-detail"
import { can, requireClientUser } from "@/lib/auth/dal"
import { getCallDetail } from "@/lib/calls/queries"

export const metadata: Metadata = { title: "Call" }

export default async function PortalCallPage({ params }: PageProps<"/portal/calls/[id]">) {
  const user = await requireClientUser()
  const { id } = await params
  const [call, canWrite] = await Promise.all([getCallDetail(user, id), can(user, "chat", "WRITE")])
  if (!call) notFound()
  return (
    <CallDetail
      call={call}
      backHref="/portal/chat"
      backLabel="Back to messages"
      canJoin={canWrite}
      canEditNotes={false}
      canEndForEveryone={false}
    />
  )
}
