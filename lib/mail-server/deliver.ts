import "server-only"

import { db } from "@/lib/db"
import { resolveLinks } from "@/lib/mail-server/link"
import { resolveMailbox } from "@/lib/mail-server/mailbox"
import { notifyInbound } from "@/lib/mail-server/notify"
import { resolveThread } from "@/lib/mail-server/thread"
import type { DeliverResult, InboundMail } from "@/lib/mail-server/types"

/**
 * Persist one inbound email message to the database.
 * Called by the Haraka klyron_deliver plugin.
 * Returns null if the recipient mailbox does not exist (hard bounce).
 */
export async function deliver(
  recipientAddress: string,
  mail: InboundMail,
): Promise<DeliverResult | null> {
  const mailbox = await resolveMailbox(recipientAddress)
  if (!mailbox) return null

  const allAddresses = [mail.fromAddress, ...mail.toAddresses, ...mail.ccAddresses]
  const { linkedClientId, linkedLeadId } = await resolveLinks(allAddresses)

  const threadId = await resolveThread({
    inReplyTo: mail.inReplyTo,
    references: mail.references,
    subject: mail.subject,
    receivedAt: mail.receivedAt,
    linkedClientId,
    linkedLeadId,
  })

  const email = await db.email.create({
    data: {
      messageId: mail.messageId,
      threadId,
      mailboxId: mailbox.id,
      direction: "INBOUND",
      folder: "INBOX",
      fromAddress: mail.fromAddress.slice(0, 254),
      fromName: mail.fromName?.slice(0, 120) ?? null,
      toAddresses: mail.toAddresses,
      ccAddresses: mail.ccAddresses,
      bccAddresses: [],
      subject: mail.subject.slice(0, 255),
      bodyHtml: mail.bodyHtml,
      bodyText: mail.bodyText,
      receivedAt: mail.receivedAt,
      read: false,
    },
  })

  await notifyInbound({
    userId: mailbox.userId,
    mailboxId: mailbox.id,
    emailId: email.id,
    fromName: mail.fromName,
    fromAddress: mail.fromAddress,
    subject: mail.subject,
  })

  return { emailId: email.id, mailboxId: mailbox.id, userId: mailbox.userId }
}
