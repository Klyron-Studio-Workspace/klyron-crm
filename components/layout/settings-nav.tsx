"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

/** `exact: false` keeps the tab active on nested pages (e.g. /finance/invoices/abc). */
export type SettingsTab = { href: string; label: string; exact?: boolean }

/** Underlined tab bar (settings, finance). Only tabs the user may open are passed in. */
function SettingsNav({ tabs, label = "Settings" }: { tabs: SettingsTab[]; label?: string }) {
  const pathname = usePathname()
  return (
    <nav aria-label={label} className="-mb-px flex gap-6 overflow-x-auto border-b border-border">
      {tabs.map((tab) => {
        const active = pathname === tab.href || (tab.exact === false && pathname.startsWith(`${tab.href}/`))
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 ease-out",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

export { SettingsNav }
