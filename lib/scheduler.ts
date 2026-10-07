import "server-only"

import { db } from "@/lib/db"
import { deleteStored } from "@/lib/files/storage"
import { logEvent, systemActor } from "@/lib/audit"
import { endAbandonedCalls, runPendingNotes } from "@/lib/calls/lifecycle"
import { emailInvoice, financeAudience } from "@/lib/finance/delivery"
import { dayKey } from "@/lib/format"
import { formatMoney } from "@/lib/money"
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

const WEEK_MS = 7 * 24 * 60 * MINUTE
const MAX_AUTO_REMINDERS = 3

/** Overdue invoices: email the client when overdue, then weekly (max 3). The team is told on the first one. */
export async function runPaymentReminders() {
  const org = await db.orgSettings.findUnique({ where: { id: "org" }, select: { autoPaymentReminders: true } })
  if (org && !org.autoPaymentReminders) return
  const today = new Date(`${dayKey(new Date())}T00:00:00.000Z`)
  const due = await db.invoice.findMany({
    where: {
      status: "SENT",
      dueDate: { lt: today },
      reminderCount: { lt: MAX_AUTO_REMINDERS },
      OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: new Date(Date.now() - WEEK_MS) } }],
    },
    take: 50,
    include: { client: { select: { name: true } } },
  })
  for (const invoice of due) {
    // Claim first so an overlapping run can't send twice.
    const claimed = await db.invoice.updateMany({
      where: { id: invoice.id, reminderCount: invoice.reminderCount },
      data: { lastReminderAt: new Date(), reminderCount: { increment: 1 } },
    })
    if (claimed.count === 0) continue
    const { recipients } = await emailInvoice(invoice.id, "reminder")
    await logEvent({ actor: systemActor, action: "invoice.reminder.auto", entity: { type: "invoice", id: invoice.id }, metadata: { number: invoice.number, recipients } })
    if (invoice.reminderCount === 0) {
      await notify({
        userIds: await financeAudience(),
        type: "invoice.overdue",
        title: `${invoice.number} is overdue`,
        body: `${invoice.client.name} · ${formatMoney(Number(invoice.total) - Number(invoice.amountPaid), invoice.currency)} outstanding`,
        link: `/finance/invoices/${invoice.id}`,
        email: "if-offline",
      })
    }
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
  setInterval(safely("empty calls", endAbandonedCalls), MINUTE).unref()
  setInterval(safely("meeting notes", runPendingNotes), MINUTE).unref()
  setInterval(safely("orphan uploads", cleanOrphanUploads), 60 * MINUTE).unref()
  setInterval(safely("payment reminders", runPaymentReminders), 60 * MINUTE).unref()
  setTimeout(safely("payment reminders", runPaymentReminders), 30_000).unref()
  setTimeout(safely("reminders", runDueReminders), 5_000).unref()
}
