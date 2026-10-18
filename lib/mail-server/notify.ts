import "server-only"

import { db } from "@/lib/db"
import { publish } from "@/lib/realtime/bus"

export async function notifyInbound(opts: {
  userId: string
  mailboxId: string
  emailId: string
  fromName: string | null
  fromAddress: string
  subject: string
}): Promise<void> {
  const fromLabel = opts.fromName ?? opts.fromAddress

  await db.notification.create({
    data: {
      userId: opts.userId,
      type: "mail.inbound",
      title: `New email from ${fromLabel}`.slice(0, 200),
      body: opts.subject.slice(0, 500),
      link: `/mail?id=${opts.emailId}`,
    },
  })

  publish([opts.userId], {
    type: "mail.inbound",
    mailboxId: opts.mailboxId,
    emailId: opts.emailId,
    fromName: opts.fromName,
    subject: opts.subject,
  })
}
