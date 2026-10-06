import "server-only"

import { randomBytes } from "node:crypto"
import { createWriteStream } from "node:fs"
import { mkdir, rm, stat } from "node:fs/promises"
import path from "node:path"
import { Readable, Transform } from "node:stream"
import { pipeline } from "node:stream/promises"

import type { FileKindKey } from "@/lib/files/types"

/** Root folder for uploads. On the VPS point this at a mounted volume, e.g. /data/uploads. */
export const UPLOAD_DIR = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_DIR || "storage/uploads")
export const MAX_UPLOAD_BYTES = Math.max(1, Number(process.env.MAX_UPLOAD_MB) || 500) * 1024 * 1024

export class UploadTooLargeError extends Error {}

/** "2026/10/k3j9…x.mp4". Generated server-side; the original filename never touches the disk path. */
export function newStorageKey(originalName: string) {
  const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 12)
  const now = new Date()
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`
  return `${folder}/${randomBytes(16).toString("base64url")}${ext}`
}

export function thumbnailKey(storageKey: string) {
  return `${storageKey}.thumb.webp`
}

/** Absolute path for a storage key, refusing anything that escapes UPLOAD_DIR. */
export function pathFor(storageKey: string) {
  const full = path.resolve(/* turbopackIgnore: true */ UPLOAD_DIR, storageKey)
  if (!full.startsWith(UPLOAD_DIR + path.sep)) throw new Error("Invalid storage key")
  return full
}

export function kindFor(mimeType: string): FileKindKey {
  if (mimeType.startsWith("image/")) return "IMAGE"
  if (mimeType.startsWith("video/")) return "VIDEO"
  if (mimeType.startsWith("audio/")) return "AUDIO"
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    /officedocument|msword|ms-excel|ms-powerpoint|opendocument|rtf|csv/.test(mimeType)
  ) {
    return "DOCUMENT"
  }
  return "OTHER"
}

/** Types the browser may display inline. Everything else (including SVG and HTML) downloads. */
export function isInlineSafe(mimeType: string) {
  if (mimeType === "image/svg+xml") return false
  return /^(image\/(png|jpe?g|gif|webp|avif)|video\/|audio\/|application\/pdf$)/.test(mimeType)
}

/** Streams a request body to disk, aborting (and cleaning up) past the size limit. */
export async function writeUpload(body: ReadableStream<Uint8Array>, storageKey: string, maxBytes = MAX_UPLOAD_BYTES) {
  const target = pathFor(storageKey)
  await mkdir(path.dirname(target), { recursive: true })
  let bytes = 0
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length
      if (bytes > maxBytes) callback(new UploadTooLargeError(`File is larger than ${Math.round(maxBytes / 1024 / 1024)} MB`))
      else callback(null, chunk)
    },
  })
  try {
    await pipeline(Readable.fromWeb(body as never), limiter, createWriteStream(target, { flags: "wx" }))
  } catch (error) {
    await rm(target, { force: true })
    throw error
  }
  return bytes
}

/** Image dimensions plus a WebP preview (max 960px). Returns null for formats sharp can't read. */
export async function processImage(storageKey: string) {
  try {
    const { default: sharp } = await import("sharp")
    const source = pathFor(storageKey)
    const image = sharp(source, { failOn: "none" }).rotate()
    const meta = await image.metadata()
    await image
      .clone()
      .resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(pathFor(thumbnailKey(storageKey)))
    const portrait = (meta.orientation ?? 1) >= 5
    return {
      width: (portrait ? meta.height : meta.width) ?? null,
      height: (portrait ? meta.width : meta.height) ?? null,
    }
  } catch {
    return null
  }
}

export async function deleteStored(storageKey: string, hasThumbnail: boolean) {
  await rm(pathFor(storageKey), { force: true })
  if (hasThumbnail) await rm(pathFor(thumbnailKey(storageKey)), { force: true })
}

export async function fileSize(storageKey: string) {
  return (await stat(pathFor(storageKey))).size
}
