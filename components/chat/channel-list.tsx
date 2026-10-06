"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BuildingIcon, HashIcon, PlusIcon, UserIcon } from "lucide-react"

import { useRealtime } from "@/components/realtime/realtime-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"
import { createTeamChannel, openDirectChat } from "@/lib/actions/chat"
import type { ChannelKindKey, ChannelSummaryDTO } from "@/lib/chat/types"
import { formatRelative } from "@/lib/format"
import type { PersonDTO } from "@/lib/leads/types"
import { cn } from "@/lib/utils"

const sectionLabels: Record<ChannelKindKey, string> = { TEAM: "Channels", CLIENT: "Clients", DIRECT: "Direct messages" }
const icons = { TEAM: HashIcon, CLIENT: BuildingIcon, DIRECT: UserIcon }

function NewConversation({ teammates, canCreateChannel }: { teammates: PersonDTO[]; canCreateChannel: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [mode, setMode] = React.useState<"direct" | "channel" | null>(null)
  const [selected, setSelected] = React.useState<string[]>([])
  const [name, setName] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  function submit() {
    startTransition(async () => {
      const result = mode === "direct" ? await openDirectChat(selected) : await createTeamChannel(name)
      if (!result.ok) {
        toast.add({ type: "error", title: "Couldn't start conversation", description: result.error })
        return
      }
      setMode(null)
      setSelected([])
      setName("")
      router.push(`/chat/${result.channelId}`)
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="New conversation" />}>
          <PlusIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setMode("direct")}>
            <UserIcon /> Direct message
          </DropdownMenuItem>
          {canCreateChannel && (
            <DropdownMenuItem onClick={() => setMode("channel")}>
              <HashIcon /> New team channel
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "direct" ? "Direct message" : "New team channel"}</DialogTitle>
            <DialogDescription>
              {mode === "direct" ? "Private to the people you choose." : "Visible to the whole team, e.g. #design or #dev."}
            </DialogDescription>
          </DialogHeader>
          {mode === "direct" ? (
            <fieldset className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              <legend className="sr-only">Teammates</legend>
              {teammates.length === 0 && <p className="text-sm text-muted-foreground">No other team members yet.</p>}
              {teammates.map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={selected.includes(t.id)}
                    onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)))}
                    className="size-4 accent-primary"
                  />
                  {t.name}
                </label>
              ))}
            </fieldset>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="channel-name">Channel name</Label>
              <Input id="channel-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="design" />
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
            <Button disabled={pending || (mode === "direct" ? selected.length === 0 : !name.trim())} onClick={submit}>
              {mode === "direct" ? "Open conversation" : "Create channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

type ChannelListProps = {
  channels: ChannelSummaryDTO[]
  activeId: string
  currentUserId: string
  teammates: PersonDTO[]
  canCreateChannel: boolean
}

function ChannelList({ channels: initial, activeId, currentUserId, teammates, canCreateChannel }: ChannelListProps) {
  const [channels, setChannels] = React.useState(initial)
  const router = useRouter()
  const known = new Set(channels.map((c) => c.id))

  useRealtime((event) => {
    if (event.type === "message") {
      if (!known.has(event.channelId)) {
        router.refresh() // a new conversation someone started with us
        return
      }
      setChannels((prev) =>
        prev.map((c) =>
          c.id !== event.channelId
            ? c
            : {
                ...c,
                unread: c.id === activeId || event.message.authorId === currentUserId ? 0 : c.unread + 1,
                lastMessage: {
                  authorName: event.message.authorName,
                  preview: event.message.body.slice(0, 80) || (event.message.files.length === 1 ? "Sent a file" : `Sent ${event.message.files.length} files`),
                  at: event.message.createdAt,
                },
              }
        )
      )
    }
    if (event.type === "read") setChannels((prev) => prev.map((c) => (c.id === event.channelId ? { ...c, unread: 0 } : c)))
  })

  const sections = (["TEAM", "CLIENT", "DIRECT"] as const)
    .map((kind) => ({ kind, items: channels.filter((c) => c.kind === kind) }))
    .filter((s) => s.items.length > 0 || s.kind === "DIRECT")

  return (
    <nav aria-label="Conversations" className="flex min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <h1 className="font-heading text-base font-semibold">Chat</h1>
        <NewConversation teammates={teammates} canCreateChannel={canCreateChannel} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {sections.map((section) => {
          const Icon = icons[section.kind]
          return (
            <div key={section.kind} className="mb-3">
              <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{sectionLabels[section.kind]}</p>
              {section.items.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">None yet. Use + to start one.</p>}
              <ul className="flex flex-col gap-0.5">
                {section.items.map((c) => {
                  const active = c.id === activeId
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/chat/${c.id}`}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 ease-out outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring",
                          active && "bg-primary-tint text-primary-strong hover:bg-primary-tint"
                        )}
                      >
                        <Icon aria-hidden className="mt-0.5 size-4 shrink-0 opacity-70" />
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate", (c.unread > 0 || active) && "font-medium")}>{c.title}</span>
                          {c.lastMessage && (
                            <span suppressHydrationWarning className="block truncate text-xs text-muted-foreground">
                              {c.lastMessage.preview} · {formatRelative(new Date(c.lastMessage.at))}
                            </span>
                          )}
                        </span>
                        {c.unread > 0 && !active && (
                          <span className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
                            {c.unread}
                            <span className="sr-only"> unread</span>
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </nav>
  )
}

export { ChannelList }
