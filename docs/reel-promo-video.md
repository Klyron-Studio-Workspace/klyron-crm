# Klyron CRM — Reel Promo Video Brief

Everything needed to script, record, edit, and post short-form promo videos (Instagram Reels, TikTok, YouTube Shorts, LinkedIn video) for **Klyron CRM**.

---

## 1. The product in one line

> **Klyron CRM — run your entire agency from one tab.**
> Leads, clients, projects, chat, video calls, email, whiteboards, and invoices — with AI built into every step.

**Alternate taglines**
- "Stop paying for 9 tools. Use one."
- "From first lead to final invoice — in one place."
- "Your agency's operating system."
- "The CRM that takes meeting notes for you."
- "Built by an agency, for agencies."

**Elevator pitch (≈20 s voiceover)**
Klyron CRM is the all-in-one workspace built by Klyron Studio to run a design & development agency. Track leads on a drag-and-drop pipeline, turn them into clients and projects, chat and video-call your team and clients, send email from your own inbox, sketch on live whiteboards, and send proposals and invoices — while Klyron AI scores your leads, flags at-risk projects, drafts proposals, and writes your meeting notes.

---

## 2. Who it's for

| Audience | Pain they feel | What to show them |
|---|---|---|
| Agency owners / founders | Paying for Slack + Zoom + HubSpot + Trello + Gmail + QuickBooks + Miro… and nothing talks to each other | The sidebar: everything in one app; finance overview |
| Freelancers & small studios (2–20 people) | Chasing clients for payments, losing leads in DMs | Pipeline drag-drop, auto payment reminders, client portal |
| Project managers | No idea which project is slipping | AI project health: On track / At risk / Blocked |
| Sales / account leads | Forgetting follow-ups, writing the same emails | AI lead score + one-click follow-up draft, reminders |
| Clients of the agency | "Where's my project? Where do I pay?" | The client portal |

**Tone:** confident, clean, premium, a little cheeky. Short sentences. No jargon ("SSE", "Prisma", "Argon2" never appear on screen).

---

## 3. Brand kit

| Element | Value |
|---|---|
| Name | **Klyron CRM** (by Klyron Studio) |
| Logo | `components/brand/klyron-mark.png` (also `klyron-mark.tsx`) |
| Primary color | Crimson **`#DC143C`** — use sparingly, for accents, highlights, CTAs |
| Crimson hover / strong | `#C41236` / `#B0102F` |
| Background | White `#FFFFFF` (the app is light-only — no dark mode) |
| Headings font | **Inter Tight** |
| Body font | **Inter** |
| Editorial / quote font | **Cormorant Garamond** (great for big italic hook text) |
| Icon style | lucide (thin line icons) |
| Website / domain | klyronstudio.com |

**Visual style for edits:** white canvas, lots of whitespace, crimson underline or pill behind one keyword per caption, smooth zoom-ins on the UI, soft drop shadows on floating app screenshots. Avoid neon, gradients, and glitch effects — they clash with the brand.

---

## 4. Feature catalog (what to film)

Each feature has a **hook line**, the **"money shot"** to screen-record, and the **route** in the app.

### Sales pipeline
- **Hook:** "Drag a lead. Close a deal."
- **Money shot:** dragging a lead card across Kanban columns to *Won*, then "Convert to client".
- **Route:** `/leads`
- Also: list view, follow-up reminders, lost reasons, service tags.

### AI lead scoring
- **Hook:** "Which lead should you call first? AI already knows."
- **Money shot:** opening a lead → AI card shows a score (e.g. **87/100**), reasons, next step, and a ready-to-send follow-up message.
- **Route:** `/leads/[id]`

### Clients & projects
- **Hook:** "Every client. Every project. One view."
- **Money shot:** client page → projects → task board with milestones; drag a task to Done.
- **Routes:** `/clients/[id]`, `/projects/[id]`

### AI project health
- **Hook:** "Know a project is slipping before your client does."
- **Money shot:** project AI card flips to **At risk** with a list of risks, each with a recommended action.
- **Route:** `/projects/[id]`

### Team & client chat
- **Hook:** "Slack? Never heard of her."
- **Money shot:** typing `@` → menu of people, files, and **Klyron AI**; a message with a file chip; typing indicator; unread badges.
- **Route:** `/chat`
- Also: private groups, DMs, one shared chat per client (they see it in their portal).

### @Klyron AI in chat
- **Hook:** "Your smartest teammate lives in the chat."
- **Money shot:** "@Klyron AI summarize this brief" with a PDF tagged → AI replies in thread.
- **Route:** `/chat/[channelId]`

### Voice notes
- **Hook:** "WhatsApp-style voice notes. For work."
- **Money shot:** hold the crimson mic, live waveform, release to send; playback at 2×.
- **Route:** any chat

### Video calls + AI meeting notes ⭐ (strongest feature)
- **Hook:** "Never take meeting notes again."
- **Money shot:** hit **Call** in a chat → video grid with live captions → end call → AI notes appear: summary, decisions, action items.
- **Routes:** call from `/chat`, notes at `/calls/[id]`
- Also: screen share, captions in Urdu/Arabic, clients join from their portal, no Zoom link needed.

### Built-in email
- **Hook:** "Your inbox now knows who your clients are."
- **Money shot:** new email arrives (live notification) → open it → it's automatically linked to the lead; open the lead → **Emails** tab shows the thread.
- **Routes:** `/mail`, Emails tab on `/leads/[id]` and `/clients/[id]`
- Every team member gets their own `@klyronstudio.com` address.

### Live whiteboards
- **Hook:** "Brainstorm together. In real time."
- **Money shot:** two cursors moving on a board, sticky notes popping in, connectors snapping, a comment with a mention.
- **Route:** `/whiteboard/[id]`
- Also: templates, version history, smart guides, mini-map.

### Files & company vault
- **Hook:** "Every file, previewed instantly."
- **Money shot:** clicking through image, video, PDF, CSV previews without downloading; a Restricted badge.
- **Route:** `/files`

### Proposals (AI-drafted)
- **Hook:** "Proposal written in 5 seconds."
- **Money shot:** new proposal → pick services → **Draft with Klyron AI** fills title, intro, terms → send. Then the client view: client types their name → **Accepted** → convert to invoice.
- **Routes:** `/finance/proposals/new`, public `/p/[token]`

### Invoices & payments
- **Hook:** "Get paid without the awkward follow-up."
- **Money shot:** invoice with line items and tax → send → record a partial payment → status updates; mention automatic weekly reminders.
- **Routes:** `/finance/invoices`, public `/i/[token]`

### Finance overview
- **Hook:** "Your agency's numbers, at a glance."
- **Money shot:** dashboard cards (collected this month, outstanding, overdue) + 12-month revenue vs. expenses chart.
- **Route:** `/finance`

### Client portal
- **Hook:** "Give clients a portal, not a headache."
- **Money shot:** log in as a client → project progress, chat with the studio, files, invoices, join a call.
- **Route:** `/portal`

### Security & control (for B2B / LinkedIn cuts)
- **Hook:** "Your data. Your server."
- **Money shot:** Settings → Permissions matrix toggles; Settings → Audit log scrolling.
- **Points:** self-hosted, role-based permissions, full audit trail, account lockout, encrypted passwords.

### AI agent ready (MCP) — for tech audiences
- **Hook:** "Your CRM talks to AI agents."
- **Money shot:** Settings → MCP token; an AI assistant asking "what invoices are overdue?" and drawing on a whiteboard.
- **Route:** `/settings/mcp`

---

## 5. Key numbers & proof points

Use these as on-screen stats (all true of the product):

- **9+ tools replaced:** CRM, chat, video calls, email, whiteboard, file storage, proposals, invoicing, client portal
- **1 tab** to run the whole agency
- **0** meeting notes typed by hand
- **4 AI features:** lead scoring, project health, proposal drafting, meeting notes (+ AI in chat)
- **3 automatic payment reminders** — weekly, hands-off
- Live captions in **multiple languages** including **Urdu and Arabic**
- **Self-hosted** — your data stays on your server

---

## 6. Ready-to-use scripts (9:16 vertical)

### A. 15-second teaser — "One tab"
| Time | Visual | On-screen text | VO |
|---|---|---|---|
| 0–2 s | Fast flash of 8 app logos stacking up, then shattering | "9 tools?" | "Still juggling nine tools?" |
| 2–4 s | Klyron logo on white, crimson accent | "Try one." | "Try one." |
| 4–11 s | Rapid 1-second cuts: pipeline drag → chat → call with captions → AI notes → whiteboard → invoice | (feature name pill on each) | "Leads, chat, calls, email, whiteboards, invoices…" |
| 11–13 s | AI notes card zooms in | "+ AI that does the boring parts" | "…with AI built in." |
| 13–15 s | Logo + CTA | "Klyron CRM — book a demo" | "Klyron CRM." |

### B. 30-second hero — "Never take meeting notes again"
| Time | Visual | On-screen text |
|---|---|---|
| 0–3 s | Person scribbling notes during a Zoom, looking stressed | "POV: you're on a client call taking notes" |
| 3–6 s | Cut to Klyron chat → click **Call** | "What if the CRM did it for you?" |
| 6–14 s | Video grid with live captions rolling | "Live captions. Any language." |
| 14–16 s | Click **Leave** | |
| 16–24 s | AI meeting notes appear: summary, decisions, action items | "Summary. Decisions. Action items. Done." |
| 24–27 s | Notes card sitting inside the client's chat | "Saved right in the conversation." |
| 27–30 s | Logo + CTA | "Klyron CRM — link in bio" |

### C. 30-second — "From lead to paid"
1. **0–3 s** Hook: "Watch a lead turn into money in 30 seconds."
2. **3–8 s** New lead on pipeline; AI score **87** appears.
3. **8–12 s** AI follow-up draft → sent.
4. **12–16 s** Drag to **Won** → Convert to client.
5. **16–21 s** Proposal → **Draft with Klyron AI** → client clicks **Accept**.
6. **21–26 s** Convert to invoice → payment recorded → **Paid** badge.
7. **26–30 s** "One app. Lead to paid." + logo + CTA.

### D. 60-second full tour — "A day in the agency"
- **0–4 s** Hook: "This is how we run our entire agency from one tab."
- **4–10 s** 9 AM — Dashboard + AI tells you which lead to call first.
- **10–18 s** 10 AM — Team chat, voice note, `@Klyron AI` summarizes a brief.
- **18–28 s** 11 AM — Client call with live captions → AI notes.
- **28–36 s** 1 PM — Whiteboard session, two live cursors.
- **36–42 s** 3 PM — Email from a client lands, auto-linked to their profile.
- **42–48 s** 4 PM — Project health flags **At risk** with fixes.
- **48–55 s** 5 PM — Invoice sent; client pays from their portal.
- **55–60 s** "Klyron CRM. Your agency's operating system." + CTA.

### E. Quick-hit series ideas (one feature per reel, 7–12 s each)
1. "Your inbox now knows who your clients are" (email auto-linking)
2. "Proposal written in 5 seconds" (AI proposal)
3. "Know a project is slipping before your client does" (AI health)
4. "Voice notes, but for work" (voice messages)
5. "Clients stop asking 'any update?'" (client portal)
6. "The invoice reminder you never have to send" (auto reminders)
7. "Brainstorm with your team, live" (whiteboard cursors)
8. "Rate my CRM setup" (fast scroll through the sidebar)

---

## 7. Hook bank (first 1–2 seconds)

- "Stop paying for 9 tools."
- "Never take meeting notes again."
- "This CRM writes your proposals."
- "POV: your CRM tells you which client to call first."
- "We replaced Slack, Zoom, and HubSpot with one app."
- "My clients haven't asked 'any update?' in months."
- "Your inbox should know who your clients are."
- "Built by an agency, because nothing else worked."
- "Watch a lead turn into money in 30 seconds."
- "The most underrated feature in our CRM 👇"

---

## 8. Calls to action

- "Book a demo — link in bio"
- "DM us 'KLYRON' for early access"
- "Follow for more agency systems"
- "Comment 'CRM' and we'll send you a walkthrough"
- LinkedIn: "Want to see it on your agency's workflow? Let's talk."

---

## 9. Captions & hashtags

**Caption template**
> Running an agency shouldn't need 9 subscriptions. 🧠
> Klyron CRM puts leads, projects, chat, calls, email, whiteboards and invoices in one tab — with AI that scores leads, flags risky projects, drafts proposals and writes your meeting notes.
> 👉 Book a demo — link in bio.

**Hashtags**
`#agencylife #crm #saas #productivity #aitools #smallbusiness #freelancer #designagency #webdevelopment #startup #projectmanagement #automation #founder #workflow #klyron`

---

## 10. Recording guide

**Setup**
- Record at **1080 × 1920** (9:16) or record desktop at 2560 × 1440 and crop/zoom in post. A 1440 px-wide browser window with zoom at 110–125% reads well on phones.
- Hide the browser bookmarks bar; use a clean Chrome profile; full-screen (F11).
- Turn off OS notifications. Use a smooth cursor (or a cursor-highlight tool).
- Record each feature as its own clip (5–15 s) so editors can remix.

**Demo data (very important)**
- Use a **separate demo database** — never real client names, emails, amounts, or chats.
- Seed believable fake data: 15–25 leads across stages (company names like "Northwind Studio", "Bluepeak Coffee", "Helio Fitness"), 5–8 clients, 4–6 projects with mixed health, 10+ invoices (some paid, some overdue), a few chats with avatars, a whiteboard with sticky notes.
- Pick round, readable amounts ($4,500, $12,000) and use one currency.
- Make sure an AI lead score is high (80+) and one project shows **At risk** for the money shots.
- For calls, record with two real people (two browsers / devices) in Chrome or Edge so live captions work.
- For the client portal, log in with a demo client account.

**Never show on screen**
- `.env` files, API keys, the MCP token, passwords, real email addresses, the terminal, or VS Code.

**Pacing**
- Hook in under 2 seconds. Change shot every 1–3 seconds. Each reel makes one point.
- Burn-in captions for every spoken line (most viewers watch muted).
- Zoom in (120–150%) on the exact UI element being talked about.

**Music & sound**
- Upbeat lo-fi / minimal electronic / modern corporate, 100–120 BPM; sync cuts to beats.
- Subtle UI SFX: soft click on drag-drop, "whoosh" on transitions, a "ding" when an invoice turns Paid.

---

## 11. Shot checklist

- [ ] Sidebar overview (all modules visible)
- [ ] Dashboard
- [ ] Pipeline drag to Won + Convert to client
- [ ] Lead AI card (score, reasons, follow-up draft)
- [ ] Project task board + AI health card (At risk)
- [ ] Chat: @mention menu, file chip, typing indicator
- [ ] @Klyron AI reply in chat
- [ ] Voice note record + 2× playback
- [ ] Start call from chat, video grid, live captions, screen share
- [ ] AI meeting notes after call
- [ ] Mail inbox, new-mail notification, Emails tab on a lead
- [ ] Whiteboard with two live cursors + comment
- [ ] File previews (image, video, PDF, CSV)
- [ ] Proposal "Draft with Klyron AI" + client accepting online
- [ ] Invoice send + partial payment + Paid badge
- [ ] Finance overview chart
- [ ] Client portal tour
- [ ] Settings → Permissions + Audit log
- [ ] Logo end card (white background, crimson accent)

---

## 12. Platform specs

| Platform | Ratio | Length sweet spot | Notes |
|---|---|---|---|
| Instagram Reels | 9:16, 1080×1920 | 15–30 s | Keep text inside the center 4:5 safe zone |
| TikTok | 9:16 | 15–45 s | Trend audio + bold first-frame text |
| YouTube Shorts | 9:16 | up to 60 s | Strong loop at the end |
| LinkedIn | 9:16 or 1:1 | 30–90 s | Lead with business value, security, ROI |
| X / Twitter | 16:9 or 1:1 | 15–45 s | Captions mandatory |

Keep the bottom ~20% and the right edge clear of text — platform UI (captions, buttons) covers them.
