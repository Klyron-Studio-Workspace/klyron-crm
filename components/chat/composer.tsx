"use client"

import * as React from "react"
import { FileIcon, PaperclipIcon, SendHorizontalIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { sendMessage, sendTyping } from "@/lib/actions/chat"
import { formatBytes, type FileDTO } from "@/lib/files/types"
import { deleteUploadedFile, uploadFile } from "@/lib/files/upload-client"
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

export type ComposerHandle = { addFiles: (files: FileList | File[]) => void }

type ComposerProps = {
  channelId: string
  placeholder: string
  ref?: React.Ref<ComposerHandle>
}

function Composer({ channelId, placeholder, ref }: ComposerProps) {
  const toast = useToast()
  const [body, setBody] = React.useState("")
  const [uploads, setUploads] = React.useState<PendingUpload[]>([])
  const [sending, startSending] = React.useTransition()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const lastTyping = React.useRef(0)

  const update = (key: string, patch: Partial<PendingUpload>) =>
    setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, ...patch } : u)))

  const addFiles = React.useCallback(
    (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        const key = `${file.name}-${file.size}-${Math.random()}`
        const handle = uploadFile(file, { channelId }, (progress) => update(key, { progress }))
        setUploads((prev) => [...prev, { key, file, progress: 0, result: null, error: null, abort: handle.abort }])
        handle.promise
          .then((result) => update(key, { result, progress: 1 }))
          .catch((error: Error) => update(key, { error: error.message }))
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
  const canSend = !sending && !uploading && (body.trim().length > 0 || ready.length > 0)

  function submit() {
    if (!canSend) return
    const text = body
    const fileIds = ready.map((u) => u.result!.id)
    startSending(async () => {
      const result = await sendMessage({ channelId, body: text, fileIds })
      if (!result.ok) {
        toast.add({ type: "error", title: "Message not sent", description: result.error })
        return
      }
      setBody("")
      setUploads((prev) => prev.filter((u) => !u.result))
      textareaRef.current?.focus()
    })
  }

  // Auto-grow up to ~8 lines.
  React.useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [body])

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs focus-within:border-ring/60">
      {uploads.length > 0 && (
        <ul className="flex flex-wrap gap-2 border-b border-border p-2">
          {uploads.map((u) => (
            <li
              key={u.key}
              className={cn(
                "relative flex max-w-60 items-center gap-2 overflow-hidden rounded-md border px-2 py-1.5 text-xs",
                u.error ? "border-destructive/30 bg-destructive-tint text-primary-strong" : "border-border bg-surface"
              )}
            >
              <FileIcon aria-hidden className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{u.file.name}</span>
                <span className="block text-muted-foreground">
                  {u.error ?? (u.result ? formatBytes(u.file.size) : `Uploading ${Math.round(u.progress * 100)}%`)}
                </span>
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
                <progress value={u.progress} max={1} aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 w-full appearance-none bg-transparent [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-primary" />
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-1 p-2">
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
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Attach files" onClick={() => inputRef.current?.click()} className="text-muted-foreground">
          <PaperclipIcon />
        </Button>
        <textarea
          ref={textareaRef}
          value={body}
          rows={1}
          placeholder={placeholder}
          aria-label="Message"
          onChange={(e) => {
            setBody(e.target.value)
            const now = Date.now()
            if (e.target.value && now - lastTyping.current > TYPING_THROTTLE_MS) {
              lastTyping.current = now
              void sendTyping(channelId)
            }
          }}
          onPaste={(e) => {
            if (e.clipboardData.files.length > 0) {
              e.preventDefault()
              addFiles(e.clipboardData.files)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          className="max-h-[200px] min-h-8 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button type="button" size="icon-sm" aria-label="Send message" disabled={!canSend} onClick={submit}>
          <SendHorizontalIcon />
        </Button>
      </div>
    </div>
  )
}

export { Composer }
