"use server"

import sanitizeHtml from "sanitize-html"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { echo, fieldErrorsFrom, type FormState } from "@/lib/actions/state"
import { requireTeamUser } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import type { EmailFolder } from "@/lib/generated/prisma/enums"
import { sendEmail } from "@/lib/mail-server/outbound"

const MAIL_PATH = "/mail"

/** List emails for the current user in a given folder. */
export async function listEmails(folder: EmailFolder = "INBOX") {
  const user = await requireTeamUser()
  const mailbox = await db.mailbox.findUnique({ where: { userId: user.id } })
  if (!mailbox) return []

  return db.email.findMany({
    where: { mailboxId: mailbox.id, folder, deletedAt: null },
    orderBy: { receivedAt: "desc" },
    take: 50,
    select: {
      id: true,
      subject: true,
      fromAddress: true,
      fromName: true,
      read: true,
      starred: true,
      receivedAt: true,
      sentAt: true,
      threadId: true,
      direction: true,
    },
  })
}

/** Get a single email with full body. Marks it read. */
export async function getEmail(emailId: string) {
  const user = await requireTeamUser()
  const mailbox = await db.mailbox.findUnique({ where: { userId: user.id } })
  if (!mailbox) return null

  const email = await db.email.findFirst({
    where: { id: emailId, mailboxId: mailbox.id, deletedAt: null },
    include: {
      attachments: { include: { storedFile: { select: { id: true, name: true, mimeType: true, size: true } } } },
      thread: { select: { subject: true, linkedLeadId: true, linkedClientId: true } },
    },
  })
  if (!email) return null

  const safeHtml = email.bodyHtml
    ? sanitizeHtml(email.bodyHtml, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
        allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ["src", "alt"] },
        allowedSchemes: ["http", "https", "mailto"],
      })
    : null

  if (!email.read) {
    await db.email.update({ where: { id: emailId }, data: { read: true } })
  }

  return { ...email, bodyHtml: safeHtml }
}

/** Move email to a folder (archive, trash). */
export async function moveEmail(emailId: string, folder: EmailFolder): Promise<{ ok: boolean }> {
  const user = await requireTeamUser()
  const mailbox = await db.mailbox.findUnique({ where: { userId: user.id } })
  if (!mailbox) return { ok: false }

  await db.email.updateMany({
    where: { id: emailId, mailboxId: mailbox.id },
    data: { folder },
  })
  revalidatePath(MAIL_PATH)
  return { ok: true }
}

/** Toggle starred on an email. */
export async function starEmail(emailId: string, starred: boolean): Promise<{ ok: boolean }> {
  const user = await requireTeamUser()
  const mailbox = await db.mailbox.findUnique({ where: { userId: user.id } })
  if (!mailbox) return { ok: false }

  await db.email.updateMany({
    where: { id: emailId, mailboxId: mailbox.id },
    data: { starred },
  })
  return { ok: true }
}

/** Count unread emails in INBOX for the current user. */
export async function countUnread(): Promise<number> {
  const user = await requireTeamUser()
  const mailbox = await db.mailbox.findUnique({ where: { userId: user.id } })
  if (!mailbox) return 0

  return db.email.count({ where: { mailboxId: mailbox.id, folder: "INBOX", read: false, deletedAt: null } })
}

const sendSchema = z.object({
  to: z.string().trim().min(1, "Enter at least one recipient."),
  cc: z.string().optional(),
  subject: z.string().trim().min(1, "Enter a subject.").max(255),
  body: z.string().trim().min(1, "Enter a message."),
  inReplyToMessageId: z.string().optional(),
})

/** Send an email from the current user's mailbox. */
export async function sendMailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireTeamUser()
  const values = echo(formData, ["to", "cc", "subject", "body"])
  const parsed = sendSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorsFrom(parsed.error, values)

  const { to, cc, subject, body, inReplyToMessageId } = parsed.data
  const toList = to.split(",").map((a) => a.trim()).filter(Boolean)
  const ccList = cc ? cc.split(",").map((a) => a.trim()).filter(Boolean) : []

  try {
    await sendEmail({
      fromUserId: user.id,
      to: toList,
      cc: ccList,
      subject,
      bodyHtml: `<p>${body.replace(/\n/g, "<br>")}</p>`,
      bodyText: body,
      inReplyToMessageId: inReplyToMessageId || null,
    })
  } catch (error) {
    console.error("[mail] Failed to send:", error instanceof Error ? error.message : error)
    return { fieldErrors: { body: ["Failed to send. Check your SMTP settings."] }, values }
  }

  revalidatePath(MAIL_PATH)
  return { ok: true, message: "Email sent.", values }
}

/** List emails linked to a lead. */
export async function getLeadEmails(leadId: string) {
  await requireTeamUser()
  return db.email.findMany({
    where: { thread: { linkedLeadId: leadId }, deletedAt: null },
    orderBy: { receivedAt: "desc" },
    take: 30,
    select: {
      id: true, subject: true, fromAddress: true, fromName: true,
      direction: true, read: true, receivedAt: true, sentAt: true,
    },
  })
}

/** List emails linked to a client. */
export async function getClientEmails(clientId: string) {
  await requireTeamUser()
  return db.email.findMany({
    where: { thread: { linkedClientId: clientId }, deletedAt: null },
    orderBy: { receivedAt: "desc" },
    take: 30,
    select: {
      id: true, subject: true, fromAddress: true, fromName: true,
      direction: true, read: true, receivedAt: true, sentAt: true,
    },
  })
}
