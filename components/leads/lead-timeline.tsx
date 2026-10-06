"use client"

import { useTransition } from "react"
import {
  ArrowRightIcon,
  BellIcon,
  BuildingIcon,
  CircleCheckIcon,
  MailIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  StickyNoteIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { deleteLeadNote } from "@/lib/actions/leads"
import { formatDateTime, formatRelative } from "@/lib/format"
import { lostReasonLabel, noteTypeLabels, type NoteTypeKey } from "@/lib/leads/constants"
import type { TimelineItem } from "@/lib/leads/types"

const noteIcons: Record<NoteTypeKey, LucideIcon> = {
  NOTE: StickyNoteIcon,
  CALL: PhoneIcon,
  MEETING: UsersIcon,
  EMAIL: MailIcon,
}

function describeEvent(action: string, m: Record<string, unknown> | null): { icon: LucideIcon; text: string } {
  const s = (key: string) => (typeof m?.[key] === "string" ? (m[key] as string) : "")
  switch (action) {
    case "lead.create":
      return { icon: PlusIcon, text: `created this lead in ${s("stage")}` }
    case "lead.stage":
      return { icon: ArrowRightIcon, text: `moved it from ${s("from")} to ${s("to")}` }
    case "lead.lost":
      return {
        icon: XCircleIcon,
        text: `marked it lost: ${lostReasonLabel(s("reason"))}${s("detail") ? ` — “${s("detail")}”` : ""}`,
      }
    case "lead.assign":
      return { icon: UserIcon, text: `assigned it to ${s("to")}` }
    case "lead.update": {
      const fields = Array.isArray(m?.fields) ? (m.fields as string[]) : []
      return { icon: PencilIcon, text: fields.length ? `updated ${fields.join(", ")}` : "updated the details" }
    }
    case "lead.reminder.create":
      return { icon: BellIcon, text: `scheduled a follow-up: ${s("note")}` }
    case "lead.reminder.complete":
      return { icon: CircleCheckIcon, text: `completed a follow-up: ${s("note")}` }
    case "lead.convert":
      return { icon: BuildingIcon, text: `converted it to client ${s("client")}` }
    case "lead.note.delete":
      return { icon: Trash2Icon, text: "deleted an entry" }
    default:
      return { icon: PencilIcon, text: action }
  }
}

function DeleteNoteButton({ noteId }: { noteId: string }) {
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label="Delete entry"
      disabled={pending}
      className="text-muted-foreground opacity-0 group-hover/entry:opacity-100 focus-visible:opacity-100"
      onClick={() =>
        startTransition(async () => {
          const result = await deleteLeadNote(noteId)
          if (!result.ok) toast.add({ type: "error", title: "Couldn't delete", description: result.error })
        })
      }
    >
      <Trash2Icon />
    </Button>
  )
}

function LeadTimeline({ items, currentUserId, canModerate }: { items: TimelineItem[]; currentUserId: string; canModerate: boolean }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
  }
  return (
    <ol className="relative flex flex-col">
      {items.map((item, index) => {
        const last = index === items.length - 1
        const time = (
          <time suppressHydrationWarning dateTime={item.at} title={formatDateTime(new Date(item.at))} className="text-xs text-muted-foreground">
            {formatRelative(new Date(item.at))}
          </time>
        )
        if (item.kind === "event") {
          const { icon: Icon, text } = describeEvent(item.action, item.metadata)
          return (
            <li key={item.id} className="relative flex gap-3 pb-5">
              {!last && <span aria-hidden className="absolute top-7 bottom-0 left-3.5 w-px bg-border" />}
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                <Icon aria-hidden className="size-3.5" />
              </span>
              <p className="pt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{item.actorName ?? "Someone"}</span> {text} · {time}
              </p>
            </li>
          )
        }
        const Icon = noteIcons[item.type]
        return (
          <li key={item.id} className="group/entry relative flex gap-3 pb-5">
            {!last && <span aria-hidden className="absolute top-7 bottom-0 left-3.5 w-px bg-border" />}
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground">
              <Icon aria-hidden className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-3 shadow-xs">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-sm">
                  <span className="font-medium">{item.authorName}</span>{" "}
                  <span className="text-muted-foreground">
                    logged a {noteTypeLabels[item.type].toLowerCase()} · {time}
                  </span>
                </p>
                {(item.authorId === currentUserId || canModerate) && <DeleteNoteButton noteId={item.id} />}
              </div>
              <p className="text-sm whitespace-pre-wrap">{item.body}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export { LeadTimeline }
