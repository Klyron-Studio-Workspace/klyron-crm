import { countUnread } from "@/lib/actions/mail"
import { FolderNav } from "@/components/mail/folder-nav"

export default async function MailLayout({ children }: { children: React.ReactNode }) {
  const unread = await countUnread()

  return (
    <div className="flex h-[calc(100vh-var(--header-height,56px))] overflow-hidden">
      {/* Left panel — folder nav */}
      <aside className="hidden w-56 shrink-0 border-r flex-col md:flex">
        <div className="border-b p-4">
          <h2 className="text-sm font-semibold">Mail</h2>
        </div>
        <FolderNav unread={unread} />
      </aside>

      {/* Centre + right panels */}
      <div className="flex flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
