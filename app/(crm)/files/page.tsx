import type { Metadata } from "next"
import Link from "next/link"
import { BuildingIcon, FolderIcon, FolderOpenIcon, LandmarkIcon, LockIcon } from "lucide-react"

import { EmptyState } from "@/components/crm/empty-state"
import { CompanyUploadDialog } from "@/components/files/company-upload-dialog"
import { FileTable } from "@/components/files/file-table"
import { UploadDialog } from "@/components/files/upload-dialog"
import { PageHeader } from "@/components/layout/page-header"
import { can, requirePermission } from "@/lib/auth/dal"
import { isTeamRole } from "@/lib/auth/permissions"
import { memberClientScope } from "@/lib/chat/access"
import { db } from "@/lib/db"
import { getCompanyFolders, listCompanyFiles, listFiles } from "@/lib/files/queries"
import type { FileKindKey } from "@/lib/files/types"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Files" }

const kinds: { value: FileKindKey | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "DOCUMENT", label: "Documents" },
  { value: "IMAGE", label: "Images" },
  { value: "VIDEO", label: "Videos" },
  { value: "OTHER", label: "Other" },
]

const pill =
  "inline-flex h-7 items-center gap-1.5 rounded-sm px-3 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"

export default async function FilesPage({ searchParams }: PageProps<"/files">) {
  const user = await requirePermission("files", "READ")
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const kindParam = one(sp.kind)
  const kind = kinds.some((k) => k.value === kindParam && k.value !== "all") ? (kindParam as FileKindKey) : undefined
  const clientId = one(sp.client)
  const folderParam = one(sp.folder)
  // Opening a client's files (from a client page) lands in the Clients space.
  const space: "company" | "clients" = !isTeamRole(user.role) ? "clients" : one(sp.space) === "clients" || clientId ? "clients" : "company"
  const isAdmin = user.role === "OWNER" || user.role === "ADMIN"

  const scope = await memberClientScope(user)
  const [canWrite, clients, projects, folders, files] = await Promise.all([
    can(user, "files", "WRITE"),
    db.client.findMany({ where: scope ? { id: { in: scope } } : {}, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({
      where: { status: { not: "CANCELLED" }, ...(scope ? { clientId: { in: scope } } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
    getCompanyFolders(user),
    space === "company" ? listCompanyFiles(user, { kind, folder: folderParam }) : listFiles(user, { kind, clientId }),
  ])
  const activeClient = clients.find((c) => c.id === clientId)
  const folderNames = folders.flatMap((f) => (f.name ? [f.name] : []))
  const companyTotal = folders.reduce((n, f) => n + f.count, 0)

  const href = (next: { space?: string; kind?: string; client?: string | null; folder?: string | null }) => {
    const params = new URLSearchParams()
    const s = next.space ?? space
    if (s === "clients") params.set("space", "clients")
    const k = next.kind ?? kindParam
    if (k && k !== "all") params.set("kind", k)
    if (s === "clients") {
      const c = next.client === undefined ? clientId : next.client
      if (c) params.set("client", c)
    } else {
      const f = next.folder === undefined ? folderParam : next.folder
      if (f) params.set("folder", f)
    }
    const qs = params.toString()
    return qs ? `/files?${qs}` : "/files"
  }

  const upload =
    canWrite &&
    (space === "company" ? (
      <CompanyUploadDialog folders={folderNames} defaultFolder={folderParam && folderParam !== "__none__" ? folderParam : undefined} canRestrict={isAdmin} />
    ) : (
      clients.length > 0 && <UploadDialog clients={clients} projects={projects} allowPrivate defaultClientId={clientId} />
    ))

  return (
    <>
      <PageHeader
        title="Files"
        description={
          space === "company"
            ? "The studio's document vault: contracts, brand assets, templates and policies. Clients never see these."
            : activeClient
              ? `Files for ${activeClient.name}.`
              : "Every client file, including attachments shared in client chats."
        }
        actions={upload}
      />

      <div className="flex flex-col gap-4">
        {/* Space switch */}
        <nav aria-label="File space" className="-mb-px flex gap-6 border-b border-border">
          {[
            { value: "company", label: "Company", icon: LandmarkIcon },
            { value: "clients", label: "Clients", icon: BuildingIcon },
          ].map((tab) => {
            const active = space === tab.value
            return (
              <Link
                key={tab.value}
                href={href({ space: tab.value, client: null, folder: null })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex items-center gap-2 border-b-2 py-2.5 text-sm font-medium transition-colors duration-150 ease-out",
                  active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon aria-hidden className="size-4" />
                {tab.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="File type" className="inline-flex rounded-md border border-border bg-background p-0.5">
            {kinds.map((k) => {
              const active = (kind ?? "all") === k.value
              return (
                <Link key={k.value} href={href({ kind: k.value })} aria-current={active ? "page" : undefined} className={cn(pill, active && "bg-muted font-medium text-foreground")}>
                  {k.label}
                </Link>
              )
            })}
          </nav>
          {space === "clients" && activeClient && (
            <Link href={href({ client: null })} className="link text-sm">
              Show all clients
            </Link>
          )}
        </div>

        {space === "company" && folders.length > 0 && (
          <nav aria-label="Folders" className="flex flex-wrap gap-2">
            <Link
              href={href({ folder: null })}
              aria-current={!folderParam ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors duration-150 ease-out",
                !folderParam ? "border-primary/30 bg-primary-tint font-medium text-primary-strong" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <FolderOpenIcon aria-hidden className="size-4" />
              All documents
              <span className="text-xs tabular-nums opacity-70">{companyTotal}</span>
            </Link>
            {folders.map((f) => {
              const value = f.name ?? "__none__"
              const active = folderParam === value
              return (
                <Link
                  key={value}
                  href={href({ folder: value })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors duration-150 ease-out",
                    active ? "border-primary/30 bg-primary-tint font-medium text-primary-strong" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <FolderIcon aria-hidden className="size-4" />
                  {f.name ?? "No folder"}
                  <span className="text-xs tabular-nums opacity-70">{f.count}</span>
                </Link>
              )
            })}
          </nav>
        )}
      </div>

      {files.length === 0 ? (
        space === "company" ? (
          <EmptyState
            icon={LockIcon}
            title={folderParam || kind ? "Nothing here." : "Your document vault is empty."}
            description={
              folderParam || kind
                ? "No documents match this filter."
                : "Upload contracts, brand assets, templates and policies with “Upload documents”. Organise them into folders, and mark sensitive ones Restricted."
            }
          />
        ) : (
          <EmptyState
            icon={FolderOpenIcon}
            title="No client files yet."
            description={clients.length === 0 ? "Add a client first; their files will appear here." : "Upload briefs, assets and deliverables here, or share them in a client's chat."}
          />
        )
      ) : (
        <FileTable
          files={files}
          currentUserId={user.id}
          canModerate={isAdmin}
          teamView
          company={space === "company" ? { folders: folderNames, canRestrict: isAdmin } : undefined}
        />
      )}
    </>
  )
}
