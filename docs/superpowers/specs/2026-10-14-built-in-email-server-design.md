# Built-in Email Server — Design Spec

**Date:** 2026-10-14
**Status:** Planned (not yet implemented)
**Author:** KaarimHussain

---

## 1. What This Is

Each team member (Owner, Admin, Member) gets a private `@klyronstudio.com` inbox inside the CRM. They can send, receive, read, reply to, and organize emails without leaving the app. Inbound emails are automatically linked to matching Lead or Client records so the full communication history lives alongside notes, calls, and chat.

This is a **Phase 9** feature. All phases 0–8 must be stable before starting this.

---

## 2. Approach — Haraka (Node.js SMTP)

**Why Haraka:**
- Pure Node.js SMTP server — same language, same repo, same deploy philosophy (no Docker, VPS + PM2)
- Plugin architecture maps cleanly to hooks needed: receive → validate → store → link → notify
- Handles both inbound (port 25) and outbound submission (port 587) natively
- DKIM signing built-in via `dkim_sign` plugin
- No new runtime or language to operate

**What it replaces / extends:**
- Replaces nothing — existing nodemailer stays for system emails (invoices, proposals, reminders)
- Adds a second PM2 process alongside Next.js

**Deliverability requirements (DNS on klyronstudio.com):**

| Record | Value | Purpose |
|---|---|---|
| `MX` | VPS IP, priority 10 | Route inbound mail to the server |
| `SPF` | `v=spf1 ip4:<VPS_IP> ~all` | Authorize the VPS to send |
| `DKIM` | TXT record from Haraka key gen | Cryptographic sending proof |
| `DMARC` | `v=DMARC1; p=quarantine; rua=mailto:admin@klyronstudio.com` | Policy for failed auth |
| `PTR` | `mail.klyronstudio.com` → VPS IP | Reverse DNS (set at VPS provider) |

All five records must be in place before sending real mail. Missing PTR or DMARC will get mail flagged as spam.

---

## 3. Architecture

```
Internet
    │
    ▼ port 25 (inbound)
┌─────────────────────────────┐
│  Haraka SMTP Server         │  ← PM2 process #2
│  plugins:                   │
│    - address_validator      │  reject unknown recipients early
│    - dkim_verify            │  verify inbound DKIM
│    - dkim_sign              │  sign outbound mail
│    - rate_limit             │  per-IP abuse prevention
│    - klyron_deliver         │  custom plugin: store + link + notify
└─────────────────────────────┘
    │
    ▼ internal call (no HTTP — direct DB write + in-process bus)
┌─────────────────────────────┐
│  lib/mail-server/           │
│    deliver.ts               │  parse raw message, write to DB
│    link.ts                  │  match addresses → Lead / Client
│    notify.ts                │  fire SSE notification to recipient
│    outbound.ts              │  send via Haraka submission port 587
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  MySQL / Prisma             │
│  Mailbox, Email,            │
│  EmailThread,               │
│  EmailAttachment            │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  Next.js (existing)         │  ← PM2 process #1 (unchanged)
│  /mail routes               │
│  Lead/Client email tab      │
│  SSE notifications          │
└─────────────────────────────┘
```

**Key constraint:** Haraka and Next.js are separate PM2 processes but share the same DB. They do **not** communicate over HTTP — Haraka's deliver plugin writes directly to the DB and fires the in-process SSE bus only within its own process. Next.js polls or re-fetches on the client side when a mail notification arrives via SSE (same pattern as chat messages today).

---

## 4. Database Models

Four new models added to `prisma/schema.prisma`:

### `Mailbox`
One row per team user. Created automatically when a team member is added.

```
id          String   @id
userId      String   @unique
address     String   @unique  // ali@klyronstudio.com
createdAt   DateTime
```

### `EmailThread`
Groups emails by conversation (matched via `In-Reply-To` / `References` headers).

```
id              String   @id
subject         String   // 255 chars, normalized (strip Re:/Fwd:)
linkedLeadId    String?
linkedClientId  String?
lastEmailAt     DateTime
createdAt       DateTime
```

### `Email`
One row per email message.

```
id              String      @id
messageId       String      @unique  // RFC Message-ID header
threadId        String
mailboxId       String      // recipient mailbox (null for sent from shared)
direction       Direction   // INBOUND | OUTBOUND
folder          Folder      // INBOX | SENT | DRAFTS | TRASH | ARCHIVE
fromAddress     String      // 255 chars
fromName        String?
toAddresses     Json        // String[]
ccAddresses     Json        // String[]
bccAddresses    Json        // String[] (outbound only)
subject         String      // 255 chars
bodyHtml        String?     // @db.LongText
bodyText        String?     // @db.LongText
inReplyToId     String?     // parent Email.id
read            Boolean     @default(false)
starred         Boolean     @default(false)
sentAt          DateTime?
receivedAt      DateTime?
deletedAt       DateTime?
createdAt       DateTime
```

Indexes: `(mailboxId, folder, receivedAt)`, `(threadId, receivedAt)`, `(linkedLeadId)`, `(linkedClientId)`, `messageId`

### `EmailAttachment`
Reuses `StoredFile` for actual storage — same upload pipeline as chat attachments.

```
id            String  @id
emailId       String
storedFileId  String
filename      String  // 255 chars (original name from email)
mimeType      String
size          BigInt
```

### New enums
```
enum EmailDirection { INBOUND OUTBOUND }
enum EmailFolder    { INBOX SENT DRAFTS TRASH ARCHIVE }
```

### Migration name
`20261015000000_email_server`

---

## 5. Auto-Linking Logic

On every inbound and outbound email, `lib/mail-server/link.ts` runs this check:

```
addresses to check = [fromAddress] + toAddresses + ccAddresses

for each address:
  1. exact match on Client.email  → set Email.linkedClientId (first match wins)
  2. exact match on Lead.email    → set Email.linkedLeadId   (first match wins)
  3. no match                     → leave null, user can link manually
```

Rules:
- Client match takes priority over Lead match
- If a lead was converted to a client, the client record wins
- One email can only be linked to one record (not both)
- Linking is done at deliver time — not a background job
- Manual re-linking via UI (drag or dropdown) is a future improvement

---

## 6. Lib Structure

```
lib/
└── mail-server/
    ├── deliver.ts      # parse raw MIME message (using mailparser), write Email + attachments to DB
    ├── link.ts         # address → Lead/Client matching
    ├── notify.ts       # fire in-app notification + SSE for new inbound mail
    ├── outbound.ts     # compose + send via Haraka port 587, write SENT copy to DB
    ├── thread.ts       # resolve or create EmailThread from headers
    ├── mailbox.ts      # create/get mailbox for a user
    └── types.ts        # shared TypeScript types
```

**Key dependency:** `mailparser` (npm) — parses raw MIME into structured `from`, `to`, `html`, `text`, `attachments`. Already a well-maintained package in the Node ecosystem, no need for a custom parser.

---

## 7. UI — New Routes

### `/mail` — Inbox

```
Sidebar (existing) gets a "Mail" item with unread badge

/mail layout:
  ┌─ left panel (240px) ──────┐  ┌─ email list ───────────────┐  ┌─ reading pane ─────────┐
  │  Inbox          (12)      │  │  [thread row]               │  │  Subject               │
  │  Sent                     │  │  [thread row]               │  │  From · Date           │
  │  Drafts         (2)       │  │  [thread row]               │  │                        │
  │  Archive                  │  │  …                          │  │  Body (HTML rendered)  │
  │  Trash                    │  │                             │  │                        │
  └───────────────────────────┘  └─────────────────────────────┘  │  Attachments           │
                                                                   │                        │
  [Compose] button top-left                                        │  [Reply] [Forward]     │
                                                                   │  [Archive] [Trash]     │
                                                                   └────────────────────────┘
```

Three-panel layout on desktop, collapses to single panel on mobile (same breakpoint as chat sidebar today).

### `/mail/compose` — Compose (modal or full page)

Fields: To, Cc (toggle), Bcc (toggle), Subject, rich text body (existing rich text editor pattern from chat), attachments. Send immediately or Save as draft.

### Lead/Client detail page — new "Emails" tab

Sits alongside the existing Notes, Reminders, Activity tabs. Shows all `Email` rows where `linkedLeadId` or `linkedClientId` matches, grouped by thread, newest first. Each thread row expands inline. "Send email" button opens the compose flow pre-filled with the lead/client email address.

---

## 8. Notifications

Inbound email fires:
1. A `Notification` row (type: `mail.inbound`, title: `"New email from <fromName>"`, link: `/mail?id=<emailId>`)
2. SSE event to the recipient's connected clients (same bus as chat today)
3. Unread badge on the Mail sidebar item (same pattern as chat unread badges)

No email-about-email (no nodemailer notification for inbound mail — that would be circular).

---

## 9. Haraka Configuration

```
haraka/
├── config/
│   ├── smtp.ini          # ports 25 + 587, hostname mail.klyronstudio.com
│   ├── tls.ini           # Let's Encrypt cert path (same cert as Nginx)
│   ├── dkim_sign.ini     # selector, domain, private key path
│   ├── rcpt_to.ini       # valid recipient domains: klyronstudio.com
│   └── plugins           # enabled plugin list
├── plugins/
│   └── klyron_deliver.js # custom plugin: calls lib/mail-server/deliver.ts
└── package.json          # haraka + mailparser
```

Haraka lives in `haraka/` at the repo root, separate from the Next.js app but in the same git repo.

`deploy/ecosystem.config.cjs` gets a second entry:
```js
{
  name: "klyron-mail",
  script: "node_modules/.bin/haraka",
  args: "-c haraka",
  instances: 1,          // must be 1 — same constraint as Next.js
  cwd: "/var/www/klyron-crm"
}
```

---

## 10. Security Considerations

- **Recipient validation** — Haraka rejects `RCPT TO` for any address that has no `Mailbox` row. Unknown addresses get a hard 550 bounce, not silently dropped.
- **Rate limiting** — Haraka's `rate_limit` plugin caps inbound connections per IP to block spam floods.
- **HTML sanitization** — inbound `bodyHtml` is sanitized before rendering in the UI (DOMPurify client-side or `sanitize-html` server-side) to prevent XSS from malicious senders.
- **Attachment scanning** — out of scope for Phase 9; add ClamAV later if needed.
- **TLS** — port 587 requires STARTTLS. Port 25 uses opportunistic TLS. Same Let's Encrypt cert as Nginx.
- **Auth for submission** — port 587 requires SMTP AUTH (username = mailbox address, password = the user's CRM session token or a dedicated app password). Team members send via the UI, not a raw SMTP client, so the CRM handles auth transparently.

---

## 11. What This Is NOT (Scope Boundaries)

- No shared inboxes (`hello@`, `billing@`) — private inboxes only for Phase 9
- No calendar invites / `.ics` handling
- No email templates builder (invoices/proposals already have their own send flow via nodemailer)
- No spam filtering beyond basic rate limiting (add rspamd later if needed)
- No mobile push notifications
- No import of existing email history from Gmail/Zoho
- Client portal does **not** get a mail inbox — clients communicate via chat

---

## 12. Implementation Order

When ready to build, work in this order:

1. **DNS + Haraka basics** — get a raw SMTP server receiving mail on the VPS, no DB yet
2. **DB migration** — add the four models
3. **`lib/mail-server/`** — deliver, thread, link, notify
4. **`klyron_deliver` Haraka plugin** — wire Haraka → lib
5. **Mailbox provisioning** — auto-create `Mailbox` row when a team member is added
6. **Outbound sending** — `outbound.ts` + compose UI
7. **`/mail` inbox UI** — three-panel layout, read/reply/archive/trash
8. **Lead/Client Emails tab** — linked thread view
9. **Notifications + SSE badge**
10. **Deliverability audit** — test SPF/DKIM/DMARC with mail-tester.com before going live

Each step is independently testable before moving to the next.

---

## 13. Open Questions (Decide Before Building)

- **Storage quota per mailbox?** Emails + attachments can grow fast. Define a per-user limit (e.g. 5 GB) or rely on VPS disk size.
- **Retention policy?** Auto-delete trash after 30 days? Archive emails older than 1 year?
- **SMTP AUTH mechanism for port 587?** CRM-managed app passwords vs. reusing session tokens. App passwords are safer (can be rotated without logging out).
- **Groq model for Groq?** Later: AI email draft assist — same Groq key already in the project.
