import Link from "next/link"

import { KlyronMark, KlyronWordmark } from "@/components/brand/klyron-mark"
import { CallIsland } from "@/components/layout/call-island"
import { NotificationAlert } from "@/components/layout/notification-alert"
import { NotificationBell } from "@/components/layout/notification-bell"
import { PortalAccountMenu } from "@/components/layout/portal-account-menu"
import { PortalNav } from "@/components/layout/portal-nav"
import { RealtimeProvider } from "@/components/realtime/realtime-provider"
import { can, requireClientUser } from "@/lib/auth/dal"
import { getNotificationsFor } from "@/lib/notifications"

/** Client portal shell: projects, messages, files and billing, with live notifications. */
export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const user = await requireClientUser()
  const [notifications, showBilling] = await Promise.all([getNotificationsFor(user.id), can(user, "finance", "READ")])
  return (
    <RealtimeProvider>
      <CallIsland />
      {/* Pages marked data-full-height (chat) lock the shell to the screen and fill what's left. */}
      <div className="flex min-h-svh flex-col has-[[data-full-height]]:h-svh">
        <NotificationAlert context="client" userId={user.id} />
        <header className="sticky top-0 z-20 border-b border-border bg-background">
          <div className="mx-auto flex h-12 w-full max-w-5xl items-center gap-2 px-3 sm:h-14 sm:gap-4 sm:px-6">
            <Link href="/portal" className="flex shrink-0 items-center gap-2.5 rounded-md">
              <KlyronMark className="size-6 sm:size-7" decorative />
              <KlyronWordmark className="hidden sm:inline" />
            </Link>
            <PortalNav showBilling={showBilling} />
            <div className="ml-auto flex shrink-0 items-center sm:gap-1">
              <NotificationBell
                key={`${notifications.unread}-${notifications.items[0]?.id ?? ""}`}
                initialItems={notifications.items}
                initialUnread={notifications.unread}
              />
              <PortalAccountMenu name={user.name} email={user.email} />
            </div>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 has-[[data-full-height]]:min-h-0 has-[[data-full-height]]:py-0">{children}</main>
      </div>
    </RealtimeProvider>
  )
}
