"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  DownloadIcon,
  FileAudioIcon,
  FileIcon,
  FileTextIcon,
  FileVideoIcon,
  ImageIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/toast"
import { formatDate } from "@/lib/format"
import type { FileRowDTO } from "@/lib/files/queries"
import { fileUrl, formatBytes, type FileKindKey } from "@/lib/files/types"
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
}

function FileTable({ files, currentUserId, canModerate, teamView }: FileTableProps) {
  const router = useRouter()
  const toast = useToast()
  const [pending, startTransition] = React.useTransition()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File</TableHead>
          {teamView && <TableHead>Client</TableHead>}
          <TableHead>Size</TableHead>
          <TableHead>Uploaded</TableHead>
          {teamView && <TableHead>Visibility</TableHead>}
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
                    <a href={fileUrl(file.id)} target="_blank" rel="noopener" className="block truncate font-medium hover:underline">
                      {file.name}
                    </a>
                    {file.project && <span className="block truncate text-xs text-muted-foreground">{file.project.name}</span>}
                  </div>
                </div>
              </TableCell>
              {teamView && <TableCell className="text-muted-foreground">{file.client?.name ?? "—"}</TableCell>}
              <TableCell className="text-muted-foreground tabular-nums">{formatBytes(file.size)}</TableCell>
              <TableCell className="text-muted-foreground">
                <span className="block">{formatDate(new Date(file.createdAt))}</span>
                <span className="block text-xs">
                  {file.uploadedBy ?? "Unknown"}
                  {file.inChat && " · in chat"}
                </span>
              </TableCell>
              {teamView && (
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
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${file.name}`}
                      disabled={pending}
                      className="text-muted-foreground hover:text-primary-strong"
                      onClick={() =>
                        startTransition(async () => {
                          if (!window.confirm(`Delete ${file.name}? This can't be undone.`)) return
                          await deleteUploadedFile(file.id)
                          toast.add({ type: "success", title: "File deleted" })
                          router.refresh()
                        })
                      }
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
  )
}

export { FileTable }
