import { Suspense } from "react"
import type { Metadata } from "next"
import { MessagesSquareIcon } from "lucide-react"

import { StartCallButton } from "@/components/calls/start-call-button"
import { ThreadLoader, ThreadSkeleton } from "@/components/chat/thread-loader"
import { EmptyState } from "@/components/crm/empty-state"
import { can, requireClientUser } from "@/lib/auth/dal"
import { ensureClientChannel, findAccessibleChannel } from "@/lib/chat/access"

export const metadata: Metadata = { title: "Messages" }

/** The client's single conversation with the studio. */
export default async function PortalChatPage() {
  const user = await requireClientUser()
  const base = await ensureClientChannel(user.clientId)
  const channel = await findAccessibleChannel(user, base.id)
  if (!channel) {
    return <EmptyState icon={MessagesSquareIcon} title="Messages aren't available." description="Ask your Klyron contact if you need access." />
  }
  const canWrite = await can(user, "chat", "WRITE")

  return (
    <section data-full-height aria-label="Messages with Klyron Studio" className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border">
        <MessagesSquareIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <h1 className="truncate text-sm font-semibold">Messages with Klyron Studio</h1>
        {canWrite && <StartCallButton channelId={channel.id} className="ml-auto" />}
      </header>
      <Suspense fallback={<ThreadSkeleton />}>
      <ThreadLoader
        channelId={channel.id}
        currentUserId={user.id}
        canWrite={canWrite}
        canModerate={false}
        showClientBadge={false}
        placeholder="Message the Klyron team"
        emptyText="Ask a question, share feedback or send files. The team will reply here."
      />
      </Suspense>
    </section>
  )
}
