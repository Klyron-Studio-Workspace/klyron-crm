"use client"

import * as React from "react"
import { UploadIcon } from "lucide-react"

import { Composer, type ComposerHandle } from "@/components/chat/composer"
import { MessageItem } from "@/components/chat/message-item"
import { useRealtime } from "@/components/realtime/realtime-provider"
import { Button } from "@/components/ui/button"
import { loadOlderMessages, markChannelRead } from "@/lib/actions/chat"
import type { MessageDTO } from "@/lib/chat/types"
import { dayKey, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

const GROUP_WINDOW_MS = 5 * 60 * 1000

type MessageThreadProps = {
  channelId: string
  initialMessages: MessageDTO[]
  initialHasMore: boolean
  currentUserId: string
  canWrite: boolean
  canModerate: boolean
  showClientBadge: boolean
  placeholder: string
  emptyText: string
}

function MessageThread({
  channelId,
  initialMessages,
  initialHasMore,
  currentUserId,
  canWrite,
  canModerate,
  showClientBadge,
  placeholder,
  emptyText,
}: MessageThreadProps) {
  const [messages, setMessages] = React.useState(initialMessages)
  const [hasMore, setHasMore] = React.useState(initialHasMore)
  const [loadingOlder, startLoadingOlder] = React.useTransition()
  const [typing, setTyping] = React.useState<Record<string, { name: string; until: number }>>({})
  const [dragging, setDragging] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const composerRef = React.useRef<ComposerHandle>(null)
  const stickToBottom = React.useRef(true)

  const markRead = React.useCallback(() => {
    if (document.visibilityState === "visible") void markChannelRead(channelId)
  }, [channelId])

  // Initial scroll + read receipt
  React.useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])
  React.useEffect(() => {
    markRead()
    const onVisible = () => markRead()
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [markRead])

  // Keep pinned to the bottom when new messages arrive (unless reading history).
  React.useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  useRealtime((event) => {
    if (event.type === "message" && event.channelId === channelId) {
      setMessages((prev) => (prev.some((m) => m.id === event.message.id) ? prev : [...prev, event.message]))
      setTyping((prev) => {
        const next = { ...prev }
        if (event.message.authorId) delete next[event.message.authorId]
        return next
      })
      if (event.message.authorId === currentUserId) stickToBottom.current = true
      else markRead()
    }
    if (event.type === "message.update" && event.channelId === channelId) {
      setMessages((prev) => prev.map((m) => (m.id === event.message.id ? event.message : m)))
    }
    if (event.type === "typing" && event.channelId === channelId) {
      setTyping((prev) => ({ ...prev, [event.userId]: { name: event.name, until: Date.now() + 4000 } }))
    }
  })

  // Expire typing indicators.
  React.useEffect(() => {
    if (Object.keys(typing).length === 0) return
    const id = setInterval(() => {
      const now = Date.now()
      setTyping((prev) => Object.fromEntries(Object.entries(prev).filter(([, v]) => v.until > now)))
    }, 1000)
    return () => clearInterval(id)
  }, [typing])

  const loadingRef = React.useRef(false)
  function loadOlder() {
    const el = scrollRef.current
    const first = messages[0]
    if (!el || !first || loadingRef.current) return
    loadingRef.current = true
    const previousHeight = el.scrollHeight
    startLoadingOlder(async () => {
      try {
        const page = await loadOlderMessages(channelId, first.id)
        stickToBottom.current = false
        setMessages((prev) => [...page.messages, ...prev])
        setHasMore(page.hasMore)
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight - previousHeight // keep the reader's place
        })
      } finally {
        loadingRef.current = false
      }
    })
  }

  // Loads the next older chunk when the reader scrolls near the top.
  const sentinelRef = React.useRef<HTMLDivElement>(null)
  const loadOlderRef = React.useRef(loadOlder)
  React.useLayoutEffect(() => {
    loadOlderRef.current = loadOlder
  })
  React.useEffect(() => {
    const root = scrollRef.current
    const sentinel = sentinelRef.current
    if (!hasMore || !root || !sentinel) return
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadOlderRef.current(), {
      root,
      rootMargin: "300px 0px 0px 0px",
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, messages.length])

  const typers = Object.values(typing).map((t) => t.name)

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragOver={(e) => {
        if (!canWrite || !e.dataTransfer.types.includes("Files")) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
      }}
      onDrop={(e) => {
        if (!canWrite || e.dataTransfer.files.length === 0) return
        e.preventDefault()
        setDragging(false)
        composerRef.current?.addFiles(e.dataTransfer.files)
      }}
    >
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
        }}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
        role="log"
        aria-live="polite"
        aria-label="Messages"
      >
        {hasMore && (
          <div ref={sentinelRef} className="mb-2 flex justify-center">
            {/* Scrolling up loads automatically; the button is for keyboard users and as a fallback. */}
            <Button variant="ghost" size="sm" disabled={loadingOlder} onClick={loadOlder}>
              {loadingOlder ? "Loading…" : "Load earlier messages"}
            </Button>
          </div>
        )}
        {messages.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ol className="flex flex-col">
            {messages.map((message, index) => {
              const previous = messages[index - 1]
              const created = new Date(message.createdAt)
              const newDay = !previous || dayKey(new Date(previous.createdAt)) !== dayKey(created)
              const compact =
                !newDay &&
                !!previous &&
                previous.authorId === message.authorId &&
                !previous.deleted &&
                created.getTime() - new Date(previous.createdAt).getTime() < GROUP_WINDOW_MS
              return (
                <React.Fragment key={message.id}>
                  {newDay && (
                    <li role="separator" suppressHydrationWarning className="my-3 flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                      {formatDate(created)}
                    </li>
                  )}
                  <MessageItem
                    message={message}
                    compact={compact}
                    isOwn={message.authorId === currentUserId}
                    currentUserId={currentUserId}
                    canModerate={canModerate}
                    showClientBadge={showClientBadge}
                  />
                </React.Fragment>
              )
            })}
          </ol>
        )}
      </div>

      <div className="relative border-t border-border bg-background px-3 pt-2 pb-3 max-sm:px-2 max-sm:py-2">
        {/* Phones: "is typing…" floats over the last message instead of reserving an empty row */}
        <p aria-live="polite" className="h-5 text-xs text-muted-foreground max-sm:pointer-events-none max-sm:absolute max-sm:bottom-full max-sm:left-0 max-sm:px-3">
          {typers.length === 1 ? `${typers[0]} is typing…` : typers.length > 1 ? `${typers.join(", ")} are typing…` : ""}
        </p>
        {canWrite ? (
          <Composer key={channelId} ref={composerRef} channelId={channelId} placeholder={placeholder} />
        ) : (
          <p className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">You can read this conversation but not post.</p>
        )}
      </div>

      {dragging && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-2 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary-tint text-sm font-medium text-primary-strong"
          )}
        >
          <UploadIcon className="size-5" />
          Drop files to attach
        </div>
      )}
    </div>
  )
}

export { MessageThread }
