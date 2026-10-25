import { cookies } from "next/headers"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { RealtimeProvider } from "@/components/realtime/realtime-provider"
import { Topbar } from "@/components/layout/topbar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { can, requireTeamUser } from "@/lib/auth/dal"
import { getUnreadTotal } from "@/lib/chat/queries"
import { navSections } from "@/lib/navigation"
import { getNotificationsFor } from "@/lib/notifications"

export default async function CrmLayout({ children }: LayoutProps<"/">) {
  // Team only; clients are redirected to /portal. Pages and actions re-check permissions.
  const user = await requireTeamUser()

  const gated = navSections.flatMap((s) => s.items).filter((item) => item.module)
  const allowed = await Promise.all(gated.map((item) => can(user, item.module!, "READ")))
  const hiddenHrefs = gated.filter((_, i) => !allowed[i]).map((item) => item.href)

  const [notifications, unreadChat] = await Promise.all([
    getNotificationsFor(user.id),
    hiddenHrefs.includes("/chat") ? Promise.resolve(0) : getUnreadTotal(user),
  ])

  // Persisted by the sidebar component (cookie: sidebar_state)
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <RealtimeProvider>
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar hiddenHrefs={hiddenHrefs} unreadChat={unreadChat} currentUserId={user.id} />
      <SidebarInset>
        <Topbar user={{ name: user.name, email: user.email, role: user.role }} notifications={notifications} hiddenHrefs={hiddenHrefs} />
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
    </RealtimeProvider>
  )
}
