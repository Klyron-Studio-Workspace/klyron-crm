"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { InboxIcon, SendIcon, FileEditIcon, ArchiveIcon, Trash2Icon, PencilLineIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const folders = [
  { label: "Inbox",   value: "INBOX",   icon: InboxIcon },
  { label: "Sent",    value: "SENT",    icon: SendIcon },
  { label: "Drafts",  value: "DRAFTS",  icon: FileEditIcon },
  { label: "Archive", value: "ARCHIVE", icon: ArchiveIcon },
  { label: "Trash",   value: "TRASH",   icon: Trash2Icon },
] as const

type Props = { unread: number }

/** Phones (the folder sidebar is hidden there): folder chips + compose above the list. */
export function MobileFolderBar({ unread }: Props) {
  const searchParams = useSearchParams()
  const activeFolder = searchParams.get("folder") ?? "INBOX"

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-2 md:hidden">
      <nav aria-label="Mail folders" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {folders.map(({ label, value, icon: Icon }) => {
          const isActive = activeFolder === value
          return (
            <Link
              key={value}
              href={`/mail?folder=${value}`}
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted",
                isActive && "bg-primary-tint font-medium text-primary-strong"
              )}
            >
              <Icon className="size-4" />
              {isActive && label}
              {value === "INBOX" && unread > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">{unread > 99 ? "99+" : unread}</span>
              )}
            </Link>
          )
        })}
      </nav>
      <Button nativeButton={false} size="icon-sm" aria-label="Compose" render={<Link href="/mail?compose=1" />}>
        <PencilLineIcon />
      </Button>
    </div>
  )
}

/** Mail folders, built from the same sidebar primitives as the main workspace nav. */
export function FolderNav({ unread }: Props) {
  const searchParams = useSearchParams()
  const activeFolder = searchParams.get("folder") ?? "INBOX"

  return (
    <>
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-sidebar-border px-3">
        <span className="text-sm font-semibold tracking-tight">Mail</span>
        <Button nativeButton={false} size="sm" render={<Link href="/mail?compose=1" />}>
          <PencilLineIcon />
          Compose
        </Button>
      </div>

      <SidebarGroup className="flex-1 overflow-y-auto">
        <SidebarGroupLabel>Folders</SidebarGroupLabel>
        <SidebarMenu>
          {folders.map(({ label, value, icon: Icon }) => {
            const isActive = activeFolder === value
            return (
              <SidebarMenuItem key={value}>
                <SidebarMenuButton
                  isActive={isActive}
                  render={<Link href={`/mail?folder=${value}`} aria-current={isActive ? "page" : undefined} />}
                >
                  <Icon />
                  <span>{label}</span>
                </SidebarMenuButton>
                {value === "INBOX" && unread > 0 && (
                  <SidebarMenuBadge className="bg-primary text-primary-foreground">
                    {unread > 99 ? "99+" : unread}
                    <span className="sr-only"> unread emails</span>
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroup>
    </>
  )
}
