import type { Metadata } from "next"
import Link from "next/link"
import { FolderOpenIcon } from "lucide-react"

import { EmptyState } from "@/components/crm/empty-state"
import { FileTable } from "@/components/files/file-table"
import { UploadDialog } from "@/components/files/upload-dialog"
import { PageHeader } from "@/components/layout/page-header"
import { can, requirePermission } from "@/lib/auth/dal"
import { memberClientScope } from "@/lib/chat/access"
import { db } from "@/lib/db"
import { listFiles } from "@/lib/files/queries"
import type { FileKindKey } from "@/lib/files/types"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Files" }

const kinds: { value: FileKindKey | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "IMAGE", label: "Images" },
  { value: "VIDEO", label: "Videos" },
  { value: "DOCUMENT", label: "Documents" },
  { value: "OTHER", label: "Other" },
]

export default async function FilesPage({ searchParams }: PageProps<"/files">) {
  const user = await requirePermission("files", "READ")
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const kindParam = one(sp.kind)
  const kind = kinds.some((k) => k.value === kindParam && k.value !== "all") ? (kindParam as FileKindKey) : undefined
  const clientId = one(sp.client)

  const scope = await memberClientScope(user)
  const [files, canWrite, clients, projects] = await Promise.all([
    listFiles(user, { kind, clientId }),
    can(user, "files", "WRITE"),
    db.client.findMany({ where: scope ? { id: { in: scope } } : {}, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({
      where: { status: { not: "CANCELLED" }, ...(scope ? { clientId: { in: scope } } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
  ])
  const activeClient = clients.find((c) => c.id === clientId)

  const href = (next: { kind?: string; client?: string | null }) => {
    const params = new URLSearchParams()
    const k = next.kind ?? kindParam
    const c = next.client === undefined ? clientId : next.client
    if (k && k !== "all") params.set("kind", k)
    if (c) params.set("client", c)
    const qs = params.toString()
    return qs ? `/files?${qs}` : "/files"
  }

  return (
    <>
      <PageHeader
        title="Files"
        description={activeClient ? `Files for ${activeClient.name}.` : "Every client file, including attachments shared in client chats."}
        actions={canWrite && clients.length > 0 && <UploadDialog clients={clients} projects={projects} allowPrivate defaultClientId={clientId} />}
      />
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="File type" className="inline-flex rounded-md border border-border bg-background p-0.5">
          {kinds.map((k) => {
            const active = (kind ?? "all") === k.value
            return (
              <Link
                key={k.value}
                href={href({ kind: k.value })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-7 items-center rounded-sm px-3 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground",
                  active && "bg-muted font-medium text-foreground"
                )}
              >
                {k.label}
              </Link>
            )
          })}
        </nav>
        {activeClient && (
          <Link href={href({ client: null })} className="link text-sm">
            Show all clients
          </Link>
        )}
      </div>
      {files.length === 0 ? (
        <EmptyState
          icon={FolderOpenIcon}
          title="No files yet."
          description="Upload briefs, assets and deliverables here, or share them in a client's chat."
        />
      ) : (
        <FileTable files={files} currentUserId={user.id} canModerate={user.role === "OWNER" || user.role === "ADMIN"} teamView />
      )}
    </>
  )
}
