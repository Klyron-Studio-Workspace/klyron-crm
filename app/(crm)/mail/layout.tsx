import { Suspense } from "react"
import { countUnread } from "@/lib/actions/mail"
import { FolderNav } from "@/components/mail/folder-nav"
import { ComposeTrigger } from "@/components/mail/compose-trigger"

export default async function MailLayout({ children }: { children: React.ReactNode }) {
  const unread = await countUnread()

  return (
    <div data-full-bleed className="flex h-[calc(100svh-3.5rem)] overflow-hidden">
      {/* Left panel — folder nav, styled like the main sidebar */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <FolderNav unread={unread} />
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
