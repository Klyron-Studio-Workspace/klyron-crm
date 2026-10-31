"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FolderKanbanIcon, FolderOpenIcon, MessagesSquareIcon, ReceiptTextIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const items = [
  { href: "/portal", label: "Projects", icon: FolderKanbanIcon },
  { href: "/portal/chat", label: "Messages", icon: MessagesSquareIcon },
  { href: "/portal/files", label: "Files", icon: FolderOpenIcon },
  { href: "/portal/billing", label: "Billing", icon: ReceiptTextIcon },
]

/** Phones: icon tabs, with the label shown only on the active one. sm+: text tabs. */
function PortalNav({ showBilling }: { showBilling: boolean }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Portal" className="flex min-w-0 items-center gap-0.5 sm:gap-1">
      {items.filter((item) => showBilling || item.href !== "/portal/billing").map((item) => {
        const active = item.href === "/portal" ? pathname === "/portal" || pathname.startsWith("/portal/projects") : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground sm:px-3",
              active && "bg-primary-tint font-medium text-primary-strong hover:bg-primary-tint hover:text-primary-strong"
            )}
          >
            <Icon aria-hidden className="size-4 shrink-0 sm:hidden" />
            <span className={cn(!active && "hidden sm:inline")}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export { PortalNav }
