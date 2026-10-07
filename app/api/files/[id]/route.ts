import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { Readable } from "node:stream"

import { logEvent, userActor } from "@/lib/audit"
import { getCurrentUser } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { canDeleteFile, canReadFile, toFileDTO } from "@/lib/files/access"
import { deleteStored, isInlineSafe, pathFor, thumbnailKey } from "@/lib/files/storage"

/** RFC 6266 filename for Content-Disposition, safe for any characters. */
function disposition(type: "inline" | "attachment", name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

/**
 * Download or preview a file (with Range support for video seeking).
 * ?thumb=1 serves the image preview, ?download=1 forces a download, ?meta=1 returns details as JSON.
 * With NGINX_ACCEL_REDIRECT=1, Nginx streams the bytes after this auth check.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const user = await getCurrentUser()
  if (!user) return new Response("Unauthorized", { status: 401 })
  const { id } = await params
  const file = await db.storedFile.findUnique({ where: { id } })
  if (!file || !(await canReadFile(user, file))) return new Response("Not found", { status: 404 })

  const url = new URL(request.url)
  // ?meta=1: just the file details (for previews of files tagged in chat).
  if (url.searchParams.get("meta") === "1") return Response.json(toFileDTO(file), { headers: { "Cache-Control": "private, no-store" } })
  const wantThumb = url.searchParams.get("thumb") === "1" && file.hasThumbnail
  const key = wantThumb ? thumbnailKey(file.storageKey) : file.storageKey
  const mimeType = wantThumb ? "image/webp" : file.mimeType
  const inline = url.searchParams.get("download") !== "1" && isInlineSafe(mimeType)

  const headers = new Headers({
    "Content-Type": mimeType,
    "Content-Disposition": disposition(inline ? "inline" : "attachment", wantThumb ? `${file.name}.webp` : file.name),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=86400",
    "Accept-Ranges": "bytes",
  })

  if (process.env.NGINX_ACCEL_REDIRECT === "1") {
    headers.set("X-Accel-Redirect", `/protected-files/${key}`)
    return new Response(null, { status: 200, headers })
  }

  const fullPath = pathFor(key)
  let size: number
  try {
    size = (await stat(fullPath)).size
  } catch {
    return new Response("File is missing from storage", { status: 410 })
  }

  const range = request.headers.get("range")
  const match = range?.match(/^bytes=(\d*)-(\d*)$/)
  if (match && (match[1] || match[2])) {
    let start = match[1] ? Number(match[1]) : size - Number(match[2])
    let end = match[1] && match[2] ? Number(match[2]) : size - 1
    start = Math.max(0, start)
    end = Math.min(end, size - 1)
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } })
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`)
    headers.set("Content-Length", String(end - start + 1))
    const stream = Readable.toWeb(createReadStream(fullPath, { start, end })) as ReadableStream
    return new Response(stream, { status: 206, headers })
  }

  headers.set("Content-Length", String(size))
  return new Response(Readable.toWeb(createReadStream(fullPath)) as ReadableStream, { status: 200, headers })
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const user = await getCurrentUser()
  if (!user) return new Response("Unauthorized", { status: 401 })
  const { id } = await params
  const file = await db.storedFile.findUnique({ where: { id } })
  if (!file || !(await canDeleteFile(user, file))) return Response.json({ error: "Not found" }, { status: 404 })

  await db.storedFile.delete({ where: { id } })
  await deleteStored(file.storageKey, file.hasThumbnail)
  if (file.company) {
    await logEvent({ actor: userActor(user), action: "file.delete", entity: { type: "file", id: file.id }, metadata: { name: file.name, company: true, folder: file.folder } })
  }
  if (file.clientId) {
    await logEvent({
      actor: userActor(user),
      action: "file.delete",
      entity: { type: "client", id: file.clientId },
      metadata: { name: file.name },
    })
  }
  return Response.json({ ok: true })
}
