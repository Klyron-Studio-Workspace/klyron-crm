"use client"

import * as React from "react"
import { BotIcon, FileIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { CallCard } from "@/components/calls/call-card"
import { Attachment } from "@/components/files/attachment"
import { fileTypeInfo, previewKind, usePreview } from "@/components/files/file-preview"
import { useFileMeta } from "@/hooks/use-file-meta"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import { deleteMessage, editMessage } from "@/lib/actions/chat"
import { encodeMentions, mentionsIn, parseBody, plainText, type Mention } from "@/lib/chat/mentions"
import type { MessageDTO } from "@/lib/chat/types"
import { fileUrl, type FileDTO } from "@/lib/files/types"
import { formatDateTime, formatTime, initials } from "@/lib/format"
import { cn } from "@/lib/utils"

const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g

function Linkified({ text }: { text: string }) {
  return text.split(URL_PATTERN).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="link font-normal underline">
        {part}
      </a>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  )
}

/** Inline tag for a file: type icon + name; opens the previewer (or downloads when it can't be previewed). */
function FileMentionChip({ label, file }: { label: string; file: FileDTO | null | undefined }) {
  const { open, dialog } = usePreview()
  const info = file ? fileTypeInfo(file) : null
  const Icon = info?.Icon ?? FileIcon
  const unavailable = file === null
  return (
    <>
      <button
        type="button"
        disabled={unavailable}
        title={unavailable ? "This file was deleted or you don't have access to it" : file ? `Preview ${file.name}` : undefined}
        onClick={() => {
          if (!file) return
          if (previewKind(file) === "none") window.open(fileUrl(file.id, { download: true }), "_self")
          else open(file)
        }}
        className={cn(
          "inline-flex max-w-full translate-y-px items-center gap-1 rounded-md border border-border bg-card py-px pr-1.5 pl-1 align-baseline text-[13px] font-medium shadow-xs transition-colors duration-150 ease-out hover:border-primary/30 hover:bg-primary-tint hover:text-primary-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          unavailable && "cursor-not-allowed text-muted-foreground line-through hover:border-border hover:bg-card hover:text-muted-foreground"
        )}
      >
        <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-sm", info?.tone ?? "bg-muted text-muted-foreground")}>
          <Icon aria-hidden className="size-3" />
        </span>
        <span className="truncate">{label}</span>
      </button>
      {dialog}
    </>
  )
}

function MentionChip({ mention, currentUserId, files }: { mention: Mention; currentUserId: string; files: Record<string, FileDTO | null> }) {
  if (mention.kind === "file" && mention.id) return <FileMentionChip label={mention.label} file={files[mention.id]} />
  if (mention.kind === "ai") {
    return (
      <span className="inline-flex translate-y-px items-center gap-1 rounded-full bg-gradient-to-r from-primary to-primary-hover py-px pr-2 pl-1 align-baseline text-xs font-semibold text-primary-foreground shadow-xs">
        <span className="flex size-4 items-center justify-center rounded-full bg-white/20">
          <BotIcon aria-hidden className="size-3" />
        </span>
        {mention.label}
      </span>
    )
  }
  const isMe = mention.id === currentUserId
  return (
    <span className={cn("rounded-md px-1 font-medium", isMe ? "bg-primary text-primary-foreground" : "bg-primary-tint text-primary-strong")}>
      @{mention.label}
    </span>
  )
}

/** Plain text with mention chips and safe, clickable links. Never renders HTML from the message. */
function MessageBody({ text, currentUserId, files }: { text: string; currentUserId: string; files: Record<string, FileDTO | null> }) {
  return (
    <p className="text-sm break-words whitespace-pre-wrap">
      {parseBody(text).map((part, i) =>
        part.type === "text" ? <Linkified key={i} text={part.text} /> : <MentionChip key={i} mention={part.mention} currentUserId={currentUserId} files={files} />
      )}
    </p>
  )
}


type MessageItemProps = {
  message: MessageDTO
  /** Same author as the previous message within a few minutes: hide the header. */
  compact: boolean
  isOwn: boolean
  canModerate: boolean
  /** Team view: label messages written by the client. */
  showClientBadge: boolean
  currentUserId: string
}

function MessageItem({ message, compact, isOwn, canModerate, showClientBadge, currentUserId }: MessageItemProps) {
  const toast = useToast()
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(() => plainText(message.body))
  const [pending, startTransition] = React.useTransition()
  const created = new Date(message.createdAt)
  // Files tagged with "@": shown inline as chips and as cards under the message.
  const taggedIds = React.useMemo(
    () => [...new Set(mentionsIn(message.body).flatMap((m) => (m.kind === "file" && m.id ? [m.id] : [])))].filter((id) => !message.files.some((f) => f.id === id)),
    [message.body, message.files]
  )
  const taggedFiles = useFileMeta(message.deleted ? [] : taggedIds)
  const taggedCards = taggedIds.map((id) => taggedFiles[id]).filter((f): f is FileDTO => Boolean(f))

  function saveEdit() {
    const text = encodeMentions(draft.trim(), mentionsIn(message.body))
    if (!text || text === message.body) {
      setEditing(false)
      return
    }
    startTransition(async () => {
      const result = await editMessage(message.id, text)
      if (!result.ok) toast.add({ type: "error", title: "Couldn't edit message", description: result.error })
      else setEditing(false)
    })
  }

  return (
    <li className={cn("group/msg relative flex gap-3 rounded-lg px-2 py-1 hover:bg-surface", compact ? "mt-0" : "mt-3")}>
      <div className="w-8 shrink-0">
        {!compact && (
          <Avatar size="sm" className="size-8">
            <AvatarFallback className={cn("text-[11px] font-medium", message.fromClient && "bg-info-tint text-info", message.fromAi && "bg-primary text-primary-foreground")}>
              {message.fromAi ? <BotIcon aria-hidden className="size-4" /> : initials(message.authorName)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!compact && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{message.authorName}</span>
            {showClientBadge && message.fromClient && <Badge variant="info" className="h-4 rounded-sm px-1.5 text-[10px]">Client</Badge>}
            {message.fromAi && (
              <Badge variant="brand" className="h-4 gap-0.5 rounded-full px-1.5 text-[10px]">
                <BotIcon aria-hidden /> Assistant
              </Badge>
            )}
            <time suppressHydrationWarning dateTime={message.createdAt} title={formatDateTime(created)} className="text-xs text-muted-foreground">
              {formatTime(created)}
            </time>
          </div>
        )}
        {message.deleted ? (
          <p className="text-sm text-muted-foreground italic">Message deleted</p>
        ) : editing ? (
          <div className="flex flex-col gap-2 py-1">
            <Textarea
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  saveEdit()
                }
                if (e.key === "Escape") setEditing(false)
              }}
              aria-label="Edit message"
              className="min-h-16"
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={pending} onClick={saveEdit}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            {message.call ? <CallCard call={message.call} /> : message.body && <MessageBody text={message.body} currentUserId={currentUserId} files={taggedFiles} />}
            {message.editedAt && <span className="text-xs text-muted-foreground">(edited)</span>}
            {(message.files.length > 0 || taggedCards.length > 0) && (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {message.files.map((file) => (
                  <Attachment key={file.id} file={file} own={isOwn} />
                ))}
                {taggedCards.map((file) => (
                  <Attachment key={`tag-${file.id}`} file={file} own={isOwn} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {!message.deleted && !editing && (isOwn || canModerate) && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Message actions"
                className="absolute top-1 right-1 text-muted-foreground opacity-0 group-hover/msg:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            {isOwn && message.body && !message.call && (
              <DropdownMenuItem
                onClick={() => {
                  setDraft(plainText(message.body))
                  setEditing(true)
                }}
              >
                <PencilIcon /> Edit
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteMessage(message.id)
                  if (!result.ok) toast.add({ type: "error", title: "Couldn't delete message", description: result.error })
                })
              }
            >
              <Trash2Icon /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  )
}

export { MessageItem }
