"use client"

import * as React from "react"
import {
  AtSignIcon,
  ChevronLeftIcon,
  FileIcon,
  LoaderCircleIcon,
  MicIcon,
  PaperclipIcon,
  SendHorizontalIcon,
  BotIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { formatClock } from "@/components/chat/voice-player"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/components/ui/toast"
import { useVoiceRecorder, type Recording } from "@/hooks/use-voice-recorder"
import { getMentionMenu, sendMessage, sendTyping } from "@/lib/actions/chat"
import { encodeMentions, type Mention, type MentionOption } from "@/lib/chat/mentions"
import { formatBytes, type FileDTO } from "@/lib/files/types"
import { deleteUploadedFile, uploadFile } from "@/lib/files/upload-client"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

type PendingUpload = {
  key: string
  file: File
  progress: number
  result: FileDTO | null
  error: string | null
  abort: () => void
}

const TYPING_THROTTLE_MS = 3000
const HOLD_MS = 300
const CANCEL_SLIDE_PX = 90

export type ComposerHandle = { addFiles: (files: FileList | File[]) => void }

type ComposerProps = {
  channelId: string
  placeholder: string
  ref?: React.Ref<ComposerHandle>
}

// ─── "@" menu ──────────────────────────────────────────────────────────────

type Trigger = { start: number; query: string }

/** "@que" right before the caret (after a space or at the start), or null. */
function findTrigger(text: string, caret: number): Trigger | null {
  const before = text.slice(0, caret)
  const match = /(^|[\s(])@([^@\n]{0,40})$/.exec(before)
  if (!match) return null
  const query = match[2]
  if (/\s{2}/.test(query) || query.split(" ").length > 3) return null
  return { start: caret - query.length - 1, query }
}

function rank(options: MentionOption[], query: string) {
  const q = query.trim().toLowerCase()
  const score = (o: MentionOption) => {
    const label = o.label.toLowerCase()
    if (!q) return 1
    if (label.startsWith(q)) return 3
    if (label.split(/[\s._-]+/).some((w) => w.startsWith(q))) return 2
    return label.includes(q) ? 1 : 0
  }
  const scored = options.map((o) => ({ o, s: score(o) })).filter((x) => x.s > 0)
  const pick = (kind: Mention["kind"], max: number) =>
    scored
      .filter((x) => x.o.kind === kind)
      .sort((a, b) => b.s - a.s || a.o.label.localeCompare(b.o.label))
      .slice(0, max)
      .map((x) => x.o)
  return [...pick("ai", 1), ...pick("user", 8), ...pick("file", 6)]
}

const groupLabel = { ai: "Assistant", user: "People", file: "Files" }

function MentionMenu({
  id,
  items,
  active,
  loading,
  onPick,
  onHover,
}: {
  id: string
  items: MentionOption[]
  active: number
  loading: boolean
  onPick: (o: MentionOption) => void
  onHover: (i: number) => void
}) {
  const listRef = React.useRef<HTMLUListElement>(null)
  React.useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  return (
    <div className="absolute inset-x-0 bottom-full z-30 mb-2 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
      {loading && items.length === 0 ? (
        <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" /> Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">No matches. Keep typing, or press Esc.</p>
      ) : (
        <ul ref={listRef} id={id} role="listbox" aria-label="Mention someone or something" className="max-h-72 overflow-y-auto p-1">
          {items.map((o, i) => {
            const showGroup = i === 0 || items[i - 1].kind !== o.kind
            return (
              <React.Fragment key={`${o.kind}-${o.id ?? "ai"}`}>
                {showGroup && (
                  <li role="presentation" className="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {groupLabel[o.kind]}
                  </li>
                )}
                <li
                  id={`${id}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  onMouseDown={(e) => {
                    e.preventDefault() // keep focus in the textarea
                    onPick(o)
                  }}
                  onMouseMove={() => onHover(i)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm",
                    i === active && "bg-primary-tint text-primary-strong"
                  )}
                >
                  {o.kind === "ai" ? (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <BotIcon className="size-4" />
                    </span>
                  ) : o.kind === "user" ? (
                    <Avatar className="size-7">
                      <AvatarFallback className="text-[10px]">{initials(o.label)}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <FileIcon className="size-3.5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{o.label}</span>
                    {o.hint && <span className="block truncate text-xs text-muted-foreground">{o.hint}</span>}
                  </span>
                  {i === active && <kbd className="hidden rounded border border-border px-1 text-[10px] text-muted-foreground sm:inline">↵</kbd>}
                </li>
              </React.Fragment>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Highlights picked mentions behind the (transparent-background) textarea. */
function MentionHighlights({ text, picked, scrollTop }: { text: string; picked: Mention[]; scrollTop: number }) {
  const labels = [...new Set(picked.map((m) => m.label))].sort((a, b) => b.length - a.length)
  let parts: React.ReactNode[] = [text]
  if (labels.length) {
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const re = new RegExp(`(@(?:${labels.map(escape).join("|")}))(?=$|[\\s.,!?;:)])`, "g")
    parts = text.split(re).map((part, i) =>
      i % 2 === 1 ? (
        <mark key={i} className="rounded-sm bg-primary-tint text-transparent">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden px-1 py-2.5 text-sm leading-5 break-words max-sm:py-2 max-sm:text-[16px] whitespace-pre-wrap text-transparent"
      style={{ transform: `translateY(${-scrollTop}px)` }}
    >
      {parts}
      {"​"}
    </div>
  )
}

// ─── Composer ──────────────────────────────────────────────────────────────

type VoiceMode = "idle" | "starting" | "holding" | "locked" | "sending"

/** Round icon button used in the composer row (same 40px box as the mic/send button). */
function RowButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground max-sm:size-9 transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-[18px]"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function Composer({ channelId, placeholder, ref }: ComposerProps) {
  const toast = useToast()
  const [body, setBody] = React.useState("")
  const [picked, setPicked] = React.useState<Mention[]>([])
  const [uploads, setUploads] = React.useState<PendingUpload[]>([])
  const [sending, startSending] = React.useTransition()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const lastTyping = React.useRef(0)
  const [scrollTop, setScrollTop] = React.useState(0)

  // "@" menu state
  const [trigger, setTrigger] = React.useState<Trigger | null>(null)
  const [options, setOptions] = React.useState<MentionOption[] | null>(null)
  const [loadingOptions, setLoadingOptions] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const loadedAt = React.useRef(0)
  const menuId = React.useId()
  const items = React.useMemo(() => (trigger && options ? rank(options, trigger.query) : []), [trigger, options])
  const menuOpen = trigger !== null

  // ── Voice: idle → starting (mic opening) → holding (finger down) | locked (hands-free) → sending ──
  const [voiceMode, setVoiceModeState] = React.useState<VoiceMode>("idle")
  const mode = React.useRef<VoiceMode>("idle")
  const setVoiceMode = (next: VoiceMode) => {
    mode.current = next
    setVoiceModeState(next)
  }
  const [slide, setSlide] = React.useState(0)
  const [now, setNow] = React.useState(0)
  /** The current press on the mic: when it started, where, and whether it already ended. */
  const press = React.useRef<{ at: number; x: number; released: boolean } | null>(null)
  const {
    recording: isRecording,
    startedAt: recordingStartedAt,
    start: startRecording,
    stop: stopRecording,
    cancel: cancelRecording,
    canvasRef,
  } = useVoiceRecorder({ onAutoStop: () => void finishVoice(true) })

  const update = (key: string, patch: Partial<PendingUpload>) => setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, ...patch } : u)))

  const addFiles = React.useCallback(
    (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        const key = `${file.name}-${file.size}-${Math.random()}`
        const handle = uploadFile(file, { channelId }, (progress) => update(key, { progress }))
        setUploads((prev) => [...prev, { key, file, progress: 0, result: null, error: null, abort: handle.abort }])
        handle.promise.then((result) => update(key, { result, progress: 1 })).catch((error: Error) => update(key, { error: error.message }))
      }
    },
    [channelId]
  )
  React.useImperativeHandle(ref, () => ({ addFiles }), [addFiles])

  function remove(upload: PendingUpload) {
    if (!upload.result && !upload.error) upload.abort()
    if (upload.result) void deleteUploadedFile(upload.result.id)
    setUploads((prev) => prev.filter((u) => u.key !== upload.key))
  }

  const uploading = uploads.some((u) => !u.result && !u.error)
  const ready = uploads.filter((u) => u.result)
  const hasContent = body.trim().length > 0 || ready.length > 0
  const canSend = !sending && !uploading && hasContent

  function loadOptions() {
    if (Date.now() - loadedAt.current < 60_000 && options) return
    loadedAt.current = Date.now()
    setLoadingOptions(true)
    void getMentionMenu(channelId)
      .then(setOptions)
      .finally(() => setLoadingOptions(false))
  }

  function syncTrigger(text: string, caret: number) {
    const next = findTrigger(text, caret)
    setTrigger(next)
    if (next) {
      setActive(0)
      loadOptions()
    }
  }

  function pick(option: MentionOption) {
    const el = textareaRef.current
    if (!el || !trigger) return
    const caret = el.selectionStart
    const insert = `@${option.label} `
    const next = body.slice(0, trigger.start) + insert + body.slice(caret)
    setBody(next)
    setPicked((prev) => [...prev, { kind: option.kind, id: option.id, label: option.label }])
    setTrigger(null)
    const pos = trigger.start + insert.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  function openMentionMenu() {
    const el = textareaRef.current
    if (!el) return
    const caret = el.selectionStart
    const needsSpace = caret > 0 && !/\s/.test(body[caret - 1])
    const next = `${body.slice(0, caret)}${needsSpace ? " " : ""}@${body.slice(caret)}`
    const pos = caret + (needsSpace ? 2 : 1)
    setBody(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(pos, pos)
      syncTrigger(next, pos)
    })
  }

  function submit() {
    if (!canSend) return
    const text = encodeMentions(body, picked)
    const fileIds = ready.map((u) => u.result!.id)
    startSending(async () => {
      const result = await sendMessage({ channelId, body: text, fileIds })
      if (!result.ok) {
        toast.add({ type: "error", title: "Message not sent", description: result.error })
        return
      }
      setBody("")
      setPicked([])
      setTrigger(null)
      setUploads((prev) => prev.filter((u) => !u.result))
      textareaRef.current?.focus()
    })
  }

  // ── Voice notes ──
  async function sendRecording(recording: Recording) {
    setVoiceMode("sending")
    const ext = recording.mimeType.includes("mp4") ? "m4a" : recording.mimeType.includes("ogg") ? "ogg" : "webm"
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", ".")
    const file = new File([recording.blob], `Voice message ${stamp}.${ext}`, { type: recording.mimeType })
    try {
      const uploaded = await uploadFile(file, { channelId, voice: { durationMs: recording.durationMs, waveform: recording.waveform } }).promise
      const result = await sendMessage({ channelId, body: "", fileIds: [uploaded.id] })
      if (!result.ok) throw new Error(result.error)
    } catch (error) {
      toast.add({ type: "error", title: "Voice message not sent", description: error instanceof Error ? error.message : undefined })
    } finally {
      setVoiceMode("idle")
    }
  }

  async function finishVoice(send: boolean) {
    setSlide(0)
    press.current = null
    if (mode.current === "idle" || mode.current === "sending") return
    if (!send) {
      cancelRecording()
      setVoiceMode("idle")
      return
    }
    const recording = await stopRecording()
    if (!recording) {
      setVoiceMode("idle")
      toast.add({ title: "Too short to send", description: "Hold the mic while you talk, or tap it once to record hands-free." })
      return
    }
    await sendRecording(recording)
  }

  /** Opens the mic. A press that already ended (a tap) goes hands-free; a press still held records while held. */
  async function beginVoice() {
    setVoiceMode("starting")
    const error = await startRecording()
    if (mode.current !== "starting") {
      // Cancelled while the mic was opening (Esc, or slid away).
      cancelRecording()
      return
    }
    if (error) {
      toast.add({ type: "error", title: "Can't record", description: error })
      setVoiceMode("idle")
      return
    }
    const p = press.current
    setVoiceMode(p && !p.released ? "holding" : "locked")
  }

  // Timer tick while recording.
  React.useEffect(() => {
    if (!isRecording) return
    const timer = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(timer)
  }, [isRecording])

  // Esc cancels a recording.
  React.useEffect(() => {
    if (voiceMode === "idle" || voiceMode === "sending") return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void finishVoice(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const micHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || mode.current !== "idle") return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      press.current = { at: Date.now(), x: e.clientX, released: false }
      void beginVoice()
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      const p = press.current
      if (!p || p.released || mode.current !== "holding") return
      const dx = Math.min(0, e.clientX - p.x)
      setSlide(dx)
      if (dx < -CANCEL_SLIDE_PX) void finishVoice(false)
    },
    onPointerUp: () => {
      const p = press.current
      if (!p) return
      p.released = true
      if (mode.current === "holding") {
        // Short press = tap → hands-free; long press = send on release.
        if (Date.now() - p.at < HOLD_MS) {
          setSlide(0)
          setVoiceMode("locked")
        } else {
          void finishVoice(true)
        }
      }
      // Still "starting": beginVoice() sees released and goes hands-free.
    },
    onPointerCancel: () => {
      if (mode.current === "holding") void finishVoice(false)
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if ((e.key === "Enter" || e.key === " ") && mode.current === "idle") {
        e.preventDefault()
        press.current = { at: Date.now(), x: 0, released: true }
        void beginVoice()
      }
    },
  }

  // Browsers without CSS field-sizing (Firefox, Safari): grow the box from its scroll height.
  React.useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el || CSS.supports("field-sizing", "content")) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 208)}px`
  }, [body, voiceMode])

  const recordingVisible = voiceMode !== "idle"
  const elapsed = isRecording ? Math.max(0, now - recordingStartedAt) : 0

  return (
    <div className="relative">
      {menuOpen && !recordingVisible && (
        <MentionMenu id={menuId} items={items} active={Math.min(active, Math.max(0, items.length - 1))} loading={loadingOptions} onPick={pick} onHover={setActive} />
      )}
      <div
        className={cn(
          "overflow-hidden rounded-2xl border bg-card shadow-xs transition-[border-color,box-shadow] duration-200 ease-out",
          recordingVisible ? "border-primary/40 shadow-sm ring-4 ring-primary/5" : "border-border focus-within:border-ring/60"
        )}
      >
        {uploads.length > 0 && !recordingVisible && (
          <ul className="flex flex-wrap gap-2 border-b border-border p-2">
            {uploads.map((u) => (
              <li
                key={u.key}
                className={cn(
                  "relative flex max-w-60 items-center gap-2 overflow-hidden rounded-md border px-2 py-1.5 text-xs animate-in fade-in-0 zoom-in-95",
                  u.error ? "border-destructive/30 bg-destructive-tint text-primary-strong" : "border-border bg-surface"
                )}
              >
                <FileIcon aria-hidden className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{u.file.name}</span>
                  <span className="block text-muted-foreground">{u.error ?? (u.result ? formatBytes(u.file.size) : `Uploading ${Math.round(u.progress * 100)}%`)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => remove(u)}
                  aria-label={`Remove ${u.file.name}`}
                  className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <XIcon className="size-3.5" />
                </button>
                {!u.result && !u.error && (
                  <progress
                    value={u.progress}
                    max={1}
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-0.5 w-full appearance-none bg-transparent [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-primary"
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-1 p-1.5 max-sm:gap-0.5 max-sm:p-1">
          {recordingVisible ? (
            // ── Recording bar ──
            <div key="rec" className="flex min-h-10 flex-1 items-center gap-1 duration-200 animate-in fade-in-0 slide-in-from-bottom-2" role="status" aria-live="polite">
              {voiceMode === "locked" ? (
                <RowButton label="Delete recording" onClick={() => void finishVoice(false)}>
                  <Trash2Icon />
                </RowButton>
              ) : (
                <span className="size-10 shrink-0" aria-hidden />
              )}
              <span className="flex w-16 shrink-0 items-center gap-2 text-sm font-medium tabular-nums">
                {voiceMode === "sending" || voiceMode === "starting" ? (
                  <LoaderCircleIcon aria-hidden className="size-3.5 animate-spin text-primary" />
                ) : (
                  <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-primary" />
                )}
                {voiceMode === "sending" ? "" : formatClock(elapsed)}
              </span>
              <div className="relative h-10 min-w-0 flex-1">
                <canvas ref={canvasRef} aria-hidden className={cn("absolute inset-0 h-full w-full text-primary transition-opacity duration-200", voiceMode === "sending" && "opacity-30")} />
                {voiceMode === "holding" && (
                  <span
                    className="absolute inset-y-0 right-2 flex items-center gap-1 bg-gradient-to-l from-card via-card to-transparent pl-8 text-xs font-medium text-muted-foreground"
                    style={{ transform: `translateX(${slide}px)`, opacity: Math.max(0.2, 1 + slide / CANCEL_SLIDE_PX) }}
                  >
                    <ChevronLeftIcon className="size-4 animate-pulse" /> Slide to cancel
                  </span>
                )}
                {voiceMode === "sending" && (
                  <span className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Sending voice message…</span>
                )}
                {voiceMode === "starting" && (
                  <span className="absolute inset-0 flex items-center pl-1 text-sm text-muted-foreground">Starting microphone…</span>
                )}
              </div>
              <span className="sr-only">
                {voiceMode === "holding"
                  ? `Recording, ${formatClock(elapsed)}. Release to send, slide left to cancel.`
                  : voiceMode === "locked"
                    ? `Recording hands-free, ${formatClock(elapsed)}. Press Send or Delete.`
                    : ""}
              </span>
            </div>
          ) : (
            <>
              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files)
                  e.target.value = ""
                }}
              />
              <RowButton label="Attach files" onClick={() => inputRef.current?.click()}>
                <PaperclipIcon />
              </RowButton>
              <RowButton label="Mention someone, a file or Klyron AI" onClick={openMentionMenu}>
                <AtSignIcon />
              </RowButton>
              <div className="relative min-w-0 flex-1">
                <MentionHighlights text={body} picked={picked} scrollTop={scrollTop} />
                <textarea
                  ref={textareaRef}
                  value={body}
                  rows={1}
                  placeholder={placeholder}
                  aria-label="Message"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={menuOpen}
                  aria-controls={menuOpen ? menuId : undefined}
                  aria-activedescendant={menuOpen && items.length ? `${menuId}-${Math.min(active, items.length - 1)}` : undefined}
                  onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
                  onChange={(e) => {
                    setBody(e.target.value)
                    syncTrigger(e.target.value, e.target.selectionStart)
                    const t = Date.now()
                    if (e.target.value && t - lastTyping.current > TYPING_THROTTLE_MS) {
                      lastTyping.current = t
                      void sendTyping(channelId)
                    }
                  }}
                  onSelect={(e) => {
                    if (trigger) syncTrigger(e.currentTarget.value, e.currentTarget.selectionStart)
                  }}
                  onBlur={() => setTrigger(null)}
                  onPaste={(e) => {
                    if (e.clipboardData.files.length > 0) {
                      e.preventDefault()
                      addFiles(e.clipboardData.files)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (menuOpen && items.length > 0) {
                      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                        e.preventDefault()
                        setActive((i) => (i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length)
                        return
                      }
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault()
                        pick(items[Math.min(active, items.length - 1)])
                        return
                      }
                    }
                    if (menuOpen && e.key === "Escape") {
                      e.preventDefault()
                      setTrigger(null)
                      return
                    }
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      submit()
                    }
                  }}
                  // field-sizing grows the box with its content (no JS measuring); capped at ~8 lines.
                  className="relative block max-h-52 min-h-10 w-full resize-none bg-transparent px-1 py-2.5 text-sm leading-5 max-sm:max-h-32 max-sm:min-h-9 max-sm:py-2 outline-none [field-sizing:content] placeholder:text-muted-foreground"
                />
              </div>
            </>
          )}

          {/* Send / mic: one 40px slot that never moves, so a held press keeps its pointer. */}
          {voiceMode === "locked" ? (
            <button
              type="button"
              aria-label="Send voice message"
              onClick={() => void finishVoice(true)}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary max-sm:size-9 text-primary-foreground shadow-sm transition-transform duration-150 ease-out animate-in zoom-in-75 hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95"
            >
              <SendHorizontalIcon className="size-[18px]" />
            </button>
          ) : hasContent && !recordingVisible ? (
            <button
              type="button"
              aria-label="Send message"
              disabled={!canSend}
              onClick={submit}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary max-sm:size-9 text-primary-foreground shadow-sm transition-[transform,opacity] duration-150 ease-out animate-in zoom-in-75 hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95 disabled:opacity-50"
            >
              {sending ? <LoaderCircleIcon className="size-[18px] animate-spin" /> : <SendHorizontalIcon className="size-[18px]" />}
            </button>
          ) : (
            <span className="relative flex size-10 shrink-0 items-center justify-center max-sm:size-9">
              {voiceMode === "holding" && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/30" />}
              <button
                type="button"
                aria-label="Record a voice message: hold to talk, or tap for hands-free"
                title="Hold to talk · tap for hands-free"
                disabled={voiceMode === "sending"}
                {...micHandlers}
                className={cn(
                  "relative flex size-10 touch-none max-sm:size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform duration-200 ease-out select-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50",
                  (voiceMode === "holding" || voiceMode === "starting") && "scale-125"
                )}
              >
                <MicIcon className="size-[18px]" />
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export { Composer }
