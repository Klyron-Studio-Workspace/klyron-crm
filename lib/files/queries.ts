import "server-only"

import type { CurrentUser } from "@/lib/auth/dal"
import { isTeamRole } from "@/lib/auth/permissions"
import { memberClientScope } from "@/lib/chat/access"
import { db } from "@/lib/db"
import { toFileDTO } from "@/lib/files/access"
import type { FileKindKey } from "@/lib/files/types"
import type { Prisma } from "@/lib/generated/prisma/client"

export type FileFilters = { clientId?: string; projectId?: string; kind?: FileKindKey; q?: string }

export type FileRowDTO = ReturnType<typeof toFileDTO> & {
  createdAt: string
  uploadedBy: string | null
  uploadedById: string | null
  fromClient: boolean
  sharedWithClient: boolean
  inChat: boolean
  client: { id: string; name: string } | null
  project: { id: string; name: string } | null
}

/**
 * Client files the user may see: Files-area uploads and attachments posted in
 * client chats. Team-only and direct-message attachments stay in chat.
 */
export async function listFiles(user: CurrentUser, filters: FileFilters = {}): Promise<FileRowDTO[]> {
  const where: Prisma.StoredFileWhereInput[] = [
    { clientId: { not: null } },
    // Pending chat uploads (not yet sent) are hidden everywhere.
    { OR: [{ channelId: null }, { messageId: { not: null } }] },
  ]
  if (isTeamRole(user.role)) {
    const scope = await memberClientScope(user)
    if (scope) where.push({ clientId: { in: scope } })
  } else {
    where.push({ clientId: user.clientId ?? "__none__", sharedWithClient: true })
  }
  if (filters.clientId) where.push({ clientId: filters.clientId })
  if (filters.projectId) where.push({ projectId: filters.projectId })
  if (filters.kind) where.push({ kind: filters.kind })
  if (filters.q) where.push({ name: { contains: filters.q } })

  const rows = await db.storedFile.findMany({
    where: { AND: where },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      uploadedBy: { select: { name: true, role: true } },
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  })
  return rows.map((f) => ({
    ...toFileDTO(f),
    createdAt: f.createdAt.toISOString(),
    uploadedBy: f.uploadedBy?.name ?? null,
    uploadedById: f.uploadedById,
    fromClient: f.uploadedBy?.role === "CLIENT",
    sharedWithClient: f.sharedWithClient,
    inChat: Boolean(f.channelId),
    client: f.client,
    project: f.project,
  }))
}
