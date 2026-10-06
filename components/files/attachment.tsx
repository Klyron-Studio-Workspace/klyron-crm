"use client"

import * as React from "react"
import { DownloadIcon, FileArchiveIcon, FileIcon, FileTextIcon } from "lucide-react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { fileUrl, formatBytes, type FileDTO } from "@/lib/files/types"
import { cn } from "@/lib/utils"

function FileChip({ file, className }: { file: FileDTO; className?: string }) {
  const Icon = file.kind === "DOCUMENT" ? FileTextIcon : /zip|rar|7z|tar|gzip/.test(file.mimeType) ? FileArchiveIcon : FileIcon
  return (
    <a
      href={fileUrl(file.id, { download: true })}
      className={cn(
        "group/file flex max-w-xs items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors duration-150 ease-out hover:border-input hover:bg-surface",
        className
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{file.name}</span>
        <span className="block text-xs text-muted-foreground">{formatBytes(file.size)}</span>
      </span>
      <DownloadIcon aria-hidden className="size-4 shrink-0 text-muted-foreground group-hover/file:text-foreground" />
      <span className="sr-only">Download</span>
    </a>
  )
}

function ImageAttachment({ file }: { file: FileDTO }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block overflow-hidden rounded-lg border border-border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Open image ${file.name}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API URL, not optimizable */}
        <img
          src={fileUrl(file.id, { thumb: file.hasThumbnail })}
          alt={file.name}
          loading="lazy"
          width={file.width ?? undefined}
          height={file.height ?? undefined}
          className="block h-auto max-h-72 w-auto max-w-[min(100%,24rem)] object-cover"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(96vw,1200px)] gap-3 p-3 sm:max-w-[min(96vw,1200px)]">
          <DialogTitle className="truncate pr-10 text-sm">{file.name}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element -- full-size original */}
          <img src={fileUrl(file.id)} alt={file.name} className="max-h-[80vh] w-full rounded-lg object-contain" />
          <a href={fileUrl(file.id, { download: true })} className="link inline-flex items-center gap-1.5 self-start text-sm">
            <DownloadIcon aria-hidden className="size-4" /> Download original ({formatBytes(file.size)})
          </a>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Renders an attachment by kind: inline image, playable video/audio, or a download chip. */
function Attachment({ file }: { file: FileDTO }) {
  if (file.kind === "IMAGE" && file.mimeType !== "image/svg+xml") return <ImageAttachment file={file} />
  if (file.kind === "VIDEO") {
    return (
      <div className="flex max-w-md flex-col gap-1">
        <video controls preload="metadata" src={fileUrl(file.id)} className="max-h-80 w-full rounded-lg border border-border bg-foreground">
          <track kind="captions" />
        </video>
        <a href={fileUrl(file.id, { download: true })} className="text-xs text-muted-foreground hover:text-foreground">
          {file.name} · {formatBytes(file.size)}
        </a>
      </div>
    )
  }
  if (file.kind === "AUDIO") {
    return (
      <div className="flex max-w-sm flex-col gap-1">
        <audio controls preload="metadata" src={fileUrl(file.id)} className="w-full" />
        <span className="text-xs text-muted-foreground">{file.name}</span>
      </div>
    )
  }
  return <FileChip file={file} />
}

export { Attachment, FileChip }
