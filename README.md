# ⚡ Personal CRM — BiTsCol Workspace

A fully client-side Personal CRM built with **React 19 + Vite 6 + Tailwind CSS 4**.
No backend required — all data lives in `localStorage` (key `pcrm-v1`) and is seeded with a realistic 24-contact Dhaka-based demo dataset on first run.

**Cross-cutting features:** 📱 installable PWA with true-offline shell (manifest + service worker precache — verified to reload with the network cut) · 🌗 dark↔light theme toggle (Topbar, persisted, flash-free boot) · ⬇ one-click CSV export on every data screen (Excel-ready BOM, RFC-4180 quoting) · ⌘K global search with **matched-via facets** (interests, company, introducer) · ⚡ global Quick Capture FAB.

**People graph fields:** every contact carries `introducedBy` ("met through" — clickable in the drawer, with reverse "introduced you to" links) and `interests[]` (inline-editable topic chips, instantly searchable).

---

## Quick start

```bash
npm install          # install dependencies
npm run dev          # dev server → http://localhost:5173
npm run build        # production build → dist/ (single-file via viteSingleFile)
```

**Zero-install option:** open `../personal-crm-standalone.html` in any browser —
it's the entire app inlined into one file (HashRouter, works over `file://`).

## PWA / offline install

`npm run build` emits `dist/` with `manifest.webmanifest`, `sw.js` and `public/icons/*`.
Serve `dist/` over HTTP(S) (e.g. `npx vite preview`) and the app becomes installable:
Chrome/Edge show an install prompt (also surfaced as a Topbar **Install** button via
`beforeinstallprompt`); on iOS use Share → Add to Home Screen. The service worker
precaches the single-file shell, so once visited, **the app loads fully offline**.

---

## Feature map

| Area | Route | Highlights |
|---|---|---|
| Dashboard | `/` | Customizable widget grid (add/remove/reorder/hide, persisted), growth sparkline, task kanban mini, stay-in-touch, sync health, birthdays, top tags, overdue countdown, 12-week activity heatmap |
| Contacts | `/contacts` | Search/filter (incl. interests & socials), star, drawer with anniversaries, gift ideas, **social profile chips** (LinkedIn/X/IG/FB/WhatsApp/web, add/remove inline), interests editor, introducer hop-links, **direct-action row**: Call (`tel:`), WhatsApp (`wa.me`), Gmail compose, share/download the contact as a real `.vcf` card |
| Tasks | `/tasks` | Advanced kanban: search, priority filters, sorts, hide-done; cards show description, tags, priority, avatars, **subtask progress bars**; **click any card for the detail view** — inline edit of every field, checklist subtasks, description, tags, activity trail, duplicate & delete |
| Notes | `/notes` | Pinned notes, contact links, editor panel |
| Email | `/email` | **Live Gmail** (reuses the Google token, `gmail.readonly` scope) or demo mailbox: scanning, contact matching, triage → lead capture, one-click touchpoint logging |
| Calendar | `/calendar` | Month grid with drag-to-move events + tasks, birthdays inline, **.ics export of the whole book**, every event gets zero-auth **Add to Google Calendar** template links |
| Birthdays & Occasions | `/birthdays` | Auto "Wish X 🎂" task rule ≤7 days out, month strip, anniversaries, gift-idea autosave |
| Follow-Ups | `/follow-ups` | Cadence engine per relationship type, snooze, "log contact" |
| Inbox | `/notifications` | Notification center: tasks/follow-ups/birthdays/events/system, read/snooze/dismiss, per-category prefs, sidebar badge |
| Groups | `/groups` | Colored relationship groups |
| Network | `/graph` | Force-style relationship map, connector finders |
| Analytics | `/analytics` | 3/6/12-month window: contacts-added bars, task-completion gauge + turn-around, most-contacted ranking, tag donut, weekly rhythm, network composition, auto-generated insights |
| Tags | `/tags` | Tag manager: merge, bulk-assign, usage counts |
| Import | `/import` | vCard/CSV paste → diff preview → commit |
| History | `/history` | Full import batches with per-record diffs and one-click **rollback** |
| **Integrations** | `/integrations` | Connection board (LIVE/DEMO/OFF per pipe) + four real bridges below |
| Settings | `/settings` | **Google Workspace hub** — Calendar sync, People (contacts) import, Drive backup; CardDAV; rules; audit log; demo reset |

## Google Workspace connection

Settings → **Google Workspace**. Two modes:
- **Demo (default):** simulated syncs (sample events/contacts, JSON backup download + file restore).
- **Live:** paste your own **Google OAuth Client ID** (console.cloud.google.com → APIs → enable *Calendar API*, *People API*, *Drive API* → Credentials → OAuth client (Web) → add this origin). The app then runs **browser-side OAuth** (Google Identity Services, no server/secret) with scopes `calendar.readonly`, `contacts.readonly`, `gmail.readonly`, `drive.file` — tokens stay in memory only for the session.
  - *Calendar* — imports primary-calendar events (±30/60 days), dedupes by title+date, links contacts by name.
  - *People* — imports contacts through the dedupe/diff/**rollback** pipeline (source `google-contacts`).
  - *Drive* — creates/updates `personal-crm-backup.json` (drive.file scope = app-created files only) and restores from it.
## Third-party bridges (no server, no secrets)

Everything works from the pure browser client — no API key needed except optional Google:

| Bridge | How it works | Where |
|---|---|---|
| **Outbound webhooks** | Paste any Zapier/Make/n8n catch-hook; the app POSTs `{source, event, ts, data}` on *lead added*, *contact added*, *task completed*, *touch logged*. Sent as a CORS-simple request — real HTTP status when the hook allows it, “delivered (unverified)” otherwise. Test-ping button + 20-entry delivery log. | `/integrations` |
| **Phone / address book (.vcf)** | Export the whole CRM (or a single contact) as vCard 3.0; import any `.vcf` (iCloud/Google/phone export) through the same dedupe/diff/rollback pipeline as CSV paste. | `/integrations`, contact drawer |
| **Calendar (.ics + template links)** | One-click `.ics` of all events (imports into Apple/Outlook/Google/CalDAV). Every event also gets a prefilled `calendar.google.com/render` link — zero auth, works in any account. | `/calendar`, event detail |
| **Deep actions** | `tel:` dialer, `wa.me` chat, Gmail compose URL, and Web-Share-API card sharing with download fallback. | contact drawer |
| **Live Gmail** | When a Google Client ID is configured, “Connect Gmail” pulls the last 21 days of mail (From/Subject/Snippet) via the Gmail API — same token path as Calendar/People/Drive. | `/email` |

| **Quick Capture** | FAB (everywhere) | Mobile-first bottom sheet: one-tap lead (name+number), voice-to-text capture with smart parsing (lead/task/note) + simulator fallback, bulk paste via the import pipeline (rollback-able) |
| Global search | `⌘K` | Palette over contacts/tasks/notes/events/tags with deep links |

## Project structure

```
personal-crm/
├── src/
│   ├── main.jsx            # HashRouter bootstrap
│   ├── App.jsx             # routes + global overlays
│   ├── store.jsx           # single context store (all actions, audit, toasts)
│   ├── lib.js              # date/format helpers
│   ├── index.css           # Tailwind 4 + design tokens
│   ├── data/seed.js        # demo dataset (contacts, tasks, events, imports…)
│   ├── components/         # Sidebar, Topbar, GlobalSearch, QuickCapture,
│   │                       # dashboardWidgets, ui primitives
│   └── pages/              # 16 route screens
├── vite.config.js          # react + @tailwindcss/vite + viteSingleFile
└── package.json
```

## Notes

- `jsdom` / `playwright` in devDependencies are headless-verification tooling only; the app itself is runtime-clean.
- Reset demo data any time from **Settings → Reset demo data**.
- Dark theme only, by design (design tokens in `index.css`).
