import "server-only"

import { can, type CurrentUser } from "@/lib/auth/dal"
import { isTeamRole } from "@/lib/auth/permissions"
import { findAccessibleChannel, memberClientScope } from "@/lib/chat/access"
import type { StoredFile } from "@/lib/generated/prisma/client"
import type { FileDTO } from "@/lib/files/types"

export function toFileDTO(file: StoredFile): FileDTO {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: Number(file.size),
    kind: file.kind,
    width: file.width,
    height: file.height,
    hasThumbnail: file.hasThumbnail,
    voiceNote: file.voiceNote,
    durationMs: file.durationMs,
    waveform: Array.isArray(file.waveform) ? (file.waveform as unknown[]).filter((v): v is number => typeof v === "number").slice(0, 96) : null,
  }
}

/** Team user may work with this client's files (respects "members see only assigned work"). */
export async function teamCanSeeClient(user: CurrentUser, clientId: string) {
  const scope = await memberClientScope(user)
  return scope === null || scope.includes(clientId)
}

/**
 * Read access:
 * - the uploader, always (covers files not yet attached to a message);
 * - chat files: anyone who can see the channel;
 * - client files: the team with Files access, and that client's portal accounts
 *   when the file is shared with them.
 */
export async function canReadFile(user: CurrentUser, file: StoredFile) {
  if (file.uploadedById === user.id) return true

  if (file.channelId) {
    if (!(await findAccessibleChannel(user, file.channelId))) return false
    // Pending uploads (no message yet) are only visible to the uploader.
    return Boolean(file.messageId)
  }

  if (file.company) return canSeeCompanyFile(user, file)

  if (file.clientId) {
    if (!(await can(user, "files", "READ"))) return false
    if (isTeamRole(user.role)) return teamCanSeeClient(user, file.clientId)
    return user.clientId === file.clientId && file.sharedWithClient
  }
  return false
}

/** Company vault: the team with Files access; restricted files only for Owners and Admins. */
export async function canSeeCompanyFile(user: CurrentUser, file: Pick<StoredFile, "restricted">) {
  if (!isTeamRole(user.role) || !(await can(user, "files", "READ"))) return false
  return !file.restricted || user.role === "OWNER" || user.role === "ADMIN"
}

/** Uploaders can delete their own files; Owners and Admins can delete any file they can see. */
export async function canDeleteFile(user: CurrentUser, file: StoredFile) {
  if (file.uploadedById === user.id) return true
  if (user.role !== "OWNER" && user.role !== "ADMIN") return false
  return (await can(user, "files", "WRITE")) && (await canReadFile(user, file))
}
