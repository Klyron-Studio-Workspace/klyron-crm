"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BellIcon } from "lucide-react"

import { useRealtime } from "@/components/realtime/realtime-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications"
import { formatRelative } from "@/lib/format"
import type { NotificationDTO } from "@/lib/realtime/events"
import { cn } from "@/lib/utils"

type NotificationBellProps = { initialItems: NotificationDTO[]; initialUnread: number }

function NotificationBell({ initialItems, initialUnread }: NotificationBellProps) {
  const router = useRouter()
  const [items, setItems] = React.useState(initialItems)
  const [unread, setUnread] = React.useState(initialUnread)
  const [, startTransition] = React.useTransition()

  useRealtime((event) => {
    if (event.type === "notification") {
      setItems((prev) => [event.notification, ...prev.filter((n) => n.id !== event.notification.id)].slice(0, 15))
      setUnread((n) => n + 1)
    }
    // Read elsewhere (another tab, or opening a chat): resync from the server.
    if (event.type === "notifications.read") router.refresh()
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} />
        }
      >
        <BellIcon />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button
              type="button"
              className="link text-xs"
              onClick={() => {
                setUnread(0)
                setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
                startTransition(() => markAllNotificationsRead())
              }}
            >
              Mark all as read
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">You&rsquo;re all caught up.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto p-1">
            {items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                render={<Link href={n.link ?? "/"} />}
                onClick={() => {
                  if (n.readAt) return
                  setUnread((u) => Math.max(0, u - 1))
                  setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)))
                  startTransition(() => markNotificationRead(n.id))
                }}
                className="flex items-start gap-2.5 py-2"
              >
                <span aria-hidden className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={cn("text-sm", !n.readAt && "font-medium")}>{n.title}</span>
                  {n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
                  <span suppressHydrationWarning className="text-xs text-muted-foreground">
                    {formatRelative(new Date(n.createdAt))}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { NotificationBell }
