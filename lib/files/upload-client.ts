// Browser-side upload helper (XHR, so we get progress events).
import type { FileDTO } from "@/lib/files/types"

export type UploadTarget =
  | { channelId: string; voice?: { durationMs: number; waveform: number[] } }
  | { clientId: string; projectId?: string | null; shared?: boolean }
  | { company: true; folder?: string | null; restricted?: boolean }

export type UploadHandle = { promise: Promise<FileDTO>; abort: () => void }

/** Streams one file to /api/files. Rejects with a readable message. */
export function uploadFile(file: File, target: UploadTarget, onProgress?: (fraction: number) => void): UploadHandle {
  const params = new URLSearchParams({ name: file.name })
  if ("channelId" in target) {
    params.set("channelId", target.channelId)
    if (target.voice) {
      params.set("voice", "1")
      params.set("durationMs", String(Math.round(target.voice.durationMs)))
      params.set("waveform", target.voice.waveform.map((v) => Math.round(v)).join(","))
    }
  }
  else if ("company" in target) {
    params.set("company", "1")
    if (target.folder) params.set("folder", target.folder)
    if (target.restricted) params.set("restricted", "1")
  } else {
    params.set("clientId", target.clientId)
    if (target.projectId) params.set("projectId", target.projectId)
    if (target.shared) params.set("shared", "1")
  }

  const xhr = new XMLHttpRequest()
  const promise = new Promise<FileDTO>((resolve, reject) => {
    xhr.open("POST", `/api/files?${params}`)
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onload = () => {
      let body: { error?: string } & Partial<FileDTO> = {}
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        // non-JSON error page
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as FileDTO)
      else reject(new Error(body.error ?? `Upload failed (${xhr.status}).`))
    }
    xhr.onerror = () => reject(new Error("Network error during upload."))
    xhr.onabort = () => reject(new Error("Upload cancelled."))
    xhr.send(file)
  })
  return { promise, abort: () => xhr.abort() }
}

export async function deleteUploadedFile(fileId: string) {
  await fetch(`/api/files/${fileId}`, { method: "DELETE" })
}
