"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { InboxIcon, SendIcon, FileEditIcon, ArchiveIcon, Trash2Icon, PencilLineIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

const folders = [
  { label: "Inbox",   value: "INBOX",   icon: InboxIcon },
  { label: "Sent",    value: "SENT",    icon: SendIcon },
  { label: "Drafts",  value: "DRAFTS",  icon: FileEditIcon },
  { label: "Archive", value: "ARCHIVE", icon: ArchiveIcon },
  { label: "Trash",   value: "TRASH",   icon: Trash2Icon },
] as const

type Props = { unread: number }

export function FolderNav({ unread }: Props) {
  const searchParams = useSearchParams()
  const activeFolder = searchParams.get("folder") ?? "INBOX"

  return (
    <div className="flex flex-col h-full">
      {/* Compose button */}
      <div className="p-3 border-b border-border">
        <Button nativeButton={false} render={<Link href="/mail?compose=1" />} className="w-full gap-2">
          <PencilLineIcon className="size-4" />
          Compose
        </Button>
      </div>

      {/* Folder list */}
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        {folders.map(({ label, value, icon: Icon }) => {
          const isActive = activeFolder === value
          return (
            <Link
              key={value}
              href={`/mail?folder=${value}`}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {value === "INBOX" && unread > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
