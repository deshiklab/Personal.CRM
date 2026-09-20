# ⚡ Personal CRM

A complete, offline-first **personal relationship manager** — contacts, kanban tasks, calendar, notes, groups, analytics, and **real third-party bridges** (webhooks, vCard, ICS, Gmail) — in a single React app that **runs with zero backend**.

- **Try instantly:** download [`demo-standalone.html`](demo-standalone.html) → double-click → the whole app runs from one file. No install, no server.
- **Live demo:** https://deshiklab.github.io/Personal.CRM/ *(once Pages is enabled — 2 clicks, see [Deployment](#-deployment))*
- **Run the source:** `npm install && npm run dev` → http://localhost:5173

All data lives in your browser's `localStorage` — nothing ever leaves your machine unless you explicitly wire up a bridge.

---

## ✅ What's inside (17 screens)

| Area | Route | What you get |
|---|---|---|
| Dashboard | `/#/` | Drag-reorderable widget grid (persisted): KPIs, growth sparkline, tasks kanban mini, stay-in-touch queue, sync health, birthdays, tag cloud, overdue countdown, 12-week heatmap |
| Contacts | `/#/contacts` | Full-data table, multi-filter (group/tags/search/starred/interests/socials), sortable columns; **drawer** with anniversaries, gift ideas, interests, introducer hop-links, **social profile chips** (LinkedIn/X/IG/FB/WhatsApp/site), and the **Reach-out row**: Call `tel:`, WhatsApp `wa.me`, Gmail compose, **Share card** (real `.vcf`) |
| Tasks | `/#/tasks` | Kanban with search, priority filters, sorts, hide-done; cards show descriptions, tags, subtask progress bars; click a card → **detail modal**: inline edit everything, checklist subtasks, duplicate, delete, activity trail |
| Email | `/#/email` | **Live Gmail only** (your OAuth Client ID, read-only): inbox scanning, contact matching, triage → lead capture, one-click touchpoint logging. No fake mailboxes |
| Calendar | `/#/calendar` | Month/week/day grids, drag-to-move events, birthdays inline, **`.ics` export**, every event gets a zero-auth **“Add to Google Calendar”** link |
| Birthdays | `/#/birthdays` | Auto “Wish 🎂” task rule ≤7 days out, month strip, anniversaries, gift ideas |
| Follow-Ups | `/#/follow-ups` | Cadence engine per relationship type (client/lead/friend/mentor…), snooze, quick "log contact" |
| Notifications | `/#/notifications` | Unified inbox — tasks, follow-ups, birthdays, events, system — with per-category preferences |
| Groups | `/#/groups` | Color-coded relationship groups |
| Network | `/#/graph` | Drag nudge relationship map with connector finding ("who links X and Y") |
| Analytics | `/#/analytics` | 3/6/12-month windows: acquisition bars, completion gauge + turnaround, most-contacted ranking, tag donut, weekly rhythm, auto-insights |
| Tags | `/#/tags` | Manager: merge, bulk-assign, usage counts |
| Import | `/#/import` | **vCard/CSV paste → dedupe → diff preview → commit → rollback**, everything auditable |
| History | `/#/history` | Every import/sync batch with per-record diffs and **one-click rollback** |
| Integrations | `/#/integrations` | Connection board + the four third-party bridges below + **read-only ICS calendar-feed subscriptions** (public Google/iCloud feeds, optional opt-in relay) |
| Settings | `/#/settings` | **Google Workspace hub** (Calendar/People/Drive/Gmail, live-only with guided setup), CardDAV, automation rules, audit log, sample reset |
| Quick Capture | FAB (everywhere) | One-tap lead, voice-note parsing, bulk paste via import pipeline |
| Global Search | `⌘K` | Command palette over contacts/tasks/notes/events/tags |

---

## 🔌 Third-party bridges (real, tested)

Everything works from a pure browser client — **no API key needed except optional Google**:

### 1. Outbound webhooks → Zapier / Make / n8n
`/integrations`: paste any catch-hook URL, arm events (**lead added**, **contact added**, **task completed**, **touch logged**), hit **Send test ping**. The app POSTs a clean JSON payload:

```json
{ "source": "personal-crm", "event": "contact", "ts": "2026-09-20T10:15:00.000Z",
  "data": { "name": "…", "email": "…", "phone": "…" } }
```

- Sent as a CORS-simple request (`text/plain`) — you get the real HTTP status when the hook allows it, otherwise *“delivered (unverified)”* (the hook still receives it).
- 20-entry delivery log with per-attempt status.
- Verified end-to-end against live hook receivers.

### 2. vCard (.vcf) both ways
- **Export all contacts** or **share one card** (native share sheet on phone, download on desktop) as vCard 3.0.
- **Import any `.vcf`** — iCloud/Google Contacts/phone exports flow through the same dedupe → diff → rollback pipeline as CSV paste.

### 3. Calendar bridges
- **`.ics` export** of the whole event book → Apple Calendar, Outlook, Google (Settings → Import), CalDAV clients.
- Per-event **prefilled Google Calendar template links** (`calendar.google.com/render`) — zero auth, any account.

### 4. Deep actions (zero setup)
Every contact: `tel:` dialer, `wa.me` chat (no API), Gmail compose URL, Web Share of the vCard.

### 5. Live Gmail
With a Google Client ID saved: **Connect Gmail** in `/email` pulls the last 21 days (sender, subject, snippet) via the Gmail API — reusing the Google Workspace token.

---

## 📱 Android app (fully local + Google only)

The entire CRM ships as a native Android app via **Capacitor** — the same React codebase runs in a
system WebView with native Google Sign-In.

**What it does:** everything works 100% offline-first (all data lives locally on the phone).
The ONLY network calls are to Google: **Drive backup/restore** (app-owned file, `drive.file`
scope), **Calendar** and **Contacts** import (read-only). No servers, no tracking.

| Step | Detail |
|---|---|
| 1 · Get the APK | Easiest: GitHub → **Actions → Build Android APK → Run workflow** → download the `personal-crm-android-debug` artifact. Or locally: `npm install && npm run android:sync && npm run android:open` (Android Studio) → ▶ Run |
| 2 · Google setup | Follow the SAME in-app guide (**Settings → Google hub**) — on Android it adds one step: create an **Android OAuth client** with package `com.bitscol.personalcrm` + this SHA-1 (the repo's shared debug keystore): `DE:E4:74:EA:F9:4A:35:E7:16:16:95:48:1F:88:0B:39:F0:B2:B0:2E` |
| 3 · Install & connect | Allow “install unknown apps” on the phone → Settings → Google hub → paste your Web Client ID → **Connect** → the native Google account picker appears |
| Release signing | Add repo secrets `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` → the same workflow also emits a signed **release APK** |

Why native sign-in? Google **blocks OAuth inside WebViews**, so the APK uses `@capgo/capacitor-social-login`
(native Google Sign-In SDK); the web build keeps using Google Identity Services. One Web OAuth Client ID serves both.

## 🔑 Google Workspace: live-only, guided setup

Google connections are **100% live — zero simulators**. Because live mode needs *your* OAuth Client ID (no app can legitimately ship Google credentials), the app ships with a built-in setup wizard instead of fake syncs. ~5 minutes to unlock:

1. [console.cloud.google.com](https://console.cloud.google.com) → **New project** (any name)
2. **APIs & Services → Library** → enable: *Google Calendar API*, *People API*, *Google Drive API*, *Gmail API*
3. **OAuth consent screen** → External → app name → your email → Save; leave in **Testing**
4. **Test users** → add your Gmail *(required, or you get `access_denied`)*
5. **Credentials → Create OAuth client ID → Web application** → *Authorized JavaScript origins*: add your app origin (e.g. `http://localhost:5173`, or your hosting URL `https://yourname.github.io`), create, copy the `…apps.googleusercontent.com` ID
6. In the app: **Settings → Google Workspace hub → "Google OAuth Client ID"** → Save → Connect live. Expect Google's *"App isn't verified"* screen → **Advanced → Continue** (normal for Testing mode).

Tokens are requested in-browser and held **in memory only** (never persisted, never sent anywhere else). Scopes: `calendar.readonly`, `contacts.readonly`, `gmail.readonly`, `drive.file`.

| Service | What live mode does |
|---|---|
| Calendar | Imports primary-calendar events (±30/60d), dedupes by title+date, links contacts by name |
| People | Imports contacts through the dedupe/diff/rollback pipeline (source `google-contacts`) |
| Drive | Creates/updates `personal-crm-backup.json` (app-created files only) + restore |
| Gmail | Pulls recent threads for touchpoint scanning & lead triage |

---

## 🧭 User guide (the 60-second tour)

1. **Add your first real lead** — Quick Capture (FAB bottom-right, or `C` wherever you are)
2. **Search anything** — `⌘K` (contacts, tasks, notes, events, tags)
3. **Stay warm with people** — Follow-Ups tells you who goes cold next; log contact with one click and the cadence resets
4. **Brain-dump contacts at scale** — Import page: paste vCards or CSV rows from anywhere (phone export, LinkedIn, spreadsheet) → review the diff → commit → instant rollback if wrong
5. **Wire your automations** — Integrations page: paste a Zapier catch-hook → things you do in the CRM start appearing in your other apps
6. **Get your phone's contacts in** — export `.vcf` from your phone/icloud → Import page
7. **Backups** — Integrations → export `.vcf`; or live Google Drive backup in Settings

Reset everything to the fresh sample state: **Settings → Reset to sample dataset**.

---

## 🚀 Deployment

### Easiest (recommended): GitHub Pages
1. Make the repo **public** *(Settings → General → Danger Zone)*
2. **Settings → Pages** → Source: *Deploy from a branch* → `gh-pages` · `/ (root)` → Save
3. Live at `https://<you>.github.io/Personal.CRM/` in ~60s

The `gh-pages` branch already contains the single-file build (CI-free). Rebuild after edits: `npm run build && cp dist/index.html index.html` on that branch.

### Alternative hosts
- **Netlify Drop:** [app.netlify.com/drop](https://app.netlify.com/drop) → drag the repo's `crm-deploy.zip` (or the `dist/` folder)
- **Vercel / Cloudflare Pages:** New project → import this repo (build command `npm run build`, output `dist`)
- **Local static serve:** `python3 -m http.server --directory dist` after `npm run build`

---

## 🛠️ Development

```bash
npm install          # deps
npm run dev          # dev server (vite, hot reload) :5173
npm run build        # production → dist/index.html (single-file, all inlined)
node verify-integrations.mjs   # Playwright suite: 23 checks incl. REAL webhook delivery
```

**Stack:** React 18 • Vite 6 • Tailwind 4 • lucide-react • HashRouter (file:// deploys "just work") • zero secrets in repo • PWA manifest + offline cache.

```
src/
├── App.jsx, main.jsx, store.jsx     # router, context store (all domain logic)
├── components/                      # Sidebar, Topbar, GlobalSearch, QuickCapture, ui kit, dashboard widgets
├── pages/                           # the 17 screens above
├── lib/                             # google.js (GIS OAuth + APIs), vcard.js, ics.js, csv.js
└── data/seed.js                     # realistic fictional sample dataset
```

The production build inlines everything into one HTML file via `vite-plugin-singlefile` — that's why `demo-standalone.html` runs offline with zero assets.

---

## 🧪 Backups & data model

- **Storage:** browser `localStorage` (key `pcrm-state-v1`) — survives restarts, per-origin
- **Exports:** CSV (contacts/tasks/events), `.vcf` (contacts), `.ics` (events), JSON backup files
- **Restore:** import pipeline / Google Drive restore / sample reset
- **Privacy:** no analytics, no telemetry, no third-party calls except bridges you explicitly configure

---

## 🙋 FAQ

**Why does Google say SETUP NEEDED?** Live Google connections need an OAuth Client ID that belongs to your Google Cloud account — legitimately impossible to bake into an app. Follow the [setup above](#-google-workspace-live-only-guided-setup).

**Do I need to keep my computer on for webhooks?** The webhook fires when *you do something in the app* — it POSTs from your browser tab, not from any server. No always-on backend needed.

**Why HashRouter (`/#/...` URLs)?** Makes the app bulletproof on any static host or `file://` — no server-side rewrite rules needed.

**Data safety?** Nothing leaves localStorage unless you wire a bridge (or allow the opt-in public-feed relay for ICS subscriptions); Rollback button on every import; one-key sample reset.

---

Built for **BiTsCol**. MIT-style do-what-you-want — it's a personal tool, make it yours.
