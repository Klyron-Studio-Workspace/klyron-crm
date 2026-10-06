import type { Metadata } from "next"
import { FolderOpenIcon } from "lucide-react"

import { EmptyState } from "@/components/crm/empty-state"
import { FileTable } from "@/components/files/file-table"
import { UploadDialog } from "@/components/files/upload-dialog"
import { PageHeader } from "@/components/layout/page-header"
import { can, requireClientUser } from "@/lib/auth/dal"
import { listFiles } from "@/lib/files/queries"

export const metadata: Metadata = { title: "Files" }

export default async function PortalFilesPage() {
  const user = await requireClientUser()
  const [files, canRead, canWrite] = await Promise.all([
    listFiles(user),
    can(user, "files", "READ"),
    can(user, "files", "WRITE"),
  ])
  if (!canRead) {
    return <EmptyState icon={FolderOpenIcon} title="Files aren't available." description="Ask your Klyron contact if you need access." />
  }

  return (
    <>
      <PageHeader
        title="Files"
        description="Everything shared between you and Klyron Studio."
        actions={canWrite && <UploadDialog clients={[]} projects={[]} fixedClientId={user.clientId} allowPrivate={false} />}
      />
      {files.length === 0 ? (
        <EmptyState icon={FolderOpenIcon} title="Nothing shared yet." description="Files from your projects and conversations will appear here." />
      ) : (
        <FileTable files={files} currentUserId={user.id} canModerate={false} teamView={false} />
      )}
    </>
  )
}
