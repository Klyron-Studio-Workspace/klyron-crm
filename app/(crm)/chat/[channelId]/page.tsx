import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BuildingIcon, HashIcon, LockIcon, UserIcon } from "lucide-react"

import { StartCallButton } from "@/components/calls/start-call-button"
import { GroupPanel } from "@/components/chat/group-panel"
import { ChannelList } from "@/components/chat/channel-list"
import { MobileChannels } from "@/components/chat/mobile-channels"
import { ThreadLoader, ThreadSkeleton } from "@/components/chat/thread-loader"
import { can, requirePermission } from "@/lib/auth/dal"
import { findAccessibleChannel } from "@/lib/chat/access"
import { getChannelList } from "@/lib/chat/queries"
import { db } from "@/lib/db"
import { getAssignableMembers } from "@/lib/leads/queries"

export const metadata: Metadata = { title: "Chat" }

export default async function ChatPage({ params }: PageProps<"/chat/[channelId]">) {
  const user = await requirePermission("chat", "READ")
  const { channelId } = await params
  const channel = await findAccessibleChannel(user, channelId)
  if (!channel) notFound()

  // Messages aren't awaited here: <ThreadLoader> streams them in below the header.
  const [channels, canWrite, members, canSeeClient] = await Promise.all([
    getChannelList(user),
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
  const Icon = channel.kind === "TEAM" ? HashIcon : channel.kind === "CLIENT" ? BuildingIcon : channel.kind === "GROUP" ? LockIcon : UserIcon
  const memberCount = channel.kind === "GROUP" ? await db.channelMember.count({ where: { channelId: channel.id } }) : 0
  const subtitle =
    channel.kind === "CLIENT"
      ? "Shared with the client. They see every message and file here."
      : channel.kind === "TEAM"
        ? "Team only. Clients never see this channel."
        : channel.kind === "GROUP"
          ? "Private group. Only its members can see it."
          : "Private conversation."

  return (
    // Full-height chat inside the page container.
    <div data-full-bleed className="grid min-h-0 flex-1 grid-cols-1 border-border md:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="hidden min-h-0 border-r border-border bg-sidebar md:flex md:flex-col">
        <ChannelList {...listProps} />
      </aside>
      <section aria-label={title} className="flex min-h-0 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <MobileChannels {...listProps} />
          <Icon aria-hidden className="size-4 text-muted-foreground" />
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">· {subtitle}</span>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {channel.kind === "CLIENT" && channel.clientId && canSeeClient && (
              <Link href={`/clients/${channel.clientId}`} className="link text-xs">
                Client page
              </Link>
            )}
            {channel.kind === "GROUP" && (
              <GroupPanel
                channelId={channel.id}
                name={channel.name ?? "Group"}
                memberCount={memberCount}
                currentUserId={user.id}
                teammates={members}
              />
            )}
            {canWrite && <StartCallButton channelId={channel.id} />}
          </div>
        </header>
        <Suspense key={channel.id} fallback={<ThreadSkeleton />}>
        <ThreadLoader
          channelId={channel.id}
          currentUserId={user.id}
          canWrite={canWrite}
          canModerate={user.role === "OWNER" || user.role === "ADMIN"}
          showClientBadge={channel.kind === "CLIENT"}
          placeholder={channel.kind === "CLIENT" ? `Message ${title} (the client will see this)` : `Message ${title}`}
          emptyText={channel.kind === "CLIENT" ? `Start the conversation with ${title}.` : "No messages yet. Say hello."}
        />
        </Suspense>
      </section>
    </div>
  )
}
