"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOutIcon, SearchIcon, SettingsIcon, UserIcon } from "lucide-react"

import { NotificationBell } from "@/components/layout/notification-bell"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { logout } from "@/lib/actions/auth"
import { roleLabels } from "@/lib/auth/permissions"
import type { Role } from "@/lib/generated/prisma/enums"
import { initials } from "@/lib/format"
import { findNavItem } from "@/lib/navigation"
import type { NotificationDTO } from "@/lib/realtime/events"

export type TopbarUser = { name: string; email: string; role: Role }
type TopbarProps = { user: TopbarUser; notifications: { items: NotificationDTO[]; unread: number } }


function Topbar({ user, notifications }: TopbarProps) {
  const pathname = usePathname()
  const current = findNavItem(pathname)

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 lg:px-6">
      <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="h-5! self-center!" />

      <Breadcrumb className="min-w-0">
        <BreadcrumbList>
          <BreadcrumbItem className="hidden sm:inline-flex">Klyron</BreadcrumbItem>
          <BreadcrumbSeparator className="hidden sm:inline-flex" />
          <BreadcrumbItem>
            <BreadcrumbPage className="truncate font-medium">
              {current?.title ?? "Overview"}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1.5">
        <div role="search" className="relative hidden md:block">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search clients, deals and tasks"
            placeholder="Search…"
            className="h-8 w-64 bg-surface pl-8 lg:w-72"
          />
        </div>

        <NotificationBell
          key={`${notifications.unread}-${notifications.items[0]?.id ?? ""}`}
          initialItems={notifications.items}
          initialUnread={notifications.unread}
        />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu" />
            }
          >
            <Avatar size="sm">
              <AvatarFallback className="bg-foreground text-[11px] font-medium text-background">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <span className="block truncate text-sm font-medium text-foreground">{user.name}</span>
                <span className="block truncate font-normal">{user.email}</span>
                <span className="mt-1 block font-normal">{roleLabels[user.role]}</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings/security" />}>
              <UserIcon /> Password &amp; sessions
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/settings" />}>
              <SettingsIcon /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()}>
              <LogOutIcon /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export { Topbar }
