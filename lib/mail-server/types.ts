/** A parsed inbound message ready for DB storage. */
export type InboundMail = {
  messageId: string
  inReplyTo: string | null   // raw In-Reply-To header value
  references: string[]       // parsed References header
  subject: string
  fromAddress: string
  fromName: string | null
  toAddresses: string[]
  ccAddresses: string[]
  bodyHtml: string | null
  bodyText: string | null
  receivedAt: Date
  attachments: InboundAttachment[]
}

export type InboundAttachment = {
  filename: string
  mimeType: string
  size: number
  content: Buffer
}

/** Result returned from deliver() — used by the Haraka plugin. */
export type DeliverResult = {
  emailId: string
  mailboxId: string
  userId: string
}
