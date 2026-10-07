// Client-safe file shapes.

export type FileKindKey = "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "OTHER"

export type FileDTO = {
  id: string
  name: string
  mimeType: string
  size: number
  kind: FileKindKey
  width: number | null
  height: number | null
  hasThumbnail: boolean
  /** Recorded in chat: shown as a voice player. */
  voiceNote: boolean
  durationMs: number | null
  /** Bar heights 0-100 for the voice player. */
  waveform: number[] | null
}

export function fileUrl(id: string, options: { thumb?: boolean; download?: boolean } = {}) {
  const params = new URLSearchParams()
  if (options.thumb) params.set("thumb", "1")
  if (options.download) params.set("download", "1")
  const qs = params.toString()
  return `/api/files/${id}${qs ? `?${qs}` : ""}`
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}
