# Klyron Studio CRM

An internal CRM for **Klyron Studio** — a design & development agency. The team runs the whole business from it: leads → clients → projects → chat & calls → files → proposals & invoices. Clients get their own **portal** to track projects, message the studio, share files, and pay invoices.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Features](#features)
- [User Roles](#user-roles)
- [Routes](#routes)
- [Deployment](#deployment)
- [Known Limitations](#known-limitations)

---

## Tech Stack

| Area | Choice |
|---|---|
| Framework | Next.js 16.3.8 (App Router, Turbopack, Server Actions) |
| UI | React 19, Tailwind v4, shadcn Base UI, lucide icons |
| Database | MySQL / MariaDB + Prisma 7.10.0 |
| Auth | Custom — Argon2id, DB sessions, rate limiting, lockout |
| Realtime | Built-in Server-Sent Events (`/api/events`) |
| Files | Local disk, `sharp` WebP thumbnails, Range requests |
| Email | nodemailer over SMTP |
| Video calls | Self-hosted LiveKit |
| AI | Groq API — meeting notes + `@Klyron AI` in chat |
| Hosting | VPS, PM2 + Nginx (no Docker) |

**Key architectural decisions:**
- `proxy.ts` replaces Next.js middleware for auth + request context
- Single app process required — SSE bus and scheduler are in-memory
- Money is always `Decimal(12,2)`, calculated in integer cents
- Fractional float positions for leads and tasks (only the moved item updates on drag)
- One unified `Event` table powers the audit log and every activity timeline
- Prisma client generated to `lib/generated/prisma` (not the default location)

---

## Project Structure

```
klyron-crm/
├── app/
│   ├── (crm)/              # Team-facing app (dashboard, leads, clients, projects…)
│   ├── (canvas)/           # Full-screen whiteboard editor
│   ├── (public)/           # Public invoice & proposal pages (no login)
│   ├── portal/             # Client portal
│   ├── login/              # Auth pages
│   ├── forgot-password/
│   ├── reset-password/
│   ├── change-password/
│   └── api/                # SSE, file uploads, call tokens, LiveKit webhook
├── components/             # Feature UI components
├── hooks/                  # useVoiceRecorder, useSpeechTranscription, useMobile, useFileMeta
├── lib/
│   ├── actions/            # Server actions (mutations)
│   ├── ai/                 # Groq rate limiting
│   ├── auth/               # Session, password, permissions, rate limit, tokens
│   ├── calls/              # LiveKit lifecycle, AI meeting notes
│   ├── chat/               # Messaging, @mentions, Groq AI replies
│   ├── files/              # Storage, upload, access
│   ├── finance/            # Invoices, proposals, math, delivery
│   ├── leads/              # Pipeline queries, AI scoring (future)
│   ├── projects/           # Project queries, AI summaries (future)
│   ├── realtime/           # SSE bus + event type definitions
│   ├── whiteboard/         # Document model, geometry, atomic operations
│   ├── mcp/                # MCP server (Phase 7, stub)
│   ├── generated/prisma/   # Auto-generated Prisma client (do not edit)
│   ├── db.ts               # Prisma singleton
│   ├── audit.ts            # logEvent()
│   ├── scheduler.ts        # Background jobs
│   ├── mail.ts             # SMTP helpers
│   ├── money.ts            # Currency utilities
│   ├── format.ts           # Dates, currency, names (timezone-aware)
│   └── notifications.ts    # In-app + email alerts
├── prisma/
│   ├── schema.prisma       # Full data model (36 models, 22 enums)
│   ├── seed.ts             # Creates Owner, default stages & services
│   └── migrations/         # Migration history
├── prisma.config.ts        # Prisma CLI config (loads .env / .env.local)
├── instrumentation.ts      # Next.js hook → starts scheduler
├── proxy.ts                # Auth + request context (replaces middleware)
├── CONTEXT.md              # Full project context (read this when working on the codebase)
└── deploy/                 # PM2, Nginx, LiveKit example configs
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

Open [http://localhost:3000](http://localhost:3000) and sign in with the email + password from `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` in your `.env`.

> **Note:** `npm run dev` starts both LiveKit and Next.js. Press Ctrl+C to stop both. Use `npm run dev:next` to run Next.js alone (no video calls).

**Other scripts:**

| Script | What it does |
|---|---|
| `npm run build` | Production build |
| `npm start` | Start the production server |
| `npm run db:migrate` | Apply migrations (dev — creates shadow DB) |
| `npm run db:deploy` | Apply migrations (production — no shadow DB) |
| `npm run db:seed` | Seed Owner + defaults |
| `npm run db:seed -- --reset-password` | Reset Owner password to `SUPERADMIN_PASSWORD` |
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |
| `npm run lint` | Run ESLint |

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
| Video | `LIVEKIT_API_KEY` | `devkey` in dev |
| Video | `LIVEKIT_API_SECRET` | `secret` in dev |
| AI | `GROQ_API_KEY` | From [console.groq.com](https://console.groq.com) |
| AI | `GROQ_MODEL` | e.g. `openai/gpt-oss-120b` — check Groq dashboard if AI stops working |

> Without SMTP configured, emails print to the server log in dev — that's fine for local work.

---

## Database

**Schema:** `prisma/schema.prisma` — 36 models, 22 enums, MySQL/MariaDB.

All table names are lowercase (`@@map`) for cross-platform compatibility (XAMPP on Windows is case-insensitive; Linux isn't).

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
| `Project` | Deliverable for a client (with milestones + tasks) |
| `Channel` | Chat room (TEAM / CLIENT / DIRECT / GROUP) |
| `Message` | Chat message (supports @mentions, files, voice notes) |
| `StoredFile` | Uploaded file on disk |
| `Notification` | In-app + email alert |
| `Proposal` | Quote sent to a lead or client |
| `Invoice` | Bill sent to a client |
| `Payment` | Partial or full payment recorded against an invoice |
| `Expense` | Cost logged against a client or project |
| `Call` | Live video call with LiveKit |
| `TranscriptSegment` | Finalized phrase from a speaker |
| `Whiteboard` | Persistent visual board (Phase 8) |

**Migrations history:**

| Migration | What it added |
|---|---|
| `init` | Auth, org, pipeline, leads, clients |
| `projects` | Projects, milestones, tasks |
| `chat_files_notifications` | Channels, messages, files, notifications |
| `finance` | Proposals, invoices, payments, expenses |
| `calls` | Calls, participants, transcript segments |
| `chat_groups_voice_ai` | Private groups, voice notes, waveform, AI flag |
| `company_files` | Company vault, folders, restricted flag |
| `mcp_token` | MCP bearer token on OrgSettings |
| `whiteboards` | Whiteboard model |
| `whiteboard_versions` | Version history |
| `whiteboard_collaboration` | Members + comments |

---

## Features

### Phase 0 — Foundation
Auth (login, forgot/reset password, forced password change, sessions, lockout), roles & permissions matrix (editable at runtime), audit log, org settings, theme & design system.

### Phase 1 — Leads & Team
- **Pipeline** board + list view, drag-and-drop stages (fractional positions)
- **Stages** and **Services** catalog managed in Settings
- Lead notes, follow-up reminders, lost reasons
- Convert won lead → client
- **Team management**: create members with email + password, set roles, disable, reset password

### Phase 2 — Clients, Projects & Portal
- Clients with contacts, owner, notes, activity timeline
- **Portal accounts** per client (separate login, limited view)
- **Projects** with milestones, task board (status / priority / assignee / due date), team members
- **Client portal** (`/portal`): project progress, chat, files, billing

### Phase 3 — Communication
- **Chat**: team channels, one chat per client, direct messages, private groups
- Live via SSE — typing indicators, unread badges, edit/delete messages, load history
- **@ mentions**: people, files, and `@Klyron AI`; mentioned people always get notified
- **Klyron AI in chat**: replies using last 40 messages + text of mentioned files (team only, 6 req/person/min)
- **Voice messages**: hold-to-record or tap for hands-free; waveform visualizer; WhatsApp-style player (seek, 1×/1.5×/2×)
- **Files** (`/files`): client files + company document vault; optional folders; Restricted flag (Owner/Admin only); previewer for images, video, audio, PDF, CSV, JSON, code
- **Notifications**: in-app bell (live) + email

### Phase 4 — Finance
- **Finance overview**: revenue, expenses, outstanding, overdue, 12-month chart, top clients
- **Invoices**: line items from service catalog, discount + tax, record partial/full payments, send by email, void, auto payment reminders
- **Proposals**: for leads or clients; recipient accepts/declines online; convert accepted proposal → invoice
- **Expenses** with categories, linked to client/project
- Public no-login pages for invoices (`/i/[token]`) and proposals (`/p/[token]`) — printable / Save as PDF
- **Settings → Billing**: address, payment instructions, default tax, terms, number prefixes, auto-reminders

### Phase 5 — Video Calls with AI Notes
- "Call" button in every conversation (team, groups, DMs, client chat)
- Self-hosted LiveKit; join tokens valid 10 minutes, one room per conversation
- **Live transcription** in each person's browser (Chrome/Edge; per-person opt-out; supports Urdu/Arabic)
- Live captions visible to all participants
- **AI meeting notes** (Groq) after the call: summary, decisions, action items — editable and regeneratable
- **Calls page** (`/calls`) with history; call card in chat shows Join → Notes flow

### Phase 8 — Whiteboards (In Progress)
Persistent visual boards with an infinite SVG canvas, pan/zoom, shapes, connectors, text, sticky notes, selection, drag, colors, keyboard shortcuts, undo/redo, autosave, and collaboration.

### Background Scheduler
Runs via `instrumentation.ts` → `lib/scheduler.ts`:
- Follow-up reminders (notify assignee at due time)
- Overdue invoice payment reminders (automatic weekly ×3)
- Empty call cleanup
- Orphan upload cleanup
- Pending meeting notes generation

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

### Team (`/`)
| Route | Page |
|---|---|
| `/` | Dashboard |
| `/leads` | Pipeline board + list |
| `/leads/[id]` | Lead detail |
| `/clients` | Client list |
| `/clients/[id]` | Client detail |
| `/projects` | Project list |
| `/projects/[id]` | Project board |
| `/chat` | Channel browser |
| `/chat/[channelId]` | Conversation |
| `/calls` | Call history |
| `/calls/[id]` | Call detail + notes |
| `/files` | File browser (client files + company vault) |
| `/finance` | Finance overview |
| `/finance/invoices` | Invoice list |
| `/finance/proposals` | Proposal list |
| `/finance/expenses` | Expenses |
| `/team` | Team directory |
| `/settings` | Org settings, pipeline, services, billing, team, permissions, security, audit, MCP |
| `/whiteboard` | Whiteboard list |
| `/whiteboard/[id]` | Whiteboard editor (full-screen) |

### Client Portal (`/portal`)
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
| `/i/[token]` | Invoice view / pay |
| `/p/[token]` | Proposal view / accept / decline |
| `/login` | Sign in |
| `/forgot-password` | Request password reset |
| `/reset-password/[token]` | Set new password |

### API
| Route | Purpose |
|---|---|
| `GET /api/events` | SSE stream (chat, notifications, realtime) |
| `POST /api/files` | Upload file |
| `GET /api/files/[id]` | Download / metadata / thumbnail |
| `DELETE /api/files/[id]` | Delete file |
| `GET /api/calls/[id]/token` | Generate LiveKit join token |
| `POST /api/calls/[id]/transcript` | Submit transcript segment |
| `POST /api/livekit/webhook` | LiveKit room events |

---

## Deployment

**Requirements:** VPS with Node.js 20+, MySQL/MariaDB, PM2, Nginx, and a separate LiveKit instance.

```bash
# On the server
npm ci --omit=dev
npm run build
npm run db:deploy     # production migrations (no shadow DB needed)
npm run db:seed       # first deploy only
pm2 start deploy/ecosystem.config.cjs
```

**Important:** Run **exactly one PM2 instance** — the SSE bus and scheduler live in-process and are not shared across processes.

Config references in `deploy/`:
- `ecosystem.config.cjs` — PM2 config (one instance, env vars)
- `nginx.example.conf` — TLS, SSE location, upload limits, X-Accel-Redirect, LiveKit proxy
- `livekit.example.yaml` — LiveKit config (open UDP 50000–60000 and TCP 7881, set webhook to `/api/livekit/webhook`)

**Production checklist:**
- [ ] Set `NGINX_ACCEL_REDIRECT=1` for fast file serving via Nginx
- [ ] Set a real absolute `UPLOAD_DIR` path
- [ ] Configure SMTP for emails
- [ ] Set real LiveKit URL + keys
- [ ] Set `APP_URL` to your public domain
- [ ] Fill Settings → Billing before sending invoices
- [ ] Add prices in Settings → Services
- [ ] Change the super admin password (Settings → Security)

---

## Known Limitations

- **Live transcription** only works in Chrome and Edge (Safari/Firefox users can join calls, just not be transcribed)
- **Single process** required — cannot run multiple PM2 instances or use edge runtime
- `npm audit` warnings come from dev tooling (Prisma CLI, ESLint, shadcn CLI), not runtime dependencies
- **Groq model names change** — if AI features stop working with "model not found", update `GROQ_MODEL` in `.env` (current available models: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`)
- Meeting notes and transcripts are visible to clients on calls in their own chat — this is intentional but can be changed

---

## Roadmap

- **Phase 6** — AI layer: lead scoring, project summaries, risk spotting, workspace Q&A, proposal drafting
- **Phase 7** — MCP server: `POST /api/mcp` with read/write tools for external AI agents
- **Phase 8** — Whiteboards (in progress)
- LeadForge import
- Two-factor authentication (2FA)
