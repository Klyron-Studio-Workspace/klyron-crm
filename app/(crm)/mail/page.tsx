import { Suspense } from "react"
import { getEmail, listEmails } from "@/lib/actions/mail"
import { ThreadList } from "@/components/mail/thread-list"
import { EmailReader } from "@/components/mail/email-reader"
import type { EmailFolder } from "@/lib/generated/prisma/enums"

type Props = {
  searchParams: Promise<{ folder?: string; id?: string }>
}

export default async function MailPage({ searchParams }: Props) {
  const { folder, id } = await searchParams
  const activeFolder = (folder as EmailFolder) || "INBOX"

  const folderLabel = activeFolder.charAt(0) + activeFolder.slice(1).toLowerCase()

  const [emails, activeEmail] = await Promise.all([
    listEmails(activeFolder),
    id ? getEmail(id) : Promise.resolve(null),
  ])

  return (
    <>
      {/* Centre panel — thread list */}
      <div className="flex w-72 shrink-0 flex-col border-r border-border">
        <div className="flex h-12 shrink-0 items-center border-b border-border px-4">
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
      <EmailReader email={activeEmail as never} />
    </>
  )
}
