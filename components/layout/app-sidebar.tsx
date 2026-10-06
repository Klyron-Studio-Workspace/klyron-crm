"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { KlyronMark, KlyronWordmark } from "@/components/brand/klyron-mark"
import { useRealtime } from "@/components/realtime/realtime-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { isNavItemActive, navSections } from "@/lib/navigation"

type AppSidebarProps = {
  /** Nav items the user can't access, computed on the server from permissions. */
  hiddenHrefs?: string[]
  unreadChat?: number
  currentUserId: string
}

/** Unread chat count: server value plus live increments until the next refresh. */
function useUnreadChat(serverCount: number, currentUserId: string, pathname: string) {
  const router = useRouter()
  const [state, setState] = React.useState({ base: serverCount, extra: 0 })
  if (state.base !== serverCount) setState({ base: serverCount, extra: 0 })

  useRealtime((event) => {
    if (event.type === "message" && event.message.authorId !== currentUserId && pathname !== `/chat/${event.channelId}`) {
      setState((s) => ({ ...s, extra: s.extra + 1 }))
    }
    if (event.type === "read") router.refresh()
  })
  return state.base + state.extra
}

function AppSidebar({ hiddenHrefs = [], unreadChat = 0, currentUserId }: AppSidebarProps) {
  const pathname = usePathname()
  const unread = useUnreadChat(unreadChat, currentUserId, pathname)
  const sections = navSections
    .map((section) => ({ ...section, items: section.items.filter((item) => !hiddenHrefs.includes(item.href)) }))
    .filter((section) => section.items.length > 0)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center"
        >
          <KlyronMark className="size-7" title="Klyron Studio, dashboard" />
          <KlyronWordmark className="group-data-[collapsible=icon]:hidden" />
        </Link>
      </SidebarHeader>

      <SidebarContent className="py-2">
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = isNavItemActive(pathname, item.href)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.title}
                        render={
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                          />
                        }
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                      {item.href === "/chat" && unread > 0 && (
                        <SidebarMenuBadge className="bg-primary text-primary-foreground">
                          {unread > 99 ? "99+" : unread}
                          <span className="sr-only"> unread messages</span>
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <p className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          Klyron Studio · Internal
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export { AppSidebar }
