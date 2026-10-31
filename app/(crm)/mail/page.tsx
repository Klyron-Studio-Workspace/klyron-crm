import { Suspense } from "react"
import { countUnread, getEmail, listEmails } from "@/lib/actions/mail"
import { ThreadList } from "@/components/mail/thread-list"
import { EmailReader } from "@/components/mail/email-reader"
import { MobileFolderBar } from "@/components/mail/folder-nav"
import { cn } from "@/lib/utils"
import type { EmailFolder } from "@/lib/generated/prisma/enums"

type Props = {
  searchParams: Promise<{ folder?: string; id?: string }>
}

export default async function MailPage({ searchParams }: Props) {
  const { folder, id } = await searchParams
  const activeFolder = (folder as EmailFolder) || "INBOX"

  const folderLabel = activeFolder.charAt(0) + activeFolder.slice(1).toLowerCase()

  const [emails, activeEmail, unread] = await Promise.all([
    listEmails(activeFolder),
    id ? getEmail(id) : Promise.resolve(null),
    countUnread(),
  ])

  // Phones show one panel at a time: the list, or the open email with a way back.
  return (
    <>
      {/* Centre panel — thread list */}
      <div className={cn("w-full flex-col border-r border-border md:flex md:w-72 md:shrink-0", id ? "hidden" : "flex")}>
        <Suspense>
          <MobileFolderBar unread={unread} />
        </Suspense>
        <div className="hidden h-12 shrink-0 items-center border-b border-border px-4 md:flex">
          <h3 className="text-sm font-semibold">{folderLabel}</h3>
        </div>
        <Suspense>
          <ThreadList
            emails={emails as never}
            selectedId={id ?? null}
          />
        </Suspense>
      </div>

      {/* Right panel — reader */}
      <div className={cn("min-w-0 flex-1 md:flex", id ? "flex" : "hidden")}>
        <EmailReader email={activeEmail as never} backHref={`/mail?folder=${activeFolder}`} />
      </div>
    </>
  )
}
