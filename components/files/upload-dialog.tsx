"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { UploadIcon } from "lucide-react"

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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatBytes } from "@/lib/files/types"
import { uploadFile } from "@/lib/files/upload-client"
import { cn } from "@/lib/utils"

type Option = { id: string; name: string }

type UploadDialogProps = {
  /** Team: pick a client. Client portal: fixed to their own client. */
  clients: Option[]
  projects: (Option & { clientId: string })[]
  fixedClientId?: string
  /** Team uploads can be private to the studio; client uploads are always shared. */
  allowPrivate: boolean
  defaultClientId?: string
}

type Item = { file: File; progress: number; error: string | null; done: boolean }

function UploadDialog({ clients, projects, fixedClientId, allowPrivate, defaultClientId }: UploadDialogProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [clientId, setClientId] = React.useState(fixedClientId ?? defaultClientId ?? clients[0]?.id ?? "")
  const [projectId, setProjectId] = React.useState("none")
  const [shared, setShared] = React.useState(!allowPrivate)
  const [items, setItems] = React.useState<Item[]>([])
  const [busy, setBusy] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const clientProjects = projects.filter((p) => p.clientId === clientId)

  async function start() {
    setBusy(true)
    await Promise.all(
      items.map((item, index) => {
        if (item.done) return Promise.resolve()
        const update = (patch: Partial<Item>) => setItems((prev) => prev.map((x, i) => (i === index ? { ...x, ...patch } : x)))
        return uploadFile(item.file, { clientId, projectId: projectId === "none" ? null : projectId, shared }, (progress) => update({ progress }))
          .promise.then(() => update({ done: true, progress: 1 }))
          .catch((error: Error) => update({ error: error.message }))
      })
    )
    setBusy(false)
    router.refresh()
  }

  const allDone = items.length > 0 && items.every((i) => i.done)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setItems([])
      }}
    >
      <DialogTrigger render={<Button />}>
        <UploadIcon data-icon="inline-start" />
        Upload files
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>
            {allowPrivate ? "Attach files to a client, and optionally share them in the client portal." : "Files you upload are shared with the Klyron team."}
          </DialogDescription>
        </DialogHeader>

        {!fixedClientId && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="upload-client">Client</Label>
              <Select items={clients.map((c) => ({ value: c.id, label: c.name }))} value={clientId} onValueChange={(v: string | null) => { if (v) { setClientId(v); setProjectId("none") } }}>
                <SelectTrigger id="upload-client" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="upload-project">Project</Label>
              <Select
                items={[{ value: "none", label: "No project" }, ...clientProjects.map((p) => ({ value: p.id, label: p.name }))]}
                value={projectId}
                onValueChange={(v: string | null) => v && setProjectId(v)}
              >
                <SelectTrigger id="upload-project" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {clientProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {allowPrivate && (
          <label className="flex items-start gap-3 rounded-lg border border-border p-3">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Share with the client</span>
              <span className="text-sm text-muted-foreground">Visible in their portal. Leave off for internal files.</span>
            </span>
          </label>
        )}

        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            setItems((prev) => [...prev, ...files.map((file) => ({ file, progress: 0, error: null, done: false }))])
            e.target.value = ""
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const files = Array.from(e.dataTransfer.files)
            setItems((prev) => [...prev, ...files.map((file) => ({ file, progress: 0, error: null, done: false }))])
          }}
          className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-input bg-surface px-4 py-8 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <UploadIcon aria-hidden className="size-5" />
          Choose files or drop them here
        </button>

        {items.length > 0 && (
          <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
            {items.map((item, i) => (
              <li key={i} className={cn("flex items-center gap-3 text-sm", item.error && "text-primary-strong")}>
                <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {item.error ?? (item.done ? "Uploaded" : busy ? `${Math.round(item.progress * 100)}%` : formatBytes(item.file.size))}
                </span>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>{allDone ? "Done" : "Cancel"}</DialogClose>
          {!allDone && (
            <Button disabled={busy || items.length === 0 || !clientId} onClick={start}>
              {busy ? "Uploading…" : `Upload ${items.length || ""}`.trim()}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { UploadDialog }
