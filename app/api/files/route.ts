import { logEvent, userActor } from "@/lib/audit"
import { can, getCurrentUser } from "@/lib/auth/dal"
import { isTeamRole } from "@/lib/auth/permissions"
import { findAccessibleChannel } from "@/lib/chat/access"
import { db } from "@/lib/db"
import { teamCanSeeClient, toFileDTO } from "@/lib/files/access"
import {
  MAX_UPLOAD_BYTES,
  UploadTooLargeError,
  deleteStored,
  kindFor,
  newStorageKey,
  processImage,
  writeUpload,
} from "@/lib/files/storage"

function json(status: number, body: unknown) {
  return Response.json(body, { status })
}

/**
 * Upload one file. The raw file is the request body (streamed to disk, never
 * buffered in memory). Context comes from the query string:
 *   ?name=<filename>&channelId=…              chat attachment (pending until sent)
 *   ?name=<filename>&clientId=…[&projectId=…][&shared=1]   Files area
 */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.mustChangePassword) return json(401, { error: "Sign in to upload files." })
  if (!request.body) return json(400, { error: "No file received." })

  const url = new URL(request.url)
  const name = (url.searchParams.get("name") ?? "").trim().slice(0, 255) || "file"
  const mimeType = (request.headers.get("content-type") || "application/octet-stream").split(";")[0].trim().toLowerCase().slice(0, 120)
  const declared = Number(request.headers.get("content-length"))
  if (declared > MAX_UPLOAD_BYTES) {
    return json(413, { error: `Files can be up to ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` })
  }

  // ── Resolve and authorize the context ──
  let channelId: string | null = null
  let clientId: string | null = null
  let projectId: string | null = null
  let sharedWithClient = false

  const channelParam = url.searchParams.get("channelId")
  if (channelParam) {
    const channel = await findAccessibleChannel(user, channelParam)
    if (!channel || !(await can(user, "chat", "WRITE"))) return json(403, { error: "You can't post in this conversation." })
    channelId = channel.id
    clientId = channel.clientId
    sharedWithClient = channel.kind === "CLIENT"
  } else {
    const clientParam = url.searchParams.get("clientId")
    if (!clientParam || !(await can(user, "files", "WRITE"))) return json(403, { error: "You can't upload files here." })
    if (isTeamRole(user.role)) {
      if (!(await teamCanSeeClient(user, clientParam))) return json(403, { error: "You can't upload files for this client." })
      sharedWithClient = url.searchParams.get("shared") === "1"
    } else {
      if (user.clientId !== clientParam) return json(403, { error: "You can't upload files for this client." })
      sharedWithClient = true // files from the client are visible to them and the team
    }
    if (!(await db.client.findUnique({ where: { id: clientParam }, select: { id: true } }))) return json(404, { error: "Client not found." })
    clientId = clientParam

    const projectParam = url.searchParams.get("projectId")
    if (projectParam) {
      const project = await db.project.findFirst({ where: { id: projectParam, clientId }, select: { id: true } })
      if (!project) return json(400, { error: "That project doesn't belong to this client." })
      projectId = project.id
    }
  }

  // ── Store ──
  const storageKey = newStorageKey(name)
  let size: number
  try {
    size = await writeUpload(request.body, storageKey)
  } catch (error) {
    if (error instanceof UploadTooLargeError) return json(413, { error: error.message })
    console.error("[upload] failed", error)
    return json(500, { error: "Upload failed. Try again." })
  }
  if (size === 0) {
    await deleteStored(storageKey, false)
    return json(400, { error: "The file is empty." })
  }

  const kind = kindFor(mimeType)
  const image = kind === "IMAGE" && mimeType !== "image/svg+xml" ? await processImage(storageKey) : null

  const file = await db.storedFile.create({
    data: {
      storageKey,
      name,
      mimeType,
      size,
      kind,
      width: image?.width ?? null,
      height: image?.height ?? null,
      hasThumbnail: Boolean(image),
      uploadedById: user.id,
      clientId,
      projectId,
      channelId,
      sharedWithClient,
    },
  })

  // Chat attachments are logged when the message is sent; Files-area uploads now.
  if (!channelId && clientId) {
    await logEvent({
      actor: userActor(user),
      action: "file.upload",
      entity: { type: "client", id: clientId },
      metadata: { fileId: file.id, name, size, shared: sharedWithClient },
    })
  }
  return json(201, toFileDTO(file))
}
