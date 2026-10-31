"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  BuildingIcon,
  CornerDownLeftIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderKanbanIcon,
  KanbanSquareIcon,
  KeyRoundIcon,
  LogOutIcon,
  ReceiptIcon,
  SearchIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"

import { themeOptions } from "@/components/layout/theme-menu"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { logout } from "@/lib/actions/auth"
import { searchRecords, type SearchHit } from "@/lib/actions/search"
import { navSections } from "@/lib/navigation"
import { setTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

type Command = { id: string; group: string; label: string; icon: LucideIcon; run: () => void }

/** Pages beyond the sidebar, gated by the sidebar item they live under. */
const extraPages: { label: string; href: string; icon: LucideIcon; under: string }[] = [
  { label: "Invoices", href: "/finance/invoices", icon: ReceiptIcon, under: "/finance" },
  { label: "New invoice", href: "/finance/invoices/new", icon: FilePlusIcon, under: "/finance" },
  { label: "Proposals", href: "/finance/proposals", icon: FileTextIcon, under: "/finance" },
  { label: "New proposal", href: "/finance/proposals/new", icon: FilePlusIcon, under: "/finance" },
  { label: "Expenses", href: "/finance/expenses", icon: WalletIcon, under: "/finance" },
  { label: "Password & sessions", href: "/settings/security", icon: KeyRoundIcon, under: "/settings" },
]

const recordKinds: Record<SearchHit["kind"], { group: string; icon: LucideIcon }> = {
  lead: { group: "Leads", icon: KanbanSquareIcon },
  client: { group: "Clients", icon: BuildingIcon },
  project: { group: "Projects", icon: FolderKanbanIcon },
  invoice: { group: "Invoices", icon: ReceiptIcon },
}

/** Ctrl/⌘+K quick navigation: pages, records, theme and sign out, fully keyboard driven. */
function CommandPalette({ hiddenHrefs }: { hiddenHrefs: string[] }) {
  const router = useRouter()
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href)
    const pages = navSections
      .flatMap((s) => s.items)
      .filter((item) => !hiddenHrefs.includes(item.href))
      .map((item) => ({ id: item.href, group: "Go to", label: item.title, icon: item.icon, run: go(item.href) }))
    const extras = extraPages
      .filter((p) => !hiddenHrefs.includes(p.under))
      .map((p) => ({ id: p.href, group: "Go to", label: p.label, icon: p.icon, run: go(p.href) }))
    const themes = themeOptions.map((t) => ({
      id: `theme-${t.value}`,
      group: "Theme",
      label: `${t.label} theme`,
      icon: t.icon,
      run: () => setTheme(t.value),
    }))
    return [
      ...pages,
      ...extras,
      ...themes,
      { id: "logout", group: "Account", label: "Sign out", icon: LogOutIcon, run: () => logout() },
    ]
  }, [hiddenHrefs, router])

  // Records (leads, clients, projects, invoices) come from the server, debounced.
  const [hits, setHits] = useState<{ query: string; items: SearchHit[] }>({ query: "", items: [] })
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    const timer = setTimeout(() => {
      searchRecords(q).then(
        (items) => setHits({ query: q, items }),
        () => setHits({ query: q, items: [] })
      )
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const matched = commands.filter((c) => {
      const text = `${c.group} ${c.label}`.toLowerCase()
      return words.every((w) => text.includes(w))
    })
    const records: Command[] =
      hits.query === query.trim() && query.trim().length >= 2
        ? hits.items.map((hit) => ({
            id: `${hit.kind}-${hit.id}`,
            group: recordKinds[hit.kind].group,
            label: hit.detail ? `${hit.label} · ${hit.detail}` : hit.label,
            icon: recordKinds[hit.kind].icon,
            run: () => router.push(hit.href),
          }))
        : []
    return [...matched, ...records]
  }, [commands, query, hits, router])

  function show(next: boolean) {
    if (next) {
      setQuery("")
      setActive(0)
    }
    setOpen(next)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => {
          if (!o) {
            setQuery("")
            setActive(0)
          }
          return !o
        })
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  function run(command: Command | undefined) {
    if (!command) return
    setOpen(false)
    command.run()
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const last = results.length - 1
    if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
      e.preventDefault()
      setActive((i) => (i >= last ? 0 : i + 1))
    } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
      e.preventDefault()
      setActive((i) => (i <= 0 ? last : i - 1))
    } else if (e.key === "PageDown" || (e.key === "End" && e.ctrlKey)) {
      e.preventDefault()
      setActive(last)
    } else if (e.key === "PageUp" || (e.key === "Home" && e.ctrlKey)) {
      e.preventDefault()
      setActive(0)
    } else if (e.key === "Enter") {
      e.preventDefault()
      run(results[active])
    }
  }

  const optionId = (i: number) => `${listId}-${i}`

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Quick navigation"
              aria-keyshortcuts="Control+K Meta+K"
              onClick={() => show(true)}
            />
          }
        >
          <SearchIcon />
        </TooltipTrigger>
        <TooltipContent>Quick navigation · Ctrl K</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={show}>
        <DialogContent
          showCloseButton={false}
          className="top-[15vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">Quick navigation</DialogTitle>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <SearchIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={results[active] ? optionId(active) : undefined}
              aria-label="Search pages and actions"
              placeholder="Search pages, leads, clients, projects, invoices…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={onInputKeyDown}
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ul id={listId} ref={listRef} role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-1.5">
            {results.length === 0 && <li className="px-3 py-6 text-center text-muted-foreground">No matches</li>}
            {results.map((command, i) => {
              const Icon = command.icon
              const firstOfGroup = i === 0 || results[i - 1].group !== command.group
              return (
                <li key={command.id} role="presentation">
                  {firstOfGroup && (
                    <div aria-hidden className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                      {command.group}
                    </div>
                  )}
                  <div
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === active}
                    data-index={i}
                    onMouseMove={() => setActive(i)}
                    onClick={() => run(command)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 select-none",
                      i === active && "bg-accent text-accent-foreground"
                    )}
                  >
                    <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{command.label}</span>
                    {i === active && <CornerDownLeftIcon aria-hidden className="size-3.5 text-muted-foreground" />}
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="flex gap-4 border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate</span>
            <span><Kbd>↵</Kbd> open</span>
            <span><Kbd>Esc</Kbd> close</span>
            <span className="ml-auto"><Kbd>Ctrl</Kbd> <Kbd>K</Kbd> toggle</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[11px] text-foreground">
      {children}
    </kbd>
  )
}

export { CommandPalette }
