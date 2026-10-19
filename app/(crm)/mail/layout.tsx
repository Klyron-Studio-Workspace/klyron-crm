import { Suspense } from "react"
import { countUnread } from "@/lib/actions/mail"
import { FolderNav } from "@/components/mail/folder-nav"
import { ComposeTrigger } from "@/components/mail/compose-trigger"

export default async function MailLayout({ children }: { children: React.ReactNode }) {
  const unread = await countUnread()

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100svh-3.5rem)] overflow-hidden lg:-mx-8 lg:-my-8">
      {/* Left panel — folder nav */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-sidebar flex-col md:flex">
        <div className="flex h-12 shrink-0 items-center border-b border-border px-4">
          <span className="text-sm font-semibold tracking-tight">Mail</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <FolderNav unread={unread} />
        </div>
      </aside>

      {/* Centre + right panels */}
      <div className="flex flex-1 overflow-hidden min-w-0">{children}</div>

      {/* Compose dialog — URL-driven, client-side */}
      <Suspense>
        <ComposeTrigger />
      </Suspense>
    </div>
  )
}
