import "server-only"

import { db } from "@/lib/db"
import { deleteStored } from "@/lib/files/storage"
import { notify } from "@/lib/notifications"

const MINUTE = 60_000
const ORPHAN_AGE_MS = 24 * 60 * MINUTE

/** Follow-up reminders that just came due: notify the assignee (in-app + email). */
export async function runDueReminders() {
  const due = await db.reminder.findMany({
    where: { completedAt: null, notifiedAt: null, dueAt: { lte: new Date() }, assigneeId: { not: null } },
    take: 100,
    include: { lead: { select: { id: true, name: true, company: true } } },
  })
  for (const reminder of due) {
    // Claim it first so an overlapping run can't send it twice.
    const claimed = await db.reminder.updateMany({ where: { id: reminder.id, notifiedAt: null }, data: { notifiedAt: new Date() } })
    if (claimed.count === 0 || !reminder.assigneeId) continue
    await notify({
      userIds: [reminder.assigneeId],
      type: "reminder.due",
      title: `Follow-up due: ${reminder.note}`,
      body: `For ${reminder.lead.company ?? reminder.lead.name}`,
      link: `/leads/${reminder.lead.id}`,
      email: "always",
    })
  }
}

/** Chat uploads that were never sent (the composer was closed): remove after a day. */
export async function cleanOrphanUploads() {
  const orphans = await db.storedFile.findMany({
    where: { channelId: { not: null }, messageId: null, createdAt: { lt: new Date(Date.now() - ORPHAN_AGE_MS) } },
    take: 200,
  })
  for (const file of orphans) {
    await db.storedFile.delete({ where: { id: file.id } })
    await deleteStored(file.storageKey, file.hasThumbnail)
  }
}

const globalForScheduler = globalThis as unknown as { schedulerStarted?: boolean }

/** Runs inside the single app process (see instrumentation.ts). */
export function startScheduler() {
  if (globalForScheduler.schedulerStarted) return
  globalForScheduler.schedulerStarted = true

  const safely = (name: string, task: () => Promise<void>) => () =>
    task().catch((error) => console.error(`[scheduler] ${name} failed:`, error instanceof Error ? error.message : error))

  setInterval(safely("reminders", runDueReminders), MINUTE).unref()
  setInterval(safely("orphan uploads", cleanOrphanUploads), 60 * MINUTE).unref()
  setTimeout(safely("reminders", runDueReminders), 5_000).unref()
}
