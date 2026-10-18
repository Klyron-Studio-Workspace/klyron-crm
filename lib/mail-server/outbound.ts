import "server-only"

import { createTransport } from "nodemailer"

import { db } from "@/lib/db"
import { resolveLinks } from "@/lib/mail-server/link"
import { resolveThread } from "@/lib/mail-server/thread"

type SendOptions = {
  fromUserId: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  bodyHtml: string
  bodyText: string
  inReplyToMessageId?: string | null
}

/**
 * Send an outbound email from a team member's mailbox.
 * Writes a SENT copy to the DB. Returns the created Email id.
 */
export async function sendEmail(opts: SendOptions): Promise<string> {
  const mailbox = await db.mailbox.findUnique({
    where: { userId: opts.fromUserId },
  })
  if (!mailbox) throw new Error("No mailbox for user " + opts.fromUserId)

  let inReplyToId: string | null = null
  if (opts.inReplyToMessageId) {
    const parent = await db.email.findUnique({
      where: { messageId: opts.inReplyToMessageId },
      select: { id: true },
    })
    inReplyToId = parent?.id ?? null
  }

  const messageId = `<${Date.now()}.${mailbox.id}@klyronstudio.com>`
  const sentAt = new Date()

  const allAddresses = [...opts.to, ...(opts.cc ?? []), ...(opts.bcc ?? [])]
  const { linkedClientId, linkedLeadId } = await resolveLinks(allAddresses)

  const threadId = await resolveThread({
    inReplyTo: opts.inReplyToMessageId ?? null,
    references: opts.inReplyToMessageId ? [opts.inReplyToMessageId] : [],
    subject: opts.subject,
    receivedAt: sentAt,
    linkedClientId,
    linkedLeadId,
  })

  const email = await db.email.create({
    data: {
      messageId,
      threadId,
      mailboxId: mailbox.id,
      direction: "OUTBOUND",
      folder: "SENT",
      fromAddress: mailbox.address,
      fromName: null,
      toAddresses: opts.to,
      ccAddresses: opts.cc ?? [],
      bccAddresses: opts.bcc ?? [],
      subject: opts.subject.slice(0, 255),
      bodyHtml: opts.bodyHtml,
      bodyText: opts.bodyText,
      inReplyToId,
      sentAt,
      read: true,
    },
  })

  const transport = createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  })

  await transport.sendMail({
    from: mailbox.address,
    to: opts.to.join(", "),
    cc: opts.cc?.join(", "),
    bcc: opts.bcc?.join(", "),
    subject: opts.subject,
    html: opts.bodyHtml,
    text: opts.bodyText,
    messageId,
    inReplyTo: opts.inReplyToMessageId ?? undefined,
    references: opts.inReplyToMessageId ? [opts.inReplyToMessageId] : undefined,
  })

  return email.id
}
