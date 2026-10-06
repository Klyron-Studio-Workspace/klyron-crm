"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const items = [
  { href: "/portal", label: "Projects" },
  { href: "/portal/chat", label: "Messages" },
  { href: "/portal/files", label: "Files" },
  { href: "/portal/billing", label: "Billing" },
]

function PortalNav({ showBilling }: { showBilling: boolean }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Portal" className="flex items-center gap-1">
      {items.filter((item) => showBilling || item.href !== "/portal/billing").map((item) => {
        const active = item.href === "/portal" ? pathname === "/portal" || pathname.startsWith("/portal/projects") : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground",
              active && "bg-primary-tint font-medium text-primary-strong hover:bg-primary-tint hover:text-primary-strong"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export { PortalNav }
