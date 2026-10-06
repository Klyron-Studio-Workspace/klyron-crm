"use client"

import * as React from "react"
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { Attachment } from "@/components/files/attachment"
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
import type { MessageDTO } from "@/lib/chat/types"
import { formatDateTime, formatTime, initials } from "@/lib/format"
import { cn } from "@/lib/utils"

const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g

/** Plain text with safe, clickable links. Never renders HTML from the message. */
function MessageBody({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN)
  return (
    <p className="text-sm break-words whitespace-pre-wrap">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="link font-normal underline">
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
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
}

function MessageItem({ message, compact, isOwn, canModerate, showClientBadge }: MessageItemProps) {
  const toast = useToast()
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(message.body)
  const [pending, startTransition] = React.useTransition()
  const created = new Date(message.createdAt)

  function saveEdit() {
    const text = draft.trim()
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
            <AvatarFallback className={cn("text-[11px] font-medium", message.fromClient && "bg-info-tint text-info")}>
              {initials(message.authorName)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!compact && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{message.authorName}</span>
            {showClientBadge && message.fromClient && <Badge variant="info" className="h-4 rounded-sm px-1.5 text-[10px]">Client</Badge>}
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
            {message.body && <MessageBody text={message.body} />}
            {message.editedAt && <span className="text-xs text-muted-foreground">(edited)</span>}
            {message.files.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {message.files.map((file) => (
                  <Attachment key={file.id} file={file} />
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
            {isOwn && message.body && (
              <DropdownMenuItem
                onClick={() => {
                  setDraft(message.body)
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
