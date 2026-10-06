import "server-only"

import { logEvent, systemActor } from "@/lib/audit"
import { getCurrentUser } from "@/lib/auth/dal"
import { isTeamRole } from "@/lib/auth/permissions"
import { db } from "@/lib/db"

/**
 * Records the first time the recipient opens a document link. Team members
 * previewing their own document don't count.
 */
export async function recordFirstView(kind: "invoice" | "proposal", id: string, alreadyViewed: boolean) {
  if (alreadyViewed) return
  const viewer = await getCurrentUser()
  if (viewer && isTeamRole(viewer.role)) return
  const claimed =
    kind === "invoice"
      ? await db.invoice.updateMany({ where: { id, viewedAt: null, status: { not: "DRAFT" } }, data: { viewedAt: new Date() } })
      : await db.proposal.updateMany({ where: { id, viewedAt: null, status: { not: "DRAFT" } }, data: { viewedAt: new Date() } })
  if (claimed.count > 0) {
    await logEvent({
      actor: viewer ? { type: "USER", id: viewer.id, name: viewer.name } : { ...systemActor, name: "Client" },
      action: `${kind}.view`,
      entity: { type: kind, id },
    })
  }
}
