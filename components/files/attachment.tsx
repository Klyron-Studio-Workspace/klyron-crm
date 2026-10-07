"use client"

import * as React from "react"
import { DownloadIcon, EyeIcon, Maximize2Icon } from "lucide-react"

import { VoicePlayer } from "@/components/chat/voice-player"
import { fileTypeInfo, previewKind, usePreview } from "@/components/files/file-preview"
import { fileUrl, formatBytes, type FileDTO } from "@/lib/files/types"
import { cn } from "@/lib/utils"

/** Document card: type icon, name, type · size. Opens the previewer when the file can be previewed. */
function FileChip({ file, className }: { file: FileDTO; className?: string }) {
  const { open, dialog } = usePreview()
  const { Icon, label, tone } = fileTypeInfo(file)
  const previewable = previewKind(file) !== "none"
  return (
    <>
      <div
        className={cn(
          "group/file relative flex w-72 max-w-full items-center gap-3 rounded-xl border border-border bg-card p-2.5 pr-2 text-sm shadow-xs transition-[border-color,box-shadow] duration-150 ease-out hover:border-input hover:shadow-sm",
          className
        )}
      >
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tone)}>
          <Icon aria-hidden className="size-5" />
        </span>
        <button
          type="button"
          onClick={() => (previewable ? open(file) : window.open(fileUrl(file.id, { download: true }), "_self"))}
          className="min-w-0 flex-1 text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
          aria-label={previewable ? `Preview ${file.name}` : `Download ${file.name}`}
        >
          <span className="block truncate font-medium">{file.name}</span>
          <span className="block text-xs text-muted-foreground">
            {label} · {formatBytes(file.size)}
          </span>
        </button>
        {previewable && <EyeIcon aria-hidden className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/file:opacity-100" />}
        <a
          href={fileUrl(file.id, { download: true })}
          aria-label={`Download ${file.name}`}
          className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <DownloadIcon className="size-4" />
        </a>
      </div>
      {dialog}
    </>
  )
}

function ImageAttachment({ file }: { file: FileDTO }) {
  const { open, dialog } = usePreview()
  return (
    <>
      <button
        type="button"
        onClick={() => open(file)}
        className="group/img relative block w-fit max-w-[min(100%,24rem)] overflow-hidden rounded-xl border border-border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Preview image ${file.name}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API URL, not optimizable */}
        <img
          src={fileUrl(file.id, { thumb: file.hasThumbnail })}
          alt={file.name}
          loading="lazy"
          width={file.width ?? undefined}
          height={file.height ?? undefined}
          draggable={false}
          className="pointer-events-none block h-auto select-none max-h-72 w-auto max-w-full object-contain transition-transform duration-300 ease-out group-hover/img:scale-[1.02]"
        />
        <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md bg-black/50 text-white opacity-0 transition-opacity group-hover/img:opacity-100">
          <Maximize2Icon aria-hidden className="size-3.5" />
        </span>
      </button>
      {dialog}
    </>
  )
}

/** Renders an attachment by kind: image, playable video/audio, voice note, or a document card. */
function Attachment({ file, own }: { file: FileDTO; own?: boolean }) {
  if (file.voiceNote) return <VoicePlayer file={file} own={own} />
  if (file.kind === "IMAGE" && file.mimeType !== "image/svg+xml") return <ImageAttachment file={file} />
  if (file.kind === "VIDEO") {
    return (
      <div className="flex max-w-md flex-col gap-1">
        <video controls preload="metadata" src={fileUrl(file.id)} className="max-h-80 w-full rounded-xl border border-border bg-foreground">
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
