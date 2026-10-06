import type { Metadata } from "next"
import { MessagesSquareIcon } from "lucide-react"

import { MessageThread } from "@/components/chat/message-thread"
import { EmptyState } from "@/components/crm/empty-state"
import { can, requireClientUser } from "@/lib/auth/dal"
import { ensureClientChannel, findAccessibleChannel } from "@/lib/chat/access"
import { getMessages } from "@/lib/chat/queries"

export const metadata: Metadata = { title: "Messages" }

/** The client's single conversation with the studio. */
export default async function PortalChatPage() {
  const user = await requireClientUser()
  const base = await ensureClientChannel(user.clientId)
  const channel = await findAccessibleChannel(user, base.id)
  if (!channel) {
    return <EmptyState icon={MessagesSquareIcon} title="Messages aren't available." description="Ask your Klyron contact if you need access." />
  }
  const [page, canWrite] = await Promise.all([getMessages(channel.id), can(user, "chat", "WRITE")])

  return (
    <section aria-label="Messages with Klyron Studio" className="-my-8 flex h-[calc(100svh-3.5rem)] flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border">
        <MessagesSquareIcon aria-hidden className="size-4 text-muted-foreground" />
        <h1 className="text-sm font-semibold">Messages with Klyron Studio</h1>
      </header>
      <MessageThread
        channelId={channel.id}
        initialMessages={page.messages}
        initialHasMore={page.hasMore}
        currentUserId={user.id}
        canWrite={canWrite}
        canModerate={false}
        showClientBadge={false}
        placeholder="Message the Klyron team"
        emptyText="Ask a question, share feedback or send files. The team will reply here."
      />
    </section>
  )
}
