"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  DownloadIcon,
  FileAudioIcon,
  FileIcon,
  FileTextIcon,
  FileVideoIcon,
  FolderIcon,
  FolderInputIcon,
  ImageIcon,
  LockIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/toast"
import { formatDate } from "@/lib/format"
import type { FileRowDTO } from "@/lib/files/queries"
import { fileUrl, formatBytes, type FileKindKey } from "@/lib/files/types"
import { usePreview } from "@/components/files/file-preview"
import { updateCompanyFile } from "@/lib/actions/files"
import { deleteUploadedFile } from "@/lib/files/upload-client"

const kindIcons: Record<FileKindKey, LucideIcon> = {
  IMAGE: ImageIcon,
  VIDEO: FileVideoIcon,
  AUDIO: FileAudioIcon,
  DOCUMENT: FileTextIcon,
  OTHER: FileIcon,
}

type FileTableProps = {
  files: FileRowDTO[]
  currentUserId: string
  canModerate: boolean
  /** Team view shows client/project and sharing columns. */
  teamView: boolean
  /** Company vault: folder and access columns, plus "Move / edit". */
  company?: { folders: string[]; canRestrict: boolean }
}

function EditCompanyFile({ file, folders, canRestrict, onClose }: { file: FileRowDTO; folders: string[]; canRestrict: boolean; onClose: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const [folder, setFolder] = React.useState(file.folder ?? "")
  const [restricted, setRestricted] = React.useState(file.restricted)
  const [pending, startTransition] = React.useTransition()
  const listId = React.useId()
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const result = await updateCompanyFile(file.id, { folder, restricted })
          if (!result.ok) toast.add({ type: "error", title: "Couldn't update document", description: result.error })
          else {
            toast.add({ type: "success", title: "Document updated" })
            router.refresh()
            onClose()
          }
        })
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-folder">Folder</Label>
        <Input id="edit-folder" list={listId} value={folder} maxLength={80} placeholder="No folder" onChange={(e) => setFolder(e.target.value)} />
        <datalist id={listId}>
          {folders.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </div>
      {canRestrict && (
        <label className="flex items-start gap-3 rounded-lg border border-border p-3">
          <input type="checkbox" checked={restricted} onChange={(e) => setRestricted(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Restricted</span>
            <span className="text-sm text-muted-foreground">Only Owners and Admins can see it.</span>
          </span>
        </label>
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="secondary" />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function FileTable({ files, currentUserId, canModerate, teamView, company }: FileTableProps) {
  const router = useRouter()
  const toast = useToast()
  const [pending, startTransition] = React.useTransition()
  const [editing, setEditing] = React.useState<FileRowDTO | null>(null)
  const [deleting, setDeleting] = React.useState<FileRowDTO | null>(null)
  const preview = usePreview()
  const clientColumns = teamView && !company

  return (
    <>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File</TableHead>
          {clientColumns && <TableHead>Client</TableHead>}
          {company && <TableHead>Folder</TableHead>}
          <TableHead>Size</TableHead>
          <TableHead>Uploaded</TableHead>
          {(clientColumns || company) && <TableHead>{company ? "Access" : "Visibility"}</TableHead>}
          <TableHead className="w-20">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.map((file) => {
          const Icon = kindIcons[file.kind]
          const canDelete = file.uploadedById === currentUserId || canModerate
          return (
            <TableRow key={file.id}>
              <TableCell className="max-w-80">
                <div className="flex items-center gap-3">
                  {file.hasThumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element -- authenticated API URL
                    <img src={fileUrl(file.id, { thumb: true })} alt="" loading="lazy" className="size-9 shrink-0 rounded-md border border-border object-cover" />
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon aria-hidden className="size-4" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <button type="button" onClick={() => preview.open(file)} className="block max-w-full truncate text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none">
                      {file.name}
                    </button>
                    {file.project && <span className="block truncate text-xs text-muted-foreground">{file.project.name}</span>}
                  </div>
                </div>
              </TableCell>
              {clientColumns && <TableCell className="text-muted-foreground">{file.client?.name ?? "—"}</TableCell>}
              {company && (
                <TableCell className="text-muted-foreground">
                  {file.folder ? (
                    <span className="inline-flex items-center gap-1.5">
                      <FolderIcon aria-hidden className="size-3.5" />
                      {file.folder}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
              )}
              <TableCell className="text-muted-foreground tabular-nums">{formatBytes(file.size)}</TableCell>
              <TableCell className="text-muted-foreground">
                <span className="block">{formatDate(new Date(file.createdAt))}</span>
                <span className="block text-xs">
                  {file.uploadedBy ?? "Unknown"}
                  {file.inChat && " · in chat"}
                </span>
              </TableCell>
              {company && (
                <TableCell>
                  {file.restricted ? (
                    <Badge variant="brand" className="gap-1 rounded-md">
                      <LockIcon aria-hidden /> Owners &amp; Admins
                    </Badge>
                  ) : (
                    <Badge variant="neutral" className="rounded-md">Team</Badge>
                  )}
                </TableCell>
              )}
              {clientColumns && (
                <TableCell>
                  {file.fromClient ? (
                    <Badge variant="info" className="rounded-md">From client</Badge>
                  ) : file.sharedWithClient ? (
                    <Badge variant="success" className="rounded-md">Shared</Badge>
                  ) : (
                    <Badge variant="neutral" className="rounded-md">Internal</Badge>
                  )}
                </TableCell>
              )}
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={`Download ${file.name}`} nativeButton={false} render={<a href={fileUrl(file.id, { download: true })} />}>
                    <DownloadIcon />
                  </Button>
                  {company && canDelete && (
                    <Button variant="ghost" size="icon-sm" aria-label={`Move or edit ${file.name}`} onClick={() => setEditing(file)}>
                      <FolderInputIcon />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${file.name}`}
                      disabled={pending}
                      className="text-muted-foreground hover:text-primary-strong"
                      onClick={() => setDeleting(file)}
                    >
                      <Trash2Icon />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>

    {preview.dialog}

    <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move or edit</DialogTitle>
          <DialogDescription className="truncate">{editing?.name}</DialogDescription>
        </DialogHeader>
        {editing && company && (
          <EditCompanyFile key={editing.id} file={editing} folders={company.folders} canRestrict={company.canRestrict} onClose={() => setEditing(null)} />
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this file?</DialogTitle>
          <DialogDescription className="truncate">{deleting?.name} will be removed for everyone. This can&rsquo;t be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              const file = deleting
              setDeleting(null)
              if (!file) return
              startTransition(async () => {
                await deleteUploadedFile(file.id)
                toast.add({ type: "success", title: "File deleted" })
                router.refresh()
              })
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

export { FileTable }
