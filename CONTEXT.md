# Klyron Studio CRM — Project Context

The single place to understand what this project is, how it's built, what's done, and what's left.
Last updated: 2026-10-08.

---

## 1. What this is

An internal CRM for **Klyron Studio** (a design & development studio). The team uses it to run
the whole business: leads → clients → projects → chat & calls → files → proposals & invoices.
Clients get their own **portal** to see their projects, message the studio, share files, pay
invoices and accept proposals.

- **Look & feel:** white theme, crimson `#DC143C` used sparingly, Inter Tight (headings), Inter
  (body), Cormorant Garamond (editorial moments), the Klyron logo. No dark mode. shadcn tokens.
- **Users:** Owner, Admin, Member (the team) and Client (portal accounts). The super admin
  (Owner) is created from `.env`.

---

## 2. Tech stack & key decisions

| Area | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.3.8** (App Router, Turbopack) | `proxy.ts` replaces middleware. Read `node_modules/next/dist/docs/` before using new APIs (see `AGENTS.md`). |
| UI | Tailwind v4, shadcn **base-vega** (Base UI), lucide icons | Base UI uses the `render` prop; a `Button` rendering a `Link` needs `nativeButton={false}`. |
| Database | **MySQL/MariaDB** (XAMPP locally) + **Prisma 7.10.0** (pinned) | `@prisma/adapter-mariadb`, client generated to `lib/generated/prisma`. Every table has a lowercase `@@map` name (XAMPP is case-insensitive, Linux isn't). |
| Auth | Custom: Argon2id (`@node-rs/argon2`), DB sessions (token hash), rate limiting, lockout, forced password change | No third-party auth. |
| Realtime | Built-in **Server-Sent Events** (`/api/events`) with an in-process bus | Requires a **single app process** (PM2 fork, 1 instance). |
| Files | Local disk (`UPLOAD_DIR`), streamed uploads, `sharp` WebP thumbnails, Range requests | Optional Nginx `X-Accel-Redirect` for fast serving. |
| Email | **nodemailer** over SMTP | Without SMTP settings, emails print to the server log in dev. |
| Video | **Self-hosted LiveKit** | Dev binary is auto-downloaded by `npm run dev`. |
| AI | **Groq** (`groq-sdk`), model `openai/gpt-oss-120b` | Meeting notes + "@Klyron AI" in chat. |
| Hosting | VPS, **no Docker**; PM2 + Nginx | Configs in `deploy/`. |
| Time zone | `NEXT_PUBLIC_APP_TIME_ZONE` (default `Asia/Karachi`) | Calendar dates are passed as `YYYY-MM-DD` strings. |

**Conventions worth knowing**
- One **event log** (`event` table) powers the audit log and every activity timeline. Every mutation calls `logEvent`.
- Permissions: per-role module access (`lib/auth/permissions.ts`), editable by the Owner in Settings → Permissions. Optional "Members see only assigned work".
- Forms: server actions return `FormState` and echo values back (React 19 resets forms after actions).
- Money is `Decimal(12,2)` and always calculated in integer cents (`lib/finance/math.ts`). Totals are per currency; never converted.
- Ask before adding new dependencies.

---

## 3. Running it

```bash
npm install
npm run db:migrate      # apply migrations (first time / after pulling)
npm run db:seed         # creates the Owner from .env, default stages & services
npm run dev             # starts LiveKit (video) + Next.js together
```

- `npm run dev` downloads the LiveKit server into `.livekit/` on first run (checksum-verified), then starts it with Next.js; Ctrl+C stops both. `npm run dev:next` runs Next.js alone.
- MySQL must be running (XAMPP Control Panel; tick "run as service" so it starts with Windows).
- Other scripts: `build`, `start`, `lint`, `db:deploy` (production migrations), `db:generate`, `db:studio`.
- Break-glass: `npm run db:seed -- --reset-password` resets the Owner's password to `SUPERADMIN_PASSWORD`.

### Environment variables (`.env`, see `.env.example`)
| Group | Variables |
|---|---|
| Database | `DATABASE_URL`, `SHADOW_DATABASE_URL` |
| Super admin | `SUPERADMIN_NAME`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` |
| App | `APP_URL`, `NEXT_PUBLIC_APP_TIME_ZONE` |
| Files | `UPLOAD_DIR`, `MAX_UPLOAD_MB`, `NGINX_ACCEL_REDIRECT` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` |
| Video | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (dev: `ws://localhost:7880`, `devkey`/`secret`) |
| AI | `GROQ_API_KEY`, `GROQ_MODEL` (optional `GROQ_CHAT_MODEL` for chat only) |

### Deployment (VPS)
- `deploy/ecosystem.config.cjs`: PM2, **exactly one instance** (SSE + scheduler live in-process).
- `deploy/nginx.example.conf`: TLS, SSE location, upload limits, `X-Accel-Redirect` file serving, LiveKit proxy.
- `deploy/livekit.example.yaml`: LiveKit config. Open UDP 50000–60000 and TCP 7881. Set the webhook URL to `/api/livekit/webhook`.
- Production: set `NGINX_ACCEL_REDIRECT=1`, a real `UPLOAD_DIR`, real LiveKit keys, SMTP and `APP_URL`.

---

## 4. What's built

### Phase 0 — Foundation
Theme & design system (UI kit page at `/ui-kit`), auth (login, forgot/reset password, forced
password change, sessions, lockout), roles & permissions, audit log, org settings, Prisma/MySQL.

### Phase 1 — Leads & Team
- Leads pipeline (board + list), stages (Settings → Pipeline), services catalog, lead notes,
  follow-up reminders, lost reasons, convert won lead → client.
- Team: Owners/Admins **create team members** with email + password (they sign in on the normal
  login page); roles, disable, reset password.

### Phase 2 — Clients, Projects, Client portal
- Clients with contacts, owner, notes, activity; **portal accounts** per client.
- Projects with milestones, task board (status/priority/assignee/due), members, activity.
- Portal (`/portal`): the client's projects and progress (no internal briefs or overdue counts).

### Phase 3 — Communication
- **Chat** (`/chat`): team channels (#General + more), one chat per client (shared with their portal),
  direct messages, **private groups** (see below). Live via SSE, typing indicators, unread badges,
  edit/delete, load history.
- **Files** (`/files`): see "Company document vault" below; client files with share-with-client.
- **Notifications**: in-app bell (live) + email (always, or only when offline).
- **Scheduler** (`instrumentation.ts` → `lib/scheduler.ts`): follow-up reminders, orphan-upload cleanup,
  overdue-invoice reminders, empty-call cleanup, pending meeting notes.

### Phase 4 — Finance (`/finance`)
- Overview: collected this month, net after expenses, outstanding, overdue, proposals out,
  12-month revenue vs expenses chart, overdue list, top clients.
- **Invoices**: line items (from services), discount, tax, live totals; send by email / mark sent,
  record payments (partial/full), void, delete drafts, payment reminders (manual + automatic weekly ×3).
- **Proposals**: for leads or clients; recipient accepts/declines online by typing their name;
  convert accepted proposal → invoice; move a lead's proposal to its new client.
- **Expenses** with categories, linked to client/project; monthly filters.
- Public secret-link pages `/i/<token>` (invoice) and `/p/<token>` (proposal), printable / Save as PDF.
- Portal **Billing** tab; Billing card on client and lead pages.
- Settings → **Billing** (address, payment instructions, tax, terms, number prefixes, auto reminders);
  service prices in Settings → Services.

### Phase 5 — Video calls with AI meeting notes
- "Call" button in every conversation (team, groups, DMs, client chat, portal). One live call per conversation.
- Self-hosted LiveKit; join tokens (10 min, one room) only for people who can see the conversation.
- Custom clean call UI: video grid / screen-share layout, mic/camera/share/captions/leave controls,
  "End call for everyone" (starter, Owner, Admin). Camera/mic blocked → you stay in the call with a notice.
- **Live transcription in each person's browser** (Chrome/Edge; per-person opt-out; languages incl. Urdu/Arabic),
  live captions for everyone, transcript saved.
- **AI meeting notes** (Groq) after the call: summary, decisions, action items; editable; regenerate.
- **Calls** page (`/calls`) with history; call card in chat (Join → Notes).
- Empty calls end automatically (scheduler, or instantly via LiveKit webhook).

### Chat & files upgrades (after Phase 5)
- **@ mentions**: type `@` for people, files and **Klyron AI**. Highlighted while typing, chips in
  messages; mentioned people are always notified (email when away).
  Stored in the message as tokens: `@[Name](user:id)`, `@[file.pdf](file:id)`, `@[Klyron AI](ai)` (`lib/chat/mentions.ts`).
- **Klyron AI in chat**: replies in the thread using the last 40 messages + text of mentioned files;
  team only; 6 questions/person/minute; robot avatar + "Assistant" badge.
- **Voice messages**: crimson mic button — **hold** to talk (release sends, slide left cancels) or
  **tap** for hands-free (Delete / Send); live frequency visualizer; WhatsApp-style player
  (waveform seek, 1×/1.5×/2×). Up to 15 min.
- **Private groups**: named groups with chosen members; creator/Owner/Admin manage members, rename, delete; anyone can leave.
- **File previewer** (`components/files/file-preview.tsx`): images, video, audio, PDF, CSV/TSV (as a table),
  JSON (formatted), text/code; everything else → download. Used in chat attachments, tagged files and Files.
  Preview images can't be dragged or selected.
- **Tagged files** render as cards under the message, plus a type-coloured inline chip.
- **Company document vault** (Files → Company): simple upload (add files, name them; uploader recorded),
  optional folders, **Restricted** (Owners & Admins only), move/edit, preview. Clients never see it;
  restricted files can't be @mentioned. Files → Clients keeps client files.
- Unread chat badge fix (stale "+1" after opening a chat).

### Main routes
- Team: `/` dashboard, `/leads`, `/clients`, `/projects`, `/finance` (+ invoices, proposals, expenses), `/chat`, `/calls`, `/files`, `/team`, `/settings` (general, pipeline, services, billing, team, permissions, security, audit).
- Portal: `/portal`, `/portal/projects/[id]`, `/portal/chat`, `/portal/files`, `/portal/billing`, `/portal/calls/[id]`.
- Public: `/i/[token]`, `/p/[token]`, `/login`, `/forgot-password`, `/reset-password/[token]`.
- API: `/api/events` (SSE), `/api/files` (+ `[id]`, `?meta=1`, `?thumb=1`, `?download=1`), `/api/calls/[id]/token`, `/api/calls/[id]/transcript`, `/api/livekit/webhook`.

### Database
Migrations in `prisma/migrations/`: `init`, `projects`, `chat_files_notifications`, `finance`, `calls`,
`chat_groups_voice_ai`, `company_files`. Key models: User, Session, RolePermission, Event, OrgSettings,
PipelineStage, Service, Lead, Client, Project, Milestone, Task, Channel (TEAM/CLIENT/DIRECT/GROUP),
Message, StoredFile, Notification, Proposal, Invoice, Payment, Expense, Call, CallParticipant, TranscriptSegment.

---

## 5. Remaining work

### Phase 6 — AI layer (next)
Bring Klyron AI into the rest of the CRM:
- Leads: lead scoring, drafting follow-ups.
- Projects: status summaries, risk spotting.
- Finance: proposal drafting, late-payment prediction.
- Workspace-wide questions ("what's overdue this week?").

### Phase 7 — MCP server
- Stateless HTTP MCP endpoint at `POST /api/mcp`, authenticated with a bearer token generated in Settings → MCP.
- Read tools: `crm_overview`, `search_leads`, `list_projects`, `list_invoices`.
- Write tools: `add_lead_note`, `create_project_task`; both validate input and write to the audit log as `MCP`.
- Whiteboard tools: `whiteboard_capabilities`, `list_whiteboards`, `get_whiteboard`, `create_whiteboard`,
  and atomic `edit_whiteboard` operations. Agents receive explicit supported/unsupported capabilities,
  use semantic object operations instead of raw JSON, and must provide the latest board version to avoid overwrites.
- Configure an MCP client with the endpoint and one-time token shown in Settings → MCP. Keep the token server-side and rotate it if exposed.

### Phase 8 — In progress
- **Whiteboard** (`/whiteboard`): persistent visual boards with an infinite-feeling SVG canvas, pan/zoom,
  shapes, connectors, text, sticky notes, selection/dragging, colors, keyboard shortcuts, undo/redo and autosave.
- Import leads from LeadForge.
- Two-factor sign-in (2FA).

---

## 6. Open items & notes

### Security
- ⚠️ **Change the super admin password.** It was in `.env.example` in the first commit (repo is private).
  `.env.example` now holds a placeholder, but the old value is still in git history.
  Change it in the app (Settings → Security), then update `SUPERADMIN_PASSWORD` in `.env`.

### Needs a real-device check (couldn't be tested in the automated browser)
- A **two-person video call** with live captions and AI notes.
- **Voice messages** with a real microphone (tested with a simulated mic).

### Setup still to do
- **SMTP**: `SMTP_*` in `.env` is empty, so emails only print to the server log.
  Gmail/Workspace: `smtp.gmail.com`, port 465, App Password. Zoho: `smtp.zoho.com`, 465.
- **Before sending real invoices**: fill Settings → Billing (address, payment details) and add prices in Settings → Services.
- **Restart the dev server** so new scheduled jobs (automatic overdue reminders, empty-call cleanup) start; they haven't been observed running yet.
- **Groq model**: Groq retires models; if AI stops working with "model not found", change `GROQ_MODEL`.
  Models available on the current key include `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`, `whisper-large-v3`.

### Optional ideas raised
- Transcribe voice messages to text automatically (Groq Whisper is available on the key).
- Keep meeting notes/transcripts **team-only** (clients currently see notes for calls in their own chat).

### Known limitations
- Live transcription only works in Chrome/Edge (Safari/Firefox users can join calls, just not be transcribed).
- Single app process required (SSE bus + scheduler are in-memory).
- `npm audit` warnings come from dev tooling (Prisma CLI, ESLint, shadcn CLI), not runtime dependencies.
