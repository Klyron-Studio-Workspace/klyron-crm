"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { InboxIcon, SendIcon, FileEditIcon, ArchiveIcon, Trash2Icon, PencilLineIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
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
