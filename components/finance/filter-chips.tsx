import Link from "next/link"

import { cn } from "@/lib/utils"

export type FilterChip = { label: string; href: string; active: boolean }

/** URL-driven status filter, so a filtered list can be bookmarked. */
function FilterChips({ chips, label }: { chips: FilterChip[]; label: string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <Link
          key={chip.href}
          href={chip.href}
          aria-current={chip.active ? "page" : undefined}
          className={cn(
            "rounded-md border border-border px-2.5 py-1 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground",
            chip.active && "border-primary/30 bg-primary-tint font-medium text-primary-strong hover:bg-primary-tint hover:text-primary-strong"
          )}
        >
          {chip.label}
        </Link>
      ))}
    </nav>
  )
}

export { FilterChips }
