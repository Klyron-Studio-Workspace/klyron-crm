"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, FileIcon, FolderIcon, LockIcon, UploadIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { formatBytes } from "@/lib/files/types"
import { uploadFile } from "@/lib/files/upload-client"
import { cn } from "@/lib/utils"

type Item = { key: string; file: File; name: string; progress: number; error: string | null; done: boolean }

/** "brief.final.pdf" → ["brief.final", ".pdf"] */
function splitExt(fileName: string) {
  const dot = fileName.lastIndexOf(".")
  return dot > 0 ? [fileName.slice(0, dot), fileName.slice(dot)] : [fileName, ""]
}

type CompanyUploadDialogProps = {
  folders: string[]
  /** Pre-fill the folder when uploading from inside one. */
  defaultFolder?: string
  canRestrict: boolean
}

/**
 * Company vault upload: add files, name them, upload. Who uploaded and when is
 * recorded automatically. Folder and "Restricted" are optional extras.
 */
function CompanyUploadDialog({ folders, defaultFolder, canRestrict }: CompanyUploadDialogProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [items, setItems] = React.useState<Item[]>([])
  const [folder, setFolder] = React.useState(defaultFolder ?? "")
  const [restricted, setRestricted] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listId = React.useId()

  const add = (files: FileList | File[]) =>
    setItems((prev) => [
      ...prev,
      ...Array.from(files).map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, file, name: splitExt(file.name)[0], progress: 0, error: null, done: false })),
    ])
  const patch = (key: string, p: Partial<Item>) => setItems((prev) => prev.map((x) => (x.key === key ? { ...x, ...p } : x)))

  async function upload() {
    setBusy(true)
    await Promise.all(
      items
        .filter((i) => !i.done)
        .map((item) => {
          // Keep the original extension so the file still opens correctly.
          const ext = splitExt(item.file.name)[1]
          const name = `${item.name.trim() || splitExt(item.file.name)[0]}${ext}`
          const renamed = new File([item.file], name, { type: item.file.type })
          return uploadFile(renamed, { company: true, folder: folder.trim() || null, restricted }, (progress) => patch(item.key, { progress }))
            .promise.then(() => patch(item.key, { done: true, progress: 1, error: null }))
            .catch((error: Error) => patch(item.key, { error: error.message }))
        })
    )
    setBusy(false)
    router.refresh()
  }

  const allDone = items.length > 0 && items.every((i) => i.done)
  const pendingCount = items.filter((i) => !i.done).length

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setItems([])
          setFolder(defaultFolder ?? "")
          setRestricted(false)
        }
      }}
    >
      <DialogTrigger render={<Button />}>
        <UploadIcon data-icon="inline-start" />
        Upload documents
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload documents</DialogTitle>
          <DialogDescription>Add files and give them a name. We&rsquo;ll record who uploaded them and when.</DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) add(e.target.files)
            e.target.value = ""
          }}
        />

        {items.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              add(e.dataTransfer.files)
            }}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-sm transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              dragging ? "border-primary bg-primary-tint text-primary-strong" : "border-input bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            <UploadIcon aria-hidden className="size-6" />
            <span className="font-medium text-foreground">Choose files or drop them here</span>
            <span className="text-xs">Contracts, brand assets, templates, policies…</span>
          </button>
        ) : (
          <ul
            className="flex max-h-72 flex-col gap-2 overflow-y-auto"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              add(e.dataTransfer.files)
            }}
          >
            {items.map((item) => {
              const ext = splitExt(item.file.name)[1]
              return (
                <li key={item.key} className="relative flex items-center gap-3 overflow-hidden rounded-lg border border-border p-2 animate-in fade-in-0 slide-in-from-top-1">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", item.done ? "bg-success-tint text-success" : "bg-muted text-muted-foreground")}>
                    {item.done ? <CheckIcon className="size-4" /> : <FileIcon className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center">
                      <Input
                        aria-label={`Name for ${item.file.name}`}
                        value={item.name}
                        maxLength={200}
                        disabled={busy || item.done}
                        onChange={(e) => patch(item.key, { name: e.target.value })}
                        className="h-8 rounded-r-none border-r-0"
                      />
                      {ext && <span className="flex h-8 items-center rounded-r-md border border-input bg-muted px-2 text-xs text-muted-foreground">{ext}</span>}
                    </div>
                    <p className={cn("mt-1 text-xs", item.error ? "text-primary-strong" : "text-muted-foreground")}>
                      {item.error ?? (item.done ? "Uploaded" : busy ? `Uploading ${Math.round(item.progress * 100)}%` : formatBytes(item.file.size))}
                    </p>
                  </div>
                  {!busy && !item.done && (
                    <button
                      type="button"
                      aria-label={`Remove ${item.file.name}`}
                      onClick={() => setItems((prev) => prev.filter((x) => x.key !== item.key))}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <XIcon className="size-4" />
                    </button>
                  )}
                  {busy && !item.done && (
                    <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-primary transition-[width] duration-200" style={{ width: `${Math.round(item.progress * 100)}%` }} />
                  )}
                </li>
              )
            })}
            {!busy && !allDone && (
              <li>
                <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
                  <UploadIcon data-icon="inline-start" /> Add more
                </Button>
              </li>
            )}
          </ul>
        )}

        {items.length > 0 && !allDone && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <FolderIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <Input aria-label="Folder (optional)" list={listId} value={folder} maxLength={80} placeholder="Folder (optional)" onChange={(e) => setFolder(e.target.value)} disabled={busy} className="h-8" />
              <datalist id={listId}>
                {folders.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>
            {canRestrict && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground" title="Only Owners and Admins can see restricted documents">
                <input type="checkbox" checked={restricted} disabled={busy} onChange={(e) => setRestricted(e.target.checked)} className="size-4 accent-primary" />
                <LockIcon aria-hidden className="size-3.5" />
                Restricted
              </label>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>{allDone ? "Done" : "Cancel"}</DialogClose>
          {!allDone && (
            <Button disabled={busy || pendingCount === 0} onClick={upload}>
              {busy ? "Uploading…" : pendingCount > 1 ? `Upload ${pendingCount} documents` : "Upload"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { CompanyUploadDialog }
