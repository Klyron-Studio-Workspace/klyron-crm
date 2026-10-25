import { Suspense } from "react"
import { countUnread } from "@/lib/actions/mail"
import { requireTeamUser } from "@/lib/auth/dal"
import { ensureMailbox } from "@/lib/mail-server/mailbox"
import { FolderNav } from "@/components/mail/folder-nav"
import { ComposeTrigger } from "@/components/mail/compose-trigger"

export default async function MailLayout({ children }: { children: React.ReactNode }) {
  // Older accounts (e.g. the seeded Owner) predate mailbox auto-provisioning.
  const user = await requireTeamUser()
  await ensureMailbox(user.id, user.name)
  const unread = await countUnread()

  return (
    <div data-full-bleed className="flex h-[calc(100svh-3.5rem)] overflow-hidden">
      {/* Left panel — folder nav, styled like the main sidebar */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <FolderNav unread={unread} />
      </aside>

      {/* Centre + right panels */}
      <div className="flex flex-1 overflow-hidden min-w-0">{children}</div>

      {/* Compose dialog — URL-driven, client-side */}
      <Suspense>
        <ComposeTrigger />
      </Suspense>
    </div>
  )
}
