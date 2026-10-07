"use client"

import * as React from "react"
import { DownloadIcon, ExternalLinkIcon, FileArchiveIcon, FileAudioIcon, FileIcon, FileSpreadsheetIcon, FileTextIcon, FileVideoIcon, ImageIcon, LoaderCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { fileUrl, formatBytes, type FileDTO } from "@/lib/files/types"
import { cn } from "@/lib/utils"

const TEXT_LIMIT = 1_000_000

export type PreviewKind = "image" | "video" | "audio" | "pdf" | "text" | "none"

const TEXT_MIME = /^(text\/|application\/(json|xml|x-yaml|yaml|javascript|x-ndjson))/
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|ya?ml|log|ini|env\.example|html?|css|js|ts|tsx|jsx|sql)$/i

export function previewKind(file: Pick<FileDTO, "mimeType" | "name" | "kind" | "size">): PreviewKind {
  if (file.kind === "IMAGE" && file.mimeType !== "image/svg+xml") return "image"
  if (file.kind === "VIDEO") return "video"
  if (file.kind === "AUDIO") return "audio"
  if (file.mimeType === "application/pdf") return "pdf"
  if ((TEXT_MIME.test(file.mimeType) || TEXT_EXT.test(file.name)) && file.size <= TEXT_LIMIT) return "text"
  return "none"
}

/** Icon and short label ("PDF", "Spreadsheet") for a file card. */
export function fileTypeInfo(file: Pick<FileDTO, "mimeType" | "name" | "kind">) {
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toUpperCase().slice(0, 5) : ""
  if (file.kind === "IMAGE") return { Icon: ImageIcon, label: ext || "Image", tone: "bg-info-tint text-info" }
  if (file.kind === "VIDEO") return { Icon: FileVideoIcon, label: ext || "Video", tone: "bg-primary-tint text-primary-strong" }
  if (file.kind === "AUDIO") return { Icon: FileAudioIcon, label: ext || "Audio", tone: "bg-warning-tint text-warning" }
  if (file.mimeType === "application/pdf") return { Icon: FileTextIcon, label: "PDF", tone: "bg-primary-tint text-primary-strong" }
  if (/sheet|excel|csv/.test(file.mimeType) || /^(XLSX?|CSV|TSV|ODS)$/.test(ext)) return { Icon: FileSpreadsheetIcon, label: ext || "Sheet", tone: "bg-success-tint text-success" }
  if (/zip|rar|7z|tar|gzip/.test(file.mimeType)) return { Icon: FileArchiveIcon, label: ext || "Archive", tone: "bg-muted text-muted-foreground" }
  if (file.kind === "DOCUMENT" || TEXT_MIME.test(file.mimeType)) return { Icon: FileTextIcon, label: ext || "Document", tone: "bg-info-tint text-info" }
  return { Icon: FileIcon, label: ext || "File", tone: "bg-muted text-muted-foreground" }
}

/** CSV → rows (handles quoted cells). Only the first rows are shown. */
function parseCsv(text: string, delimiter: string, maxRows = 200) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < text.length && rows.length < maxRows; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === delimiter) {
      row.push(cell)
      cell = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else cell += c
  }
  if (cell || row.length) rows.push([...row, cell])
  return rows
}

function TextPreview({ file }: { file: FileDTO }) {
  const [text, setText] = React.useState<string | null>(null)
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    fetch(fileUrl(file.id))
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => !cancelled && setText(t))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [file.id])

  if (failed) return <p className="p-6 text-sm text-muted-foreground">Couldn&rsquo;t load a preview. Download the file to open it.</p>
  if (text === null)
    return (
      <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <LoaderCircleIcon className="size-4 animate-spin" /> Loading preview…
      </p>
    )

  const isTable = /\.(csv|tsv)$/i.test(file.name) || /csv|tab-separated/.test(file.mimeType)
  if (isTable) {
    const rows = parseCsv(text, /\.tsv$/i.test(file.name) ? "\t" : ",")
    const [head, ...body] = rows
    return (
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full border-collapse text-sm">
          {head && (
            <thead className="sticky top-0 bg-muted">
              <tr>
                {head.map((h, i) => (
                  <th key={i} className="border-b border-border px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {body.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {r.map((c, j) => (
                  <td key={j} className="px-3 py-1.5 whitespace-nowrap">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  let shown = text
  if (/json/.test(file.mimeType) || /\.json$/i.test(file.name)) {
    try {
      shown = JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      // Show as-is.
    }
  }
  return <pre className="max-h-[70vh] overflow-auto p-5 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap">{shown}</pre>
}

function PreviewBody({ file }: { file: FileDTO }) {
  const kind = previewKind(file)
  if (kind === "image") {
    return (
      <div className="flex max-h-[75vh] items-center justify-center select-none bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API URL */}
        <img
          src={fileUrl(file.id)}
          alt={file.name}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          className="pointer-events-none max-h-[75vh] w-auto max-w-full object-contain select-none [-webkit-user-drag:none] [-webkit-touch-callout:none]"
        />
      </div>
    )
  }
  if (kind === "video") {
    return (
      <video controls autoPlay preload="metadata" src={fileUrl(file.id)} className="max-h-[75vh] w-full bg-black">
        <track kind="captions" />
      </video>
    )
  }
  if (kind === "audio") return <audio controls autoPlay src={fileUrl(file.id)} className="m-6 w-[calc(100%-3rem)]" />
  if (kind === "pdf") return <iframe title={file.name} src={fileUrl(file.id)} className="h-[75vh] w-full bg-muted" />
  if (kind === "text") return <TextPreview file={file} />
  const { Icon, label, tone } = fileTypeInfo(file)
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className={cn("flex size-14 items-center justify-center rounded-2xl", tone)}>
        <Icon className="size-7" />
      </span>
      <p className="text-sm text-muted-foreground">No preview for {label} files. Download it to open it on your computer.</p>
      <Button nativeButton={false} render={<a href={fileUrl(file.id, { download: true })} />}>
        <DownloadIcon data-icon="inline-start" /> Download ({formatBytes(file.size)})
      </Button>
    </div>
  )
}

/** Full-screen-ish preview: image, video, audio, PDF, text/CSV, or a download prompt. */
function FilePreviewDialog({ file, open, onOpenChange }: { file: FileDTO | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94vh] w-[min(96vw,1100px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        {file && (
          <>
            <div className="flex items-center gap-3 border-b border-border py-3 pr-12 pl-4">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-sm">{file.name}</DialogTitle>
                <DialogDescription className="text-xs">
                  {fileTypeInfo(file).label} · {formatBytes(file.size)}
                </DialogDescription>
              </div>
              {previewKind(file) !== "none" && (
                <Button variant="ghost" size="sm" nativeButton={false} render={<a href={fileUrl(file.id)} target="_blank" rel="noopener noreferrer" />}>
                  <ExternalLinkIcon data-icon="inline-start" /> Open
                </Button>
              )}
              <Button variant="secondary" size="sm" nativeButton={false} render={<a href={fileUrl(file.id, { download: true })} />}>
                <DownloadIcon data-icon="inline-start" /> Download
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <PreviewBody key={file.id} file={file} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** A button that opens the previewer for one file. */
function usePreview() {
  const [file, setFile] = React.useState<FileDTO | null>(null)
  const dialog = <FilePreviewDialog file={file} open={file !== null} onOpenChange={(o) => !o && setFile(null)} />
  return { open: setFile, dialog }
}

export { FilePreviewDialog, usePreview }
