import { Suspense } from "react"
import { getEmail, listEmails } from "@/lib/actions/mail"
import { ThreadList } from "@/components/mail/thread-list"
import { EmailReader } from "@/components/mail/email-reader"
import type { EmailFolder } from "@/lib/generated/prisma/enums"

type Props = {
  searchParams: Promise<{ folder?: string; id?: string; compose?: string }>
}

export default async function MailPage({ searchParams }: Props) {
  const { folder, id } = await searchParams
  const activeFolder = (folder as EmailFolder) || "INBOX"

  const [emails, activeEmail] = await Promise.all([
    listEmails(activeFolder),
    id ? getEmail(id) : Promise.resolve(null),
  ])

  return (
    <>
      {/* Centre panel — thread list */}
      <div className="flex w-72 shrink-0 flex-col border-r">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold capitalize">{activeFolder.toLowerCase()}</h3>
          <a
            href="/mail?compose=1"
            className="rounded-md bg-[#DC143C] px-3 py-1.5 text-xs font-medium text-white"
          >
            Compose
          </a>
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
