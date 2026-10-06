"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { KanbanSquareIcon, ListIcon, SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { leadSources, sourceLabels } from "@/lib/leads/constants"
import type { PersonDTO } from "@/lib/leads/types"
import { cn } from "@/lib/utils"

type LeadFiltersProps = {
  members: PersonDTO[]
  view: "board" | "list"
  showOwnerFilter: boolean
}

function FilterSelect({
  label,
  param,
  value,
  items,
  onChange,
}: {
  label: string
  param: string
  value: string
  items: { value: string; label: string }[]
  onChange: (param: string, value: string) => void
}) {
  return (
    <Select items={items} value={value} onValueChange={(next: string | null) => onChange(param, next ?? "all")}>
      <SelectTrigger size="sm" aria-label={label} className={cn("min-w-36", value !== "all" && "border-primary/40 text-primary-strong")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Filters live in the URL, so a filtered board can be bookmarked or shared. */
function LeadFilters({ members, view, showOwnerFilter }: LeadFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, startTransition] = React.useTransition()
  const [query, setQuery] = React.useState(params.get("q") ?? "")

  function update(next: Record<string, string | null>) {
    const search = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value && value !== "all") search.set(key, value)
      else search.delete(key)
    }
    const qs = search.toString()
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  // Debounced search
  React.useEffect(() => {
    if (query === (params.get("q") ?? "")) return
    const id = setTimeout(() => update({ q: query.trim() || null }), 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const hasFilters = ["q", "owner", "source"].some((key) => params.has(key))
  const viewHref = (v: "board" | "list") => {
    const search = new URLSearchParams(params.toString())
    if (v === "board") search.delete("view")
    else search.set("view", v)
    const qs = search.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="search" className="relative">
        <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search leads"
          placeholder="Search name, company, email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 w-64 pl-8"
        />
      </div>
      {showOwnerFilter && (
        <FilterSelect
          label="Owner"
          param="owner"
          value={params.get("owner") ?? "all"}
          onChange={(param, value) => update({ [param]: value })}
          items={[
            { value: "all", label: "All owners" },
            { value: "none", label: "Unassigned" },
            ...members.map((m) => ({ value: m.id, label: m.name })),
          ]}
        />
      )}
      <FilterSelect
        label="Source"
        param="source"
        value={params.get("source") ?? "all"}
        onChange={(param, value) => update({ [param]: value })}
        items={[{ value: "all", label: "All sources" }, ...leadSources.map((s) => ({ value: s, label: sourceLabels[s] }))]}
      />
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuery("")
            update({ q: null, owner: null, source: null })
          }}
        >
          <XIcon data-icon="inline-start" />
          Clear
        </Button>
      )}

      <div role="group" aria-label="View" className="ml-auto inline-flex rounded-md border border-border bg-background p-0.5">
        {(
          [
            { value: "board", label: "Board", icon: KanbanSquareIcon },
            { value: "list", label: "List", icon: ListIcon },
          ] as const
        ).map((option) => (
          <Link
            key={option.value}
            href={viewHref(option.value)}
            scroll={false}
            aria-current={view === option.value ? "page" : undefined}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground",
              view === option.value && "bg-muted font-medium text-foreground"
            )}
          >
            <option.icon aria-hidden className="size-4" />
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

export { LeadFilters }
