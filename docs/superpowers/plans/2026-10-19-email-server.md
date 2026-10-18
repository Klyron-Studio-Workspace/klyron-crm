# Email Server (Phase 9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Haraka-based SMTP server so every team member gets a private `@klyronstudio.com` inbox inside the CRM, with inbound mail auto-linked to Lead/Client records.

**Architecture:** Haraka runs as a second PM2 process (same VPS, same repo). Inbound mail flows into a custom `klyron_deliver` plugin that writes directly to the shared MySQL database via Prisma. Next.js serves the `/mail` inbox UI and Lead/Client email tabs using server actions; SSE pushes new-mail notifications to connected clients.

**Tech Stack:** Haraka (Node.js SMTP), mailparser (MIME parsing), sanitize-html (XSS prevention), Prisma 7/MySQL (shared DB), Next.js 16 App Router + Server Actions, Server-Sent Events (existing bus), lucide-react icons, Tailwind v4, shadcn Base UI.

---

## File Map

### New files
| Path | Responsibility |
|---|---|
| `haraka/package.json` | Haraka + mailparser deps for the mail process |
| `haraka/config/smtp.ini` | Ports, hostname |
| `haraka/config/tls.ini` | TLS cert paths |
| `haraka/config/dkim_sign.ini` | DKIM signing config |
| `haraka/config/rcpt_to.ini` | Accept only @klyronstudio.com |
| `haraka/config/plugins` | Active plugin list |
| `haraka/plugins/klyron_deliver.js` | Custom plugin: parse → DB → notify |
| `lib/mail-server/types.ts` | Shared TypeScript types (InboundMail, etc.) |
| `lib/mail-server/mailbox.ts` | Create/get Mailbox rows |
| `lib/mail-server/thread.ts` | Resolve/create EmailThread |
| `lib/mail-server/link.ts` | Match addresses → Lead/Client |
| `lib/mail-server/deliver.ts` | Parse MIME, write Email + attachments to DB |
| `lib/mail-server/notify.ts` | Fire in-app notification + SSE |
| `lib/mail-server/outbound.ts` | Send email via nodemailer, write SENT copy |
| `lib/actions/mail.ts` | Server actions (list, read, send, trash, etc.) |
| `app/(crm)/mail/layout.tsx` | Three-panel shell |
| `app/(crm)/mail/page.tsx` | Inbox (default folder) |
| `components/mail/folder-nav.tsx` | Left panel: folder list + unread counts |
| `components/mail/thread-list.tsx` | Centre panel: email list |
| `components/mail/email-reader.tsx` | Right panel: read pane |
| `components/mail/compose-dialog.tsx` | Compose / reply dialog |
| `components/mail/emails-tab.tsx` | Reusable tab for Lead/Client pages |
| `prisma/migrations/20261020000000_email_server/migration.sql` | DB migration |

### Modified files
| Path | Change |
|---|---|
| `prisma/schema.prisma` | Add Mailbox, EmailThread, Email, EmailAttachment models + 2 enums |
| `lib/realtime/events.ts` | Add `mail.inbound` event type |
| `lib/auth/permissions.ts` | Add `mail` module key |
| `lib/navigation.ts` | Add Mail nav item |
| `lib/actions/team.ts` | Auto-create Mailbox after `createMember` |
| `app/(crm)/leads/[id]/page.tsx` | Add Emails tab |
| `app/(crm)/clients/[id]/page.tsx` | Add Emails tab |
| `deploy/ecosystem.config.cjs` | Add klyron-mail PM2 entry |

---

## Task 1: Install dependencies

**Files:** `package.json`, `haraka/package.json`

- [ ] **Step 1: Install sanitize-html in the main app**

```bash
npm install sanitize-html
npm install --save-dev @types/sanitize-html
```

Expected output: updated `package.json`, no errors.

- [ ] **Step 2: Create haraka/package.json**

Create `haraka/package.json`:

```json
{
  "name": "klyron-mail",
  "version": "1.0.0",
  "private": true,
  "description": "Haraka SMTP server for Klyron CRM",
  "main": "index.js",
  "dependencies": {
    "Haraka": "^3.0.4",
    "mailparser": "^3.7.1"
  }
}
```

- [ ] **Step 3: Install haraka deps**

```bash
cd haraka && npm install && cd ..
```

Expected: `haraka/node_modules/` created with Haraka and mailparser.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json haraka/package.json haraka/package-lock.json
git commit -m "chore: add sanitize-html to app, create haraka package"
```

---

## Task 2: Database schema — add email models

**Files:** `prisma/schema.prisma`, `prisma/migrations/20261020000000_email_server/migration.sql`

- [ ] **Step 1: Add enums and models to schema**

Open `prisma/schema.prisma`. At the very end of the file, append:

```prisma
// ─── Email (Phase 9) ────────────────────────────────────────────────────────

enum EmailDirection {
  INBOUND
  OUTBOUND
}

enum EmailFolder {
  INBOX
  SENT
  DRAFTS
  TRASH
  ARCHIVE
}

model Mailbox {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  address   String   @unique @db.VarChar(254)
  createdAt DateTime @default(now())

  emails Email[]

  @@map("mailbox")
}

model EmailThread {
  id             String   @id @default(cuid())
  subject        String   @db.VarChar(255)
  linkedLeadId   String?
  linkedClientId String?
  linkedLead     Lead?    @relation(fields: [linkedLeadId], references: [id], onDelete: SetNull)
  linkedClient   Client?  @relation(fields: [linkedClientId], references: [id], onDelete: SetNull)
  lastEmailAt    DateTime
  createdAt      DateTime @default(now())

  emails Email[]

  @@index([linkedLeadId])
  @@index([linkedClientId])
  @@map("email_thread")
}

model Email {
  id            String         @id @default(cuid())
  messageId     String         @unique @db.VarChar(512)
  threadId      String
  thread        EmailThread    @relation(fields: [threadId], references: [id], onDelete: Cascade)
  mailboxId     String
  mailbox       Mailbox        @relation(fields: [mailboxId], references: [id], onDelete: Cascade)
  direction     EmailDirection
  folder        EmailFolder    @default(INBOX)
  fromAddress   String         @db.VarChar(254)
  fromName      String?        @db.VarChar(120)
  toAddresses   Json
  ccAddresses   Json           @default("[]")
  bccAddresses  Json           @default("[]")
  subject       String         @db.VarChar(255)
  bodyHtml      String?        @db.LongText
  bodyText      String?        @db.LongText
  inReplyToId   String?
  inReplyTo     Email?         @relation("EmailReplies", fields: [inReplyToId], references: [id], onDelete: SetNull)
  replies       Email[]        @relation("EmailReplies")
  read          Boolean        @default(false)
  starred       Boolean        @default(false)
  sentAt        DateTime?
  receivedAt    DateTime?
  deletedAt     DateTime?
  createdAt     DateTime       @default(now())

  attachments EmailAttachment[]

  @@index([mailboxId, folder, receivedAt])
  @@index([threadId, receivedAt])
  @@map("email")
}

model EmailAttachment {
  id           String     @id @default(cuid())
  emailId      String
  email        Email      @relation(fields: [emailId], references: [id], onDelete: Cascade)
  storedFileId String
  storedFile   StoredFile @relation(fields: [storedFileId], references: [id], onDelete: Cascade)
  filename     String     @db.VarChar(255)
  mimeType     String     @db.VarChar(127)
  size         BigInt

  @@index([emailId])
  @@map("email_attachment")
}
```

Also add the back-relations to `User`, `Lead`, `Client`, and `StoredFile` models. Find the `User` model and add inside its relations block:

```prisma
  mailbox           Mailbox?
```

Find the `Lead` model and add:

```prisma
  emailThreads      EmailThread[]
```

Find the `Client` model and add:

```prisma
  emailThreads      EmailThread[]
```

Find the `StoredFile` model and add:

```prisma
  emailAttachments  EmailAttachment[]
```

- [ ] **Step 2: Run migration**

```bash
npm run db:migrate
```

Expected: Prisma creates `prisma/migrations/20261020000000_email_server/migration.sql` and applies it. Tables `mailbox`, `email_thread`, `email`, `email_attachment` appear in the database.

- [ ] **Step 3: Verify Prisma client was regenerated**

```bash
npm run db:generate
```

Expected: `lib/generated/prisma/` updated with new model types. No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ lib/generated/prisma/
git commit -m "feat(db): add Mailbox, EmailThread, Email, EmailAttachment models"
```

---

## Task 3: Add mail module to permissions + nav

**Files:** `lib/auth/permissions.ts`, `lib/navigation.ts`

- [ ] **Step 1: Read permissions file**

Open `lib/auth/permissions.ts` and find the `ModuleKey` type definition. Add `"mail"` to the union.

Find the `defaultPermissions` map. Add a default entry following the same pattern as the other modules (OWNER/ADMIN: WRITE, MEMBER: WRITE, CLIENT: NONE):

```ts
mail: { OWNER: "WRITE", ADMIN: "WRITE", MEMBER: "WRITE", CLIENT: "NONE" },
```

- [ ] **Step 2: Add Mail to nav**

Open `lib/navigation.ts`. Add the import for `MailIcon`:

```ts
import {
  // ... existing imports ...
  MailIcon,
} from "lucide-react"
```

In the `navSections` array, inside the `"Workspace"` section items array, add after `"Chat"`:

```ts
{ title: "Mail", href: "/mail", icon: MailIcon, module: "mail" },
```

- [ ] **Step 3: Commit**

```bash
git add lib/auth/permissions.ts lib/navigation.ts
git commit -m "feat(mail): add mail module to permissions and nav"
```

---

## Task 4: lib/mail-server/types.ts

**Files:** `lib/mail-server/types.ts` (create)

- [ ] **Step 1: Create types file**

Create `lib/mail-server/types.ts`:

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/mail-server/types.ts
git commit -m "feat(mail): add mail-server types"
```

---

## Task 5: lib/mail-server/mailbox.ts

**Files:** `lib/mail-server/mailbox.ts` (create)

- [ ] **Step 1: Write unit test**

Create `lib/mail-server/mailbox.test.ts`:

```ts
import assert from "node:assert/strict"
import { test } from "node:test"

// normalizeAddress is the only pure logic here — test it directly.
import { normalizeAddress } from "./mailbox.ts"

test("normalizeAddress lowercases and trims", () => {
  assert.equal(normalizeAddress("  Ali@KlyronStudio.COM  "), "ali@klyronstudio.com")
})

test("normalizeAddress strips display name", () => {
  assert.equal(normalizeAddress("Ali Syed <ali@klyronstudio.com>"), "ali@klyronstudio.com")
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
node --experimental-transform-types --test lib/mail-server/mailbox.test.ts
```

Expected: `ERR_MODULE_NOT_FOUND` or import error — `mailbox.ts` does not exist yet.

- [ ] **Step 3: Create mailbox.ts**

Create `lib/mail-server/mailbox.ts`:

```ts
import { db } from "@/lib/db"

/** Strip display name and normalise to lowercase. */
export function normalizeAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/)
  return (match ? match[1] : raw).trim().toLowerCase()
}

/** Ensure a Mailbox row exists for this user. Idempotent. */
export async function ensureMailbox(userId: string, name: string): Promise<string> {
  const localPart = name
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.|\.$/, "")
  const address = `${localPart}@klyronstudio.com`

  const existing = await db.mailbox.findUnique({ where: { userId } })
  if (existing) return existing.id

  const mailbox = await db.mailbox.create({ data: { userId, address } })
  return mailbox.id
}

/** Resolve a recipient address to a mailbox id. Returns null if not found. */
export async function resolveMailbox(address: string): Promise<{ id: string; userId: string } | null> {
  const normalized = normalizeAddress(address)
  const mailbox = await db.mailbox.findUnique({
    where: { address: normalized },
    select: { id: true, userId: true },
  })
  return mailbox
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
node --experimental-transform-types --test lib/mail-server/mailbox.test.ts
```

Expected: `pass normalizeAddress lowercases and trims`, `pass normalizeAddress strips display name`.

- [ ] **Step 5: Commit**

```bash
git add lib/mail-server/mailbox.ts lib/mail-server/mailbox.test.ts
git commit -m "feat(mail): add mailbox helpers with normalizeAddress"
```

---

## Task 6: lib/mail-server/link.ts

**Files:** `lib/mail-server/link.ts` (create)

- [ ] **Step 1: Create link.ts**

Create `lib/mail-server/link.ts`:

```ts
import { db } from "@/lib/db"

/**
 * Given a set of email addresses, find the first matching Client or Lead.
 * Client match takes priority. Returns ids to set on the EmailThread.
 */
export async function resolveLinks(addresses: string[]): Promise<{
  linkedClientId: string | null
  linkedLeadId: string | null
}> {
  const normalized = addresses.map((a) => a.toLowerCase().trim())

  const client = await db.client.findFirst({
    where: { email: { in: normalized } },
    select: { id: true },
  })
  if (client) return { linkedClientId: client.id, linkedLeadId: null }

  const lead = await db.lead.findFirst({
    where: { email: { in: normalized } },
    select: { id: true },
  })
  return { linkedClientId: null, linkedLeadId: lead?.id ?? null }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/mail-server/link.ts
git commit -m "feat(mail): add address-to-lead/client linker"
```

---

## Task 7: lib/mail-server/thread.ts

**Files:** `lib/mail-server/thread.ts` (create)

- [ ] **Step 1: Write unit test for subject normalization**

Create `lib/mail-server/thread.test.ts`:

```ts
import assert from "node:assert/strict"
import { test } from "node:test"

import { normalizeSubject } from "./thread.ts"

test("normalizeSubject strips Re:", () => {
  assert.equal(normalizeSubject("Re: Meeting tomorrow"), "Meeting tomorrow")
})

test("normalizeSubject strips Fwd:", () => {
  assert.equal(normalizeSubject("Fwd: Invoice #123"), "Invoice #123")
})

test("normalizeSubject strips nested prefixes", () => {
  assert.equal(normalizeSubject("Re: Re: Fwd: Hello"), "Hello")
})

test("normalizeSubject trims whitespace", () => {
  assert.equal(normalizeSubject("  Hello world  "), "Hello world")
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
node --experimental-transform-types --test lib/mail-server/thread.test.ts
```

Expected: import error — file does not exist yet.

- [ ] **Step 3: Create thread.ts**

Create `lib/mail-server/thread.ts`:

```ts
import { db } from "@/lib/db"

export function normalizeSubject(raw: string): string {
  return raw
    .replace(/^(Re|Fwd|Fw):\s*/gi, "")
    .replace(/^(Re|Fwd|Fw):\s*/gi, "")  // second pass for "Re: Re:"
    .replace(/^(Re|Fwd|Fw):\s*/gi, "")  // third pass handles triple-nesting
    .trim()
}

/**
 * Find an existing thread by In-Reply-To / References message IDs,
 * or create a new one. Updates lastEmailAt.
 */
export async function resolveThread(opts: {
  inReplyTo: string | null
  references: string[]
  subject: string
  receivedAt: Date
  linkedClientId: string | null
  linkedLeadId: string | null
}): Promise<string> {
  // Try to find a parent email by In-Reply-To or References
  const refIds = [opts.inReplyTo, ...opts.references].filter(Boolean) as string[]
  let threadId: string | null = null

  if (refIds.length > 0) {
    const parent = await db.email.findFirst({
      where: { messageId: { in: refIds } },
      select: { threadId: true },
    })
    threadId = parent?.threadId ?? null
  }

  if (threadId) {
    await db.emailThread.update({
      where: { id: threadId },
      data: {
        lastEmailAt: opts.receivedAt,
        linkedClientId: opts.linkedClientId ?? undefined,
        linkedLeadId: opts.linkedLeadId ?? undefined,
      },
    })
    return threadId
  }

  const thread = await db.emailThread.create({
    data: {
      subject: normalizeSubject(opts.subject).slice(0, 255),
      lastEmailAt: opts.receivedAt,
      linkedClientId: opts.linkedClientId,
      linkedLeadId: opts.linkedLeadId,
    },
  })
  return thread.id
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
node --experimental-transform-types --test lib/mail-server/thread.test.ts
```

Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/mail-server/thread.ts lib/mail-server/thread.test.ts
git commit -m "feat(mail): add thread resolver with subject normalization"
```

---

## Task 8: lib/mail-server/notify.ts

**Files:** `lib/mail-server/notify.ts` (create)

- [ ] **Step 1: Add mail.inbound event to SSE types**

Open `lib/realtime/events.ts`. Add to the `RealtimeEvent` union:

```ts
| { type: "mail.inbound"; mailboxId: string; emailId: string; fromName: string | null; subject: string }
```

- [ ] **Step 2: Create notify.ts**

Create `lib/mail-server/notify.ts`:

```ts
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
      title: `New email from ${fromLabel}`,
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
```

- [ ] **Step 3: Commit**

```bash
git add lib/mail-server/notify.ts lib/realtime/events.ts
git commit -m "feat(mail): add inbound mail notification + SSE event"
```

---

## Task 9: lib/mail-server/deliver.ts

**Files:** `lib/mail-server/deliver.ts` (create)

- [ ] **Step 1: Create deliver.ts**

Create `lib/mail-server/deliver.ts`:

```ts
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

  // Resolve CRM record links from all participant addresses
  const allAddresses = [mail.fromAddress, ...mail.toAddresses, ...mail.ccAddresses]
  const { linkedClientId, linkedLeadId } = await resolveLinks(allAddresses)

  // Resolve or create thread
  const threadId = await resolveThread({
    inReplyTo: mail.inReplyTo,
    references: mail.references,
    subject: mail.subject,
    receivedAt: mail.receivedAt,
    linkedClientId,
    linkedLeadId,
  })

  // Write Email row
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

  // Notify the recipient
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/mail-server/deliver.ts
git commit -m "feat(mail): add deliver() — persists inbound MIME to DB"
```

---

## Task 10: lib/mail-server/outbound.ts

**Files:** `lib/mail-server/outbound.ts` (create)

- [ ] **Step 1: Create outbound.ts**

Create `lib/mail-server/outbound.ts`:

```ts
import { createTransport } from "nodemailer"

import { db } from "@/lib/db"
import { resolveLinks } from "@/lib/mail-server/link"
import { resolveMailbox } from "@/lib/mail-server/mailbox"
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

  // Find parent thread (if replying)
  let inReplyToId: string | null = null
  if (opts.inReplyToMessageId) {
    const parent = await db.email.findUnique({
      where: { messageId: opts.inReplyToMessageId },
      select: { id: true },
    })
    inReplyToId = parent?.id ?? null
  }

  // Unique message-id for this outbound message
  const messageId = `<${Date.now()}.${mailbox.id}@klyronstudio.com>`
  const sentAt = new Date()

  // Link to Lead/Client
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

  // Write SENT email row first so we have an id
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

  // Send via SMTP (uses same env vars as the existing mail.ts)
  const transport = createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  })

  await transport.sendMail({
    from: `${mailbox.address}`,
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/mail-server/outbound.ts
git commit -m "feat(mail): add sendEmail() — outbound with SENT copy to DB"
```

---

## Task 11: lib/actions/mail.ts — server actions

**Files:** `lib/actions/mail.ts` (create)

- [ ] **Step 1: Create mail actions**

Create `lib/actions/mail.ts`:

```ts
"use server"

import sanitizeHtml from "sanitize-html"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { fieldErrorsFrom, echo, type FormState } from "@/lib/actions/state"
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

  // Sanitize HTML body before returning to client
  const safeHtml = email.bodyHtml
    ? sanitizeHtml(email.bodyHtml, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
        allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ["src", "alt"] },
        allowedSchemes: ["http", "https", "mailto"],
      })
    : null

  // Mark as read
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
  } catch {
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/mail.ts
git commit -m "feat(mail): add server actions (list, read, send, move, star)"
```

---

## Task 12: Auto-provision mailbox on team member creation

**Files:** `lib/actions/team.ts`

- [ ] **Step 1: Import ensureMailbox and add provisioning**

Open `lib/actions/team.ts`. Add the import at the top:

```ts
import { ensureMailbox } from "@/lib/mail-server/mailbox"
```

Find the `createMember` action. After the `logEvent(...)` call and before `revalidatePath(TEAM_PATH)`, add:

```ts
  // Provision a private mailbox for team members
  if (role !== "CLIENT") {
    await ensureMailbox(user.id, name)
  }
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/team.ts
git commit -m "feat(mail): auto-provision mailbox when team member is created"
```

---

## Task 13: Haraka configuration files

**Files:** `haraka/config/*`, `haraka/plugins/klyron_deliver.js`

- [ ] **Step 1: Create smtp.ini**

Create `haraka/config/smtp.ini`:

```ini
listen=0.0.0.0:25,0.0.0.0:587
me=mail.klyronstudio.com
```

- [ ] **Step 2: Create tls.ini**

Create `haraka/config/tls.ini`:

```ini
key=/etc/letsencrypt/live/klyronstudio.com/privkey.pem
cert=/etc/letsencrypt/live/klyronstudio.com/fullchain.pem
```

- [ ] **Step 3: Create rcpt_to.ini**

Create `haraka/config/rcpt_to.ini`:

```ini
[check]
domains=klyronstudio.com
```

- [ ] **Step 4: Create dkim_sign.ini**

Create `haraka/config/dkim_sign.ini`:

```ini
selector=mail
domain=klyronstudio.com
key_file=/etc/dkim/klyronstudio.com/mail.private
```

- [ ] **Step 5: Create plugins list**

Create `haraka/config/plugins`:

```
tls
dkim_verify
rcpt_to.in_host_list
rate_limit
klyron_deliver
```

- [ ] **Step 6: Create the custom deliver plugin**

Create `haraka/plugins/klyron_deliver.js`:

```js
"use strict"

const { simpleParser } = require("mailparser")
const path = require("path")

// Load .env.local for DATABASE_URL
try { require("node:process").loadEnvFile(path.join(__dirname, "../../.env.local")) } catch {}
try { require("node:process").loadEnvFile(path.join(__dirname, "../../.env")) } catch {}

// Lazy-load the deliver function so Haraka boots before Prisma connects
let deliverFn = null
async function getDeliver() {
  if (!deliverFn) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = await import("../../lib/mail-server/deliver.ts")
    deliverFn = mod.deliver
  }
  return deliverFn
}

exports.hook_data_post = async function (next, connection) {
  try {
    const raw = await streamToBuffer(connection.transaction.message_stream)
    const parsed = await simpleParser(raw)

    const mail = {
      messageId: parsed.messageId ?? `<generated.${Date.now()}@klyronstudio.com>`,
      inReplyTo: parsed.inReplyTo ?? null,
      references: Array.isArray(parsed.references) ? parsed.references : [],
      subject: parsed.subject ?? "(no subject)",
      fromAddress: parsed.from?.value?.[0]?.address ?? "",
      fromName: parsed.from?.value?.[0]?.name ?? null,
      toAddresses: (parsed.to?.value ?? []).map((a) => a.address),
      ccAddresses: (parsed.cc?.value ?? []).map((a) => a.address),
      bodyHtml: parsed.html || null,
      bodyText: parsed.text || null,
      receivedAt: parsed.date ?? new Date(),
      attachments: [], // StoredFile integration is a future enhancement
    }

    const recipients = connection.transaction.rcpt_to
    const deliver = await getDeliver()
    for (const rcpt of recipients) {
      await deliver(rcpt.address(), mail)
    }
  } catch (err) {
    connection.logerror(exports, `klyron_deliver error: ${err.message}`)
  }
  next()
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on("data", (chunk) => chunks.push(chunk))
    stream.on("end", () => resolve(Buffer.concat(chunks)))
    stream.on("error", reject)
  })
}
```

- [ ] **Step 7: Commit**

```bash
git add haraka/
git commit -m "feat(mail): add Haraka config + klyron_deliver plugin"
```

---

## Task 14: Update PM2 ecosystem for Haraka

**Files:** `deploy/ecosystem.config.cjs`

- [ ] **Step 1: Add klyron-mail entry**

Open `deploy/ecosystem.config.cjs`. Replace the file contents with:

```js
// PM2 process file for the VPS:  pm2 start deploy/ecosystem.config.cjs && pm2 save
//
// Run exactly ONE instance of each app (fork mode).
// Live updates (SSE) and the scheduler live inside the klyron-crm process.
module.exports = {
  apps: [
    {
      name: "klyron-crm",
      cwd: __dirname + "/..",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      exec_mode: "fork",
      instances: 1,
      env: { NODE_ENV: "production" },
      max_memory_restart: "1G",
      time: true,
    },
    {
      name: "klyron-mail",
      cwd: __dirname + "/..",
      script: "haraka/node_modules/.bin/haraka",
      args: "-c haraka",
      exec_mode: "fork",
      instances: 1,
      env: { NODE_ENV: "production" },
      max_memory_restart: "512M",
      time: true,
    },
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add deploy/ecosystem.config.cjs
git commit -m "chore(deploy): add klyron-mail PM2 process for Haraka"
```

---

## Task 15: /mail layout and folder nav

**Files:** `app/(crm)/mail/layout.tsx`, `components/mail/folder-nav.tsx`

- [ ] **Step 1: Create folder-nav component**

Create `components/mail/folder-nav.tsx`:

```tsx
"use client"

import { usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import { InboxIcon, SendIcon, FileEditIcon, ArchiveIcon, Trash2Icon } from "lucide-react"

const folders = [
  { label: "Inbox",   value: "INBOX",   icon: InboxIcon },
  { label: "Sent",    value: "SENT",    icon: SendIcon },
  { label: "Drafts",  value: "DRAFTS",  icon: FileEditIcon },
  { label: "Archive", value: "ARCHIVE", icon: ArchiveIcon },
  { label: "Trash",   value: "TRASH",   icon: Trash2Icon },
] as const

type Props = { unread: number }

export function FolderNav({ unread }: Props) {
  const searchParams = useSearchParams()
  const activeFolder = searchParams.get("folder") ?? "INBOX"

  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {folders.map(({ label, value, icon: Icon }) => {
        const isActive = activeFolder === value
        return (
          <Link
            key={value}
            href={`/mail?folder=${value}`}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-[#DC143C]/10 text-[#DC143C] font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {value === "INBOX" && unread > 0 && (
              <span className="rounded-full bg-[#DC143C] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Create mail layout**

Create `app/(crm)/mail/layout.tsx`:

```tsx
import { countUnread } from "@/lib/actions/mail"
import { FolderNav } from "@/components/mail/folder-nav"

export default async function MailLayout({ children }: { children: React.ReactNode }) {
  const unread = await countUnread()

  return (
    <div className="flex h-[calc(100vh-var(--header-height,56px))] overflow-hidden">
      {/* Left panel — folder nav */}
      <aside className="hidden w-56 shrink-0 border-r flex-col md:flex">
        <div className="border-b p-4">
          <h2 className="text-sm font-semibold">Mail</h2>
        </div>
        <FolderNav unread={unread} />
      </aside>

      {/* Centre + right panels */}
      <div className="flex flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(crm)/mail/layout.tsx components/mail/folder-nav.tsx
git commit -m "feat(mail): add mail layout and folder nav"
```

---

## Task 16: /mail page — thread list + email reader

**Files:** `app/(crm)/mail/page.tsx`, `components/mail/thread-list.tsx`, `components/mail/email-reader.tsx`

- [ ] **Step 1: Create thread-list component**

Create `components/mail/thread-list.tsx`:

```tsx
"use client"

import { formatDistanceToNow } from "date-fns"
import { StarIcon } from "lucide-react"
import { starEmail } from "@/lib/actions/mail"

type EmailRow = {
  id: string
  subject: string
  fromAddress: string
  fromName: string | null
  read: boolean
  starred: boolean
  receivedAt: Date | null
  sentAt: Date | null
  direction: "INBOUND" | "OUTBOUND"
}

type Props = {
  emails: EmailRow[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function ThreadList({ emails, selectedId, onSelect }: Props) {
  if (emails.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No messages
      </div>
    )
  }

  return (
    <ul className="flex-1 overflow-y-auto divide-y">
      {emails.map((email) => {
        const date = email.receivedAt ?? email.sentAt
        return (
          <li
            key={email.id}
            onClick={() => onSelect(email.id)}
            className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
              selectedId === email.id ? "bg-muted" : ""
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={`truncate text-sm ${!email.read ? "font-semibold" : "font-normal"}`}>
                  {email.fromName ?? email.fromAddress}
                </p>
                {date && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(date), { addSuffix: true })}
                  </span>
                )}
              </div>
              <p className={`truncate text-sm ${!email.read ? "text-foreground" : "text-muted-foreground"}`}>
                {email.subject}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                starEmail(email.id, !email.starred)
              }}
              className="shrink-0 mt-0.5"
            >
              <StarIcon
                className={`size-4 ${email.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-400"}`}
              />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 2: Create email-reader component**

Create `components/mail/email-reader.tsx`:

```tsx
"use client"

import { formatDistanceToNow } from "date-fns"
import { ArchiveIcon, Trash2Icon, ReplyIcon } from "lucide-react"
import { moveEmail } from "@/lib/actions/mail"
import { useState } from "react"
import { ComposeDialog } from "@/components/mail/compose-dialog"

type FullEmail = {
  id: string
  subject: string
  fromAddress: string
  fromName: string | null
  toAddresses: string[]
  bodyHtml: string | null
  bodyText: string | null
  receivedAt: Date | null
  sentAt: Date | null
  messageId: string
}

type Props = { email: FullEmail | null }

export function EmailReader({ email }: Props) {
  const [composing, setComposing] = useState(false)

  if (!email) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Select a message to read
      </div>
    )
  }

  const date = email.receivedAt ?? email.sentAt

  return (
    <div className="flex flex-1 flex-col overflow-hidden border-l">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b p-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold truncate">{email.subject}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress}
            {date && ` · ${formatDistanceToNow(new Date(date), { addSuffix: true })}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setComposing(true)}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <ReplyIcon className="size-3.5" /> Reply
          </button>
          <button
            onClick={() => moveEmail(email.id, "ARCHIVE")}
            className="rounded-md border p-1.5 hover:bg-muted"
            title="Archive"
          >
            <ArchiveIcon className="size-4" />
          </button>
          <button
            onClick={() => moveEmail(email.id, "TRASH")}
            className="rounded-md border p-1.5 hover:bg-muted text-destructive"
            title="Trash"
          >
            <Trash2Icon className="size-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {email.bodyHtml ? (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
          />
        ) : (
          <pre className="whitespace-pre-wrap text-sm font-sans">{email.bodyText}</pre>
        )}
      </div>

      {composing && (
        <ComposeDialog
          defaultTo={email.fromAddress}
          defaultSubject={`Re: ${email.subject}`}
          inReplyToMessageId={email.messageId}
          onClose={() => setComposing(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create compose dialog**

Create `components/mail/compose-dialog.tsx`:

```tsx
"use client"

import { useActionState } from "react"
import { XIcon, SendIcon } from "lucide-react"
import { sendMailAction } from "@/lib/actions/mail"

const initial = { values: {} }

type Props = {
  defaultTo?: string
  defaultSubject?: string
  inReplyToMessageId?: string
  onClose: () => void
}

export function ComposeDialog({ defaultTo = "", defaultSubject = "", inReplyToMessageId, onClose }: Props) {
  const [state, action, pending] = useActionState(sendMailAction, initial)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-6">
      <div className="w-full max-w-lg rounded-xl border bg-background shadow-2xl flex flex-col">
        {/* Title bar */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">New message</span>
          <button onClick={onClose}><XIcon className="size-4" /></button>
        </div>

        <form action={action} className="flex flex-col gap-0">
          {inReplyToMessageId && (
            <input type="hidden" name="inReplyToMessageId" value={inReplyToMessageId} />
          )}

          <div className="border-b px-4 py-2">
            <input
              name="to"
              defaultValue={state.values?.to ?? defaultTo}
              placeholder="To"
              className="w-full bg-transparent text-sm outline-none"
              required
            />
          </div>
          <div className="border-b px-4 py-2">
            <input
              name="subject"
              defaultValue={state.values?.subject ?? defaultSubject}
              placeholder="Subject"
              className="w-full bg-transparent text-sm outline-none"
              required
            />
          </div>
          <textarea
            name="body"
            defaultValue={state.values?.body ?? ""}
            placeholder="Write your message…"
            rows={10}
            className="flex-1 resize-none bg-transparent px-4 py-3 text-sm outline-none"
            required
          />

          {state.fieldErrors?.body && (
            <p className="px-4 pb-2 text-xs text-destructive">{state.fieldErrors.body[0]}</p>
          )}

          <div className="flex items-center justify-between border-t px-4 py-3">
            {state.ok && <p className="text-xs text-green-600">{state.message}</p>}
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm hover:bg-muted">
                Discard
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-1.5 rounded-md bg-[#DC143C] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                <SendIcon className="size-3.5" />
                {pending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create the main /mail page**

Create `app/(crm)/mail/page.tsx`:

```tsx
import { Suspense } from "react"
import { getEmail, listEmails } from "@/lib/actions/mail"
import { ThreadList } from "@/components/mail/thread-list"
import { EmailReader } from "@/components/mail/email-reader"
import { ComposeDialog } from "@/components/mail/compose-dialog"
import type { EmailFolder } from "@/lib/generated/prisma/enums"

type Props = {
  searchParams: Promise<{ folder?: string; id?: string; compose?: string }>
}

export default async function MailPage({ searchParams }: Props) {
  const { folder, id, compose } = await searchParams
  const activeFolder = (folder as EmailFolder) || "INBOX"

  const [emails, activeEmail] = await Promise.all([
    listEmails(activeFolder),
    id ? getEmail(id) : Promise.resolve(null),
  ])

  return (
    <>
      {/* Centre panel — thread list */}
      <div className="flex w-72 shrink-0 flex-col border-r">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold capitalize">{activeFolder.toLowerCase()}</h3>
          <a
            href="/mail?compose=1"
            className="rounded-md bg-[#DC143C] px-3 py-1.5 text-xs font-medium text-white"
          >
            Compose
          </a>
        </div>
        <Suspense>
          <ThreadList
            emails={emails as never}
            selectedId={id ?? null}
            onSelect={() => {}}
          />
        </Suspense>
      </div>

      {/* Right panel — reader */}
      <EmailReader email={activeEmail as never} />

      {compose && <ComposeDialog onClose={() => {}} />}
    </>
  )
}
```

> **Note:** ThreadList's `onSelect` needs a client wrapper for navigation. In a follow-up, extract a `MailShell` client component that wraps ThreadList and uses `router.push` for selection. For now the list is server-rendered and selection works via link clicks with `?id=`.

- [ ] **Step 5: Commit**

```bash
git add app/(crm)/mail/ components/mail/
git commit -m "feat(mail): add /mail page with thread list, reader, and compose dialog"
```

---

## Task 17: Lead and Client Emails tab

**Files:** `components/mail/emails-tab.tsx`, `app/(crm)/leads/[id]/page.tsx`, `app/(crm)/clients/[id]/page.tsx`

- [ ] **Step 1: Create reusable emails-tab component**

Create `components/mail/emails-tab.tsx`:

```tsx
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { MailIcon, ArrowUpRightIcon, ArrowDownLeftIcon } from "lucide-react"

type EmailRow = {
  id: string
  subject: string
  fromAddress: string
  fromName: string | null
  direction: "INBOUND" | "OUTBOUND"
  read: boolean
  receivedAt: Date | null
  sentAt: Date | null
}

type Props = {
  emails: EmailRow[]
  composeHref: string
}

export function EmailsTab({ emails, composeHref }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Emails</h3>
        <Link
          href={composeHref}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
        >
          <MailIcon className="size-3.5" /> Send email
        </Link>
      </div>

      {emails.length === 0 ? (
        <p className="text-sm text-muted-foreground">No emails yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {emails.map((email) => {
            const date = email.receivedAt ?? email.sentAt
            return (
              <li key={email.id}>
                <Link
                  href={`/mail?id=${email.id}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  {email.direction === "INBOUND" ? (
                    <ArrowDownLeftIcon className="mt-0.5 size-4 shrink-0 text-blue-500" />
                  ) : (
                    <ArrowUpRightIcon className="mt-0.5 size-4 shrink-0 text-green-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${!email.read ? "font-semibold" : ""}`}>
                      {email.subject}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {email.fromName ?? email.fromAddress}
                    </p>
                  </div>
                  {date && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(date), { addSuffix: true })}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Emails tab to Lead detail page**

Open `app/(crm)/leads/[id]/page.tsx`. Find the import block and add:

```ts
import { getLeadEmails } from "@/lib/actions/mail"
import { EmailsTab } from "@/components/mail/emails-tab"
```

In the data-fetching section (where the page awaits its queries), add:

```ts
const emails = await getLeadEmails(lead.id)
```

Find where the tabs are rendered (look for `<TabsContent` or the tab panel area). Add an Emails tab panel:

```tsx
<EmailsTab
  emails={emails as never}
  composeHref={`/mail?compose=1&to=${encodeURIComponent(lead.email ?? "")}`}
/>
```

Add its trigger to the tab list:

```tsx
<MailIcon className="size-4" /> Emails
```

- [ ] **Step 3: Add Emails tab to Client detail page**

Open `app/(crm)/clients/[id]/page.tsx`. Apply the same pattern:

```ts
import { getClientEmails } from "@/lib/actions/mail"
import { EmailsTab } from "@/components/mail/emails-tab"
```

```ts
const emails = await getClientEmails(client.id)
```

```tsx
<EmailsTab
  emails={emails as never}
  composeHref={`/mail?compose=1&to=${encodeURIComponent(client.email ?? "")}`}
/>
```

- [ ] **Step 4: Commit**

```bash
git add components/mail/emails-tab.tsx app/(crm)/leads/ app/(crm)/clients/
git commit -m "feat(mail): add Emails tab to Lead and Client detail pages"
```

---

## Task 18: Verify build passes

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any type mismatches before continuing.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors or warnings introduced by new files.

- [ ] **Step 3: Start dev server and smoke-test /mail**

```bash
npm run dev:next
```

Navigate to `http://localhost:3000/mail`. Expected:
- Three-panel layout renders without crashing
- Folder nav shows Inbox, Sent, Drafts, Archive, Trash
- Empty inbox shows "No messages"
- Compose button opens the compose dialog
- No console errors

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat(mail): phase 9 complete — built-in email server and inbox UI"
```

---

## Task 19: DNS and deliverability setup (VPS only)

> Run these on the VPS after deploying. Not needed for local development.

- [ ] **Step 1: Add DNS records**

At your domain registrar or DNS provider, add:

| Type | Name | Value |
|---|---|---|
| MX | `@` | `mail.klyronstudio.com` priority 10 |
| A | `mail` | `<VPS_IP>` |
| TXT | `@` | `v=spf1 ip4:<VPS_IP> ~all` |
| TXT | `mail._domainkey` | _(value from Step 2)_ |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:admin@klyronstudio.com` |

Set PTR record (reverse DNS) at your VPS provider: `<VPS_IP>` → `mail.klyronstudio.com`.

- [ ] **Step 2: Generate DKIM key pair**

```bash
mkdir -p /etc/dkim/klyronstudio.com
openssl genrsa -out /etc/dkim/klyronstudio.com/mail.private 2048
openssl rsa -in /etc/dkim/klyronstudio.com/mail.private -pubout -out /etc/dkim/klyronstudio.com/mail.public
chmod 600 /etc/dkim/klyronstudio.com/mail.private
```

Extract the public key for the DNS TXT record:

```bash
cat /etc/dkim/klyronstudio.com/mail.public | grep -v "^-" | tr -d '\n'
```

Add this value as `v=DKIM1; k=rsa; p=<value>` to the `mail._domainkey` TXT record.

- [ ] **Step 3: Start Haraka via PM2**

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

Expected: both `klyron-crm` and `klyron-mail` appear in `pm2 list` with status `online`.

- [ ] **Step 4: Test deliverability**

Send a test email to `admin@klyronstudio.com` from an external address. Check `pm2 logs klyron-mail`. The email should appear in the inbox at `/mail`.

Run a deliverability check at [mail-tester.com](https://mail-tester.com) — aim for 9/10 or above.

---

## Self-Review Notes

**Spec coverage verified:**
- ✅ Haraka as second PM2 process (Task 13, 14)
- ✅ 4 new DB models with correct fields and indexes (Task 2)
- ✅ Auto-linking to Lead/Client (Tasks 6, 9)
- ✅ Client-match-priority over Lead-match (Task 6)
- ✅ Thread resolution via In-Reply-To / References (Task 7)
- ✅ Mailbox auto-provision on team member create (Task 12)
- ✅ HTML sanitization via sanitize-html (Task 11)
- ✅ Recipient validation — deliver() returns null for unknown mailboxes (Task 9)
- ✅ SSE mail.inbound event (Task 8)
- ✅ In-app notification row (Task 8)
- ✅ Three-panel /mail UI (Tasks 15, 16)
- ✅ Lead/Client Emails tab (Task 17)
- ✅ Compose + Reply dialog (Task 16)
- ✅ DKIM config (Task 13)
- ✅ DNS setup steps (Task 19)

**Type consistency confirmed:** `InboundMail` defined in types.ts (Task 4) and used in deliver.ts (Task 9) and the Haraka plugin (Task 13). `DeliverResult` returned by deliver() matches plugin expectations.
