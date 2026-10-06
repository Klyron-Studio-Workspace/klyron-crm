import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BuildingIcon, HashIcon, UserIcon } from "lucide-react"

import { ChannelList } from "@/components/chat/channel-list"
import { MessageThread } from "@/components/chat/message-thread"
import { MobileChannels } from "@/components/chat/mobile-channels"
import { can, requirePermission } from "@/lib/auth/dal"
import { findAccessibleChannel } from "@/lib/chat/access"
import { getChannelList, getMessages } from "@/lib/chat/queries"
import { getAssignableMembers } from "@/lib/leads/queries"

export const metadata: Metadata = { title: "Chat" }

export default async function ChatPage({ params }: PageProps<"/chat/[channelId]">) {
  const user = await requirePermission("chat", "READ")
  const { channelId } = await params
  const channel = await findAccessibleChannel(user, channelId)
  if (!channel) notFound()

  const [channels, page, canWrite, members, canSeeClient] = await Promise.all([
    getChannelList(user),
    getMessages(channel.id),
    can(user, "chat", "WRITE"),
    getAssignableMembers(),
    can(user, "clients", "READ"),
  ])
  const current = channels.find((c) => c.id === channel.id)
  const title = current?.title ?? channel.name ?? "Chat"
  const listProps = {
    channels,
    activeId: channel.id,
    currentUserId: user.id,
    teammates: members.filter((m) => m.id !== user.id),
    canCreateChannel: user.role === "OWNER" || user.role === "ADMIN",
  }
  const Icon = channel.kind === "TEAM" ? HashIcon : channel.kind === "CLIENT" ? BuildingIcon : UserIcon
  const subtitle =
    channel.kind === "CLIENT"
      ? "Shared with the client. They see every message and file here."
      : channel.kind === "TEAM"
        ? "Team only. Clients never see this channel."
        : "Private conversation."

  return (
    // Full-height chat inside the page container.
    <div className="-mx-6 -my-6 grid h-[calc(100svh-3.5rem)] grid-cols-1 border-border md:grid-cols-[17rem_minmax(0,1fr)] lg:-mx-8 lg:-my-8">
      <aside className="hidden min-h-0 border-r border-border bg-sidebar md:flex md:flex-col">
        <ChannelList {...listProps} />
      </aside>
      <section aria-label={title} className="flex min-h-0 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <MobileChannels {...listProps} />
          <Icon aria-hidden className="size-4 text-muted-foreground" />
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">· {subtitle}</span>
          {channel.kind === "CLIENT" && channel.clientId && canSeeClient && (
            <Link href={`/clients/${channel.clientId}`} className="link ml-auto shrink-0 text-xs">
              Client page
            </Link>
          )}
        </header>
        <MessageThread
          key={channel.id}
          channelId={channel.id}
          initialMessages={page.messages}
          initialHasMore={page.hasMore}
          currentUserId={user.id}
          canWrite={canWrite}
          canModerate={user.role === "OWNER" || user.role === "ADMIN"}
          showClientBadge={channel.kind === "CLIENT"}
          placeholder={channel.kind === "CLIENT" ? `Message ${title} (the client will see this)` : `Message ${title}`}
          emptyText={channel.kind === "CLIENT" ? `Start the conversation with ${title}.` : "No messages yet. Say hello."}
        />
      </section>
    </div>
  )
}
