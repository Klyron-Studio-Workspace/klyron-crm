# Klyron Studio CRM

An all-in-one internal CRM for **Klyron Studio**, a design & development agency. The team runs the whole business from one app: **leads → clients → projects → chat, calls & email → files & whiteboards → proposals & invoices**, with **Klyron AI** built into every step. Clients get their own **portal** to track projects, message the studio, join calls, share files, accept proposals, and pay invoices.

Self-hosted on a single VPS. No Docker, no third-party auth, no SaaS dependencies except the Groq AI API.

---

## Table of Contents

- [Highlights](#highlights)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Features](#features)
- [User Roles](#user-roles)
- [Routes](#routes)
- [MCP Server](#mcp-server)
- [Deployment](#deployment)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)

---

## Highlights

- **Sales pipeline** — drag-and-drop Kanban, follow-up reminders, AI lead scoring & follow-up drafts
- **Projects** — milestones, task boards, AI health check (On track / At risk / Blocked) with risks & actions
- **Chat** — team channels, client chats, DMs, private groups, voice notes, @mentions, `@Klyron AI`
- **Video calls** — self-hosted LiveKit, live captions (incl. Urdu/Arabic), AI meeting notes
- **Built-in email** — every team member gets an `@klyronstudio.com` inbox; mail auto-links to leads & clients
- **Finance** — proposals (AI-drafted), invoices, partial payments, expenses, auto reminders, public pay/accept links
- **Whiteboards** — infinite canvas with live multiplayer cursors, comments, version history, templates
- **Client portal** — clients see their projects, chat, files, calls, and billing
- **MCP server** — external AI agents can read the CRM and edit whiteboards through a token-secured endpoint
- **Security** — Argon2id, DB sessions, rate limiting, lockout, editable role × module permissions, full audit log

---

## Tech Stack

| Area | Choice |
|---|---|
| Framework | Next.js 16.3.8 (App Router, Turbopack, Server Actions) |
| UI | React 19, Tailwind v4, shadcn (Base UI), lucide icons |
| Database | MySQL / MariaDB + Prisma 7.10.0 (`@prisma/adapter-mariadb`) |
| Auth | Custom — Argon2id, DB sessions, rate limiting, lockout |
| Realtime | Built-in Server-Sent Events (`/api/events`) with an in-process bus |
| Files | Local disk, `sharp` WebP thumbnails, Range requests, optional Nginx X-Accel-Redirect |
| System email | nodemailer over SMTP (invoices, proposals, reminders, password resets) |
| Team mailboxes | Haraka SMTP server (separate PM2 process) + `mailparser`, `sanitize-html` |
| Video calls | Self-hosted LiveKit |
| AI | Groq API (`openai/gpt-oss-120b` by default) |
| Validation | zod |
| Hosting | VPS, PM2 + Nginx (no Docker) |

**Key architectural decisions:**
- `proxy.ts` replaces Next.js middleware for auth + request context
- Single app process required — SSE bus and scheduler are in-memory
- Money is always `Decimal(12,2)`, calculated in integer cents; totals per currency, never converted
- Fractional float positions for leads and tasks (only the moved item updates on drag)
- One unified `Event` table powers the audit log and every activity timeline
- Prisma client generated to `lib/generated/prisma` (not the default location)
- Every table has a lowercase `@@map` name (XAMPP on Windows is case-insensitive; Linux isn't)

**Design language:** white theme, crimson `#DC143C` used sparingly, Inter Tight (headings), Inter (body), Cormorant Garamond (editorial moments). Live UI kit at `/ui-kit`.

---

## Project Structure

```
klyron-crm/
├── app/
│   ├── (crm)/              # Team app (dashboard, leads, clients, projects, finance, chat, calls, mail, files, team, settings)
│   ├── (canvas)/           # Full-screen whiteboard editor
│   ├── (public)/           # Public invoice & proposal pages (no login)
│   ├── portal/             # Client portal
│   ├── login/ forgot-password/ reset-password/ change-password/
│   └── api/                # SSE, files, call tokens & transcripts, LiveKit webhook, MCP
├── components/             # Feature UI (leads, projects, chat, calls, mail, finance, files, layout, ui…)
├── hooks/                  # useVoiceRecorder, useSpeechTranscription, useMobile, useFileMeta
├── lib/
│   ├── actions/            # Server actions (mutations)
│   ├── ai/                 # Groq rate limiting
│   ├── auth/               # Session, password, permissions, rate limit, tokens
│   ├── calls/              # LiveKit lifecycle, AI meeting notes
│   ├── chat/               # Messaging, @mentions, Klyron AI replies
│   ├── files/              # Storage, upload, access
│   ├── finance/            # Invoices, proposals, math, delivery, AI proposal drafting
│   ├── leads/              # Pipeline queries, AI lead insights
│   ├── projects/           # Project queries, AI project insights
│   ├── mail-server/        # Mailboxes, inbound delivery, threading, lead/client linking, outbound
│   ├── realtime/           # SSE bus + event type definitions
│   ├── whiteboard/         # Document model, geometry, atomic operations
│   ├── mcp/                # MCP server (tools for external AI agents)
│   ├── generated/prisma/   # Auto-generated Prisma client (do not edit)
│   ├── db.ts  audit.ts  scheduler.ts  mail.ts  money.ts  format.ts  notifications.ts  navigation.ts
├── haraka/                 # Haraka SMTP server: config + klyron_deliver plugin (own package.json)
├── prisma/
│   ├── schema.prisma       # Full data model (40 models, 22 enums)
│   ├── seed.ts             # Creates Owner, default stages & services
│   └── migrations/
├── scripts/dev.mjs         # Starts LiveKit + Next.js together in dev
├── deploy/                 # PM2, Nginx, LiveKit example configs
├── docs/                   # Design specs, implementation plans, promo video brief
├── prisma.config.ts        # Prisma CLI config (loads .env / .env.local)
├── instrumentation.ts      # Next.js hook → starts scheduler
├── proxy.ts                # Auth + request context (replaces middleware)
├── CONTEXT.md              # Full project context for contributors
└── WHITEBOARD_ROADMAP.md   # Whiteboard feature checklist
```

---

## Getting Started

**Prerequisites:** Node.js 20+, MySQL or MariaDB running locally (XAMPP on Windows: start MySQL from the Control Panel, tick "run as service").

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in DATABASE_URL, SHADOW_DATABASE_URL, SUPERADMIN_* — see below

# 3. Create tables
npm run db:migrate

# 4. Seed the database (creates the Owner account + default pipeline stages & services)
npm run db:seed

# 5. Start dev server (downloads LiveKit binary on first run, then starts both)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` from your `.env`.

> `npm run dev` starts both LiveKit and Next.js; Ctrl+C stops both. Use `npm run dev:next` to run Next.js alone (no video calls).

**Team mailboxes (optional in dev):** the Haraka server has its own dependencies.

```bash
cd haraka && npm install && cd ..
haraka/node_modules/.bin/haraka -c haraka
```

It listens on ports 25 / 587 and needs DNS (MX, SPF, DKIM, DMARC, PTR) to receive real mail — see [Deployment](#deployment).

**Scripts:**

| Script | What it does |
|---|---|
| `npm run dev` | LiveKit + Next.js dev server |
| `npm run dev:next` | Next.js only |
| `npm run build` | Production build |
| `npm start` | Start the production server |
| `npm test` | Unit tests (AI result parsing, whiteboard document/geometry/operations) |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Apply migrations (dev — uses shadow DB) |
| `npm run db:deploy` | Apply migrations (production — no shadow DB) |
| `npm run db:seed` | Seed Owner + defaults |
| `npm run db:seed -- --reset-password` | Reset Owner password to `SUPERADMIN_PASSWORD` |
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |
| `npm run backup` | Dump the database + archive uploads to `BACKUP_DIR` (default `storage/backups`), keep `BACKUP_KEEP_DAYS` (14) |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Group | Variable | Description |
|---|---|---|
| Database | `DATABASE_URL` | `mysql://user:pass@localhost:3306/klyron_crm` |
| Database | `SHADOW_DATABASE_URL` | Same format, different DB name — used by `migrate dev` only |
| Super admin | `SUPERADMIN_NAME` | Owner's display name |
| Super admin | `SUPERADMIN_EMAIL` | Owner's login email |
| Super admin | `SUPERADMIN_PASSWORD` | Owner's initial password |
| App | `APP_URL` | Public base URL (`http://localhost:3000` in dev) |
| App | `NEXT_PUBLIC_APP_TIME_ZONE` | IANA timezone (default: `Asia/Karachi`) |
| App | `DISABLE_SCHEDULER` | Set to `1` to skip background jobs |
| Files | `UPLOAD_DIR` | Absolute path for uploads (defaults to `./storage/uploads`) |
| Files | `MAX_UPLOAD_MB` | Max file size in MB (default: `500`) |
| Files | `NGINX_ACCEL_REDIRECT` | Set to `1` on VPS to serve files via Nginx X-Accel-Redirect |
| Email | `SMTP_HOST` | e.g. `smtp.gmail.com` or `smtp.zoho.com` |
| Email | `SMTP_PORT` | `465` for SSL |
| Email | `SMTP_SECURE` | `true` for SSL |
| Email | `SMTP_USER` | SMTP username / email |
| Email | `SMTP_PASSWORD` | SMTP password or App Password |
| Email | `MAIL_FROM` | Sender name + address |
| Video | `LIVEKIT_URL` | `ws://localhost:7880` in dev, `wss://…` in prod |
| Video | `LIVEKIT_HTTP_URL` | Optional; defaults to `LIVEKIT_URL` with `ws` → `http` |
| Video | `LIVEKIT_API_KEY` | `devkey` in dev |
| Video | `LIVEKIT_API_SECRET` | `secret` in dev |
| AI | `GROQ_API_KEY` | From [console.groq.com](https://console.groq.com) |
| AI | `GROQ_MODEL` | e.g. `openai/gpt-oss-120b` |
| AI | `GROQ_CHAT_MODEL` | Optional model override for `@Klyron AI` in chat only |

> Without SMTP configured, emails print to the server log in dev — fine for local work.
> The Haraka plugin reads `DATABASE_URL` from the same `.env` / `.env.local`.

---

## Database

**Schema:** `prisma/schema.prisma` — 40 models, 22 enums, MySQL/MariaDB.

**Core models:**

| Model | Purpose |
|---|---|
| `User` | Team member or client account |
| `Session` | Active login sessions (token stored as SHA-256 hash) |
| `OrgSettings` | Single-row org config (billing, timezone, MCP token) |
| `RolePermission` | Runtime permission overrides per role + module |
| `Event` | Unified audit log — every mutation calls `logEvent()` |
| `PipelineStage` | Kanban columns (OPEN / WON / LOST) |
| `Service` | Service catalog — linked to leads, proposals, invoices |
| `Lead` | Prospect in the pipeline |
| `Client` | Won lead converted to an ongoing relationship |
| `Project` / `Milestone` / `Task` | Client deliverables |
| `Channel` / `Message` | Chat rooms (TEAM / CLIENT / DIRECT / GROUP) and messages (mentions, files, voice) |
| `StoredFile` | Uploaded file on disk |
| `Notification` | In-app + email alert |
| `Proposal` / `Invoice` / `Payment` / `Expense` | Finance |
| `Call` / `CallParticipant` / `TranscriptSegment` | LiveKit calls and transcripts |
| `Whiteboard` / `WhiteboardMember` / `WhiteboardComment` / `WhiteboardVersion` | Boards, sharing, comments, history |
| `Mailbox` / `EmailThread` / `Email` / `EmailAttachment` | Team inboxes, threads linked to leads/clients |

**Migration history:** `init` → `projects` → `chat_files_notifications` → `finance` → `calls` → `chat_groups_voice_ai` → `company_files` → `mcp_token` → `whiteboards` → `whiteboard_versions` → `whiteboard_collaboration` → `email_server`.

---

## Features

### Phase 0 — Foundation
Auth (login, forgot/reset password, forced password change, sessions, lockout), roles & permissions matrix (editable at runtime), audit log, org settings, theme & design system (`/ui-kit`).

### Phase 1 — Leads & Team
- **Pipeline** board + list view, drag-and-drop stages (fractional positions)
- **Stages** and **Services** catalog managed in Settings
- Lead notes, follow-up reminders, lost reasons, convert won lead → client
- **Team management**: create members with email + password, set roles, disable, reset password

### Phase 2 — Clients, Projects & Portal
- Clients with contacts, owner, notes, activity timeline
- **Portal accounts** per client (separate login, limited view)
- **Projects** with milestones, task board (status / priority / assignee / due date), team members
- **Client portal** (`/portal`): project progress, chat, files, calls, billing

### Phase 3 — Communication
- **Chat**: team channels, one chat per client (shared with their portal), direct messages, private groups
- Live via SSE — typing indicators, unread badges, edit/delete, load history
- **@ mentions**: people, files, and `@Klyron AI`; mentioned people always get notified
- **Klyron AI in chat**: replies using the last 40 messages + text of mentioned files (team only, 6 req/person/min)
- **Voice messages**: hold-to-record or tap for hands-free; live visualizer; WhatsApp-style player (seek, 1×/1.5×/2×), up to 15 min
- **Files** (`/files`): client files + company document vault; folders; Restricted flag (Owner/Admin only); previewer for images, video, audio, PDF, CSV, JSON, code
- **Notifications**: in-app bell (live) + email

### Phase 4 — Finance
- **Overview**: collected this month, net after expenses, outstanding, overdue, 12-month revenue vs expenses chart, top clients
- **Invoices**: line items from service catalog, discount + tax, partial/full payments, send by email, void, auto payment reminders (weekly ×3)
- **Proposals**: for leads or clients; recipient accepts/declines online by typing their name; convert accepted proposal → invoice
- **Expenses** with categories, linked to client/project
- Public no-login pages for invoices (`/i/[token]`) and proposals (`/p/[token]`) — printable / Save as PDF
- **Settings → Billing**: address, payment instructions, default tax, terms, number prefixes, auto-reminders

### Phase 5 — Video Calls with AI Notes
- "Call" button in every conversation (team, groups, DMs, client chat, portal)
- Self-hosted LiveKit; join tokens valid 10 minutes, one room per conversation
- Custom call UI: video grid, screen share, captions, "End call for everyone"
- **Live transcription** in each person's browser (Chrome/Edge; per-person opt-out; Urdu/Arabic supported) with live captions for everyone
- **AI meeting notes** after the call: summary, decisions, action items — editable and regeneratable
- **Calls page** (`/calls`) with history; call card in chat shows Join → Notes

### Phase 6 — AI Layer
- **Lead insights**: 0–100 lead score with rationale, suggested next step, and a ready-to-send follow-up draft
- **Project insights**: status summary, health (On track / At risk / Blocked), risks each paired with an action
- **Proposal drafting**: AI writes the title, introduction, and terms from the lead/client history and selected services

### Phase 7 — MCP Server
Token-secured `POST /api/mcp` endpoint so external AI agents (Claude, etc.) can work with the CRM. See [MCP Server](#mcp-server).

### Phase 8 — Whiteboards
Infinite SVG canvas: shapes, connectors, text, sticky notes, resize/rotate, group, align & distribute, smart guides & snapping, lock/hide, layers, mini-map, pinch zoom. Autosave with retry, conflict recovery, version history. **Live collaboration** over SSE — presence avatars, remote cursors & selections, comments & mentions, per-board sharing. Favorites, search, thumbnails, templates.

### Phase 9 — Built-in Email
- Every team member gets a private `@klyronstudio.com` mailbox, provisioned automatically when they're created
- `/mail`: folders (Inbox, Sent, Drafts, Archive, Trash), threaded conversations, star, move, compose & reply
- Inbound mail is received by Haraka, parsed, threaded by subject/References, and **auto-linked to matching leads and clients**
- **Emails tab** on every lead and client page shows the full email history next to notes, calls, and chat
- Live "new mail" notification via SSE; HTML bodies sanitized before display

### Phase 10 — UX Polish & Live Notifications

#### Theme & Navigation
- **Light / dark theme switcher** in the topbar — persists across sessions
- **Ctrl+K quick navigation** — jump to any record or page without a mouse

#### Auth
- **Reveal-password toggle** on every `type="password"` field (login, forgot/reset password, change password) — eye/eye-off icon button built into `FormField`, no extra component

#### Finance — Invoice
- **Professional invoice redesign** — large serif "Invoice" heading, crimson rule, small-caps labels, zebra line items, dark `bg-foreground` total band, "Thank you!" sign-off
- **Signature pad** (`Settings → Billing`) — draw with mouse/trackpad (strokes → SVG paths) or type-to-sign with three cursive fonts (Dancing Script · Great Vibes · Pacifico); saved as SVG, printed on every invoice and proposal
- **PDF download button** on `/finance/invoices/[id]` — opens the public invoice in print view via `?pdf=1`, no server-side PDF library needed
- **Payment details label** clarified to "Payment details (IBAN / bank account)" with a placeholder showing the expected format; printed on every non-void invoice so clients know where to send payment
- **Public invoice background** fixed — always white/light even when the team's app is in dark mode (`.light` CSS class pins the palette; solid `bg-muted` instead of the semi-transparent `bg-muted/40` that let the dark `<html>` bleed through)

#### Live Notifications (SSE-powered)
- **Notification sound** — two-tone "ding" synthesized via Web Audio API (A5 → C#6, no audio file) plays on every new email (`mail.inbound`) and in-app notification
- **Browser push notifications** — `new Notification()` fires with sender name + subject/body; appears as a Windows/macOS system notification even when the CRM tab is in the background
- **Permission prompt** — the browser asks to allow notifications on the user's first click in the CRM or portal (browsers only allow the prompt, and audio, after a user gesture); no banner
- **Dynamic Island call notification** — when any call starts, a dark pill appears at top-center and morphs with a springy spring animation into an expanded card showing caller name, call title, a pulsing green phone icon, and **Dismiss / Join call** buttons; auto-dismisses after 30 s; works on both the CRM and the client portal; built on the existing `call.started` SSE notification — no server changes needed

### Background Scheduler
Runs via `instrumentation.ts` → `lib/scheduler.ts`: follow-up reminders, overdue invoice reminders (weekly ×3), empty call cleanup, orphan upload cleanup, pending meeting notes generation.

---

## User Roles

| Role | Description |
|---|---|
| **Owner** | Full access. Created from `.env` on first seed. Only one. |
| **Admin** | Same as Owner except cannot change Owner role or billing. |
| **Member** | Standard team member. Access per the permissions matrix. |
| **Client** | Portal only. Linked to a specific Client record. |

Permissions are per-role per-module (NONE / READ / WRITE), editable by the Owner in **Settings → Permissions**. Enable "Members see only assigned work" to restrict Members to their own leads, projects, and tasks.

---

## Routes

### Team
| Route | Page |
|---|---|
| `/` | Dashboard |
| `/leads`, `/leads/[id]` | Pipeline board + list, lead detail (AI insights, emails) |
| `/clients`, `/clients/[id]` | Client list, client detail (emails, billing) |
| `/projects`, `/projects/[id]` | Project list, project board (AI insights) |
| `/finance` | Finance overview |
| `/finance/invoices`, `/finance/proposals`, `/finance/expenses` | Finance documents |
| `/chat`, `/chat/[channelId]` | Channels and conversations |
| `/calls`, `/calls/[id]` | Call history, call detail + notes |
| `/mail` | Team mailbox |
| `/files` | File browser (client files + company vault) |
| `/whiteboard`, `/whiteboard/[id]` | Board list, full-screen editor |
| `/team` | Team directory |
| `/settings/*` | General, pipeline, services, billing, team, permissions, security, audit, MCP |
| `/ui-kit` | Design system reference |

### Client Portal
| Route | Page |
|---|---|
| `/portal` | Projects overview |
| `/portal/projects/[id]` | Project detail (read-only) |
| `/portal/chat` | Client ↔ team chat |
| `/portal/files` | Files shared by the team |
| `/portal/billing` | Invoices, proposals, payments |
| `/portal/calls/[id]` | Join call + view notes |

### Public (no login)
| Route | Page |
|---|---|
| `/i/[token]` | Invoice view |
| `/p/[token]` | Proposal view / accept / decline |
| `/login`, `/forgot-password`, `/reset-password/[token]` | Auth |

### API
| Route | Purpose |
|---|---|
| `GET /api/events` | SSE stream (chat, notifications, mail, whiteboards) |
| `POST /api/files` | Upload file |
| `GET / DELETE /api/files/[id]` | Download / metadata / thumbnail / delete |
| `GET /api/calls/[id]/token` | LiveKit join token |
| `POST /api/calls/[id]/transcript` | Submit transcript segment |
| `POST /api/livekit/webhook` | LiveKit room events |
| `POST /api/mcp` | MCP server (bearer token) |

---

## MCP Server

Generate a token in **Settings → MCP** (shown once; rotate if exposed) and point your MCP client at `POST {APP_URL}/api/mcp` with `Authorization: Bearer <token>`.

| Tool | Type | What it does |
|---|---|---|
| `crm_overview` | read | Open leads, active projects, overdue invoices, due follow-ups |
| `search_leads` | read | Search leads by contact or company |
| `list_projects` | read | Recent projects, optional status filter |
| `list_invoices` | read | Recent invoices with balances and due dates |
| `add_lead_note` | write | Add an internal note to a lead |
| `create_project_task` | write | Create a task in a project |
| `whiteboard_capabilities` | read | Object model, coordinates, supported operations |
| `list_whiteboards` / `get_whiteboard` | read | Find and read boards |
| `create_whiteboard` | write | Create an empty board |
| `edit_whiteboard` | write | Atomic add/update/delete of up to 100 objects (optimistic concurrency via `expectedUpdatedAt`) |

All writes validate input and are recorded in the audit log as `MCP`.

---

## Deployment

**Requirements:** VPS with Node.js 20+, MySQL/MariaDB, PM2, Nginx, LiveKit, and DNS control of the mail domain.

```bash
# On the server
npm ci --omit=dev
(cd haraka && npm ci)
npm run build
npm run db:deploy     # production migrations
npm run db:seed       # first deploy only
pm2 start deploy/ecosystem.config.cjs && pm2 save
```

`deploy/ecosystem.config.cjs` runs `klyron-crm` (Next.js), `klyron-mail` (Haraka) and `klyron-backup` (nightly backup). Run **exactly one instance** of `klyron-crm` — the SSE bus and scheduler live in-process.

Config references in `deploy/`:
- `nginx.example.conf` — TLS, SSE location, upload limits, X-Accel-Redirect, LiveKit proxy
- `livekit.example.yaml` — open UDP 50000–60000 and TCP 7881, set webhook to `/api/livekit/webhook`

**Mail DNS** (all required before sending real mail): `MX` → VPS IP, `SPF` (`v=spf1 ip4:<VPS_IP> ~all`), `DKIM` (TXT from Haraka key), `DMARC`, and `PTR` (`mail.klyronstudio.com` → VPS IP, set at the VPS provider). Open ports 25 and 587.

**Production checklist:**
- [ ] `NGINX_ACCEL_REDIRECT=1` and a real absolute `UPLOAD_DIR`
- [ ] Backups: `klyron-backup` (PM2) runs nightly at 03:00; set `BACKUP_DIR` and copy it off the server (e.g. `rclone` to cloud storage)
- [ ] SMTP configured for system emails
- [ ] Real LiveKit URL + keys
- [ ] `APP_URL` set to your public domain
- [ ] Mail DNS records in place
- [ ] Settings → Billing filled and prices added in Settings → Services
- [ ] Super admin password changed (Settings → Security)

---

## Known Limitations

- **Live transcription** only works in Chrome and Edge (others can join calls, just not be transcribed)
- **Single process** required — no multiple PM2 instances or edge runtime
- `npm audit` warnings come from dev tooling (Prisma CLI, ESLint, shadcn CLI), not runtime dependencies
- **Groq model names change** — if AI stops working with "model not found", update `GROQ_MODEL`
- Meeting notes and transcripts are visible to clients on calls in their own chat (intentional; can be changed)

---

## Roadmap

- Workspace-wide AI questions ("what's overdue this week?") and late-payment prediction
- Auto-transcribe voice messages (Groq Whisper)
- LeadForge import
- Two-factor authentication (2FA)
