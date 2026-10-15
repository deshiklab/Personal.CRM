# Personal CRM — Feature Update Plan (v0.2)

> Status: **NEARLY DONE** — WS-1…WS-8 ✅ (PWA hardened + share-target closed) · remaining: on-device QA matrix + extras X1–X8 on request
> Branch: `arena/8018c92d-personal-crm`
> Date: 2026-10-15

### Progress log
- **WS-1 Notes → Google Keep-class — DONE** (2026-10-15): checklists, 10-color palette, note labels + manager, archive & 30-day trash (restore/purge), masonry grid + list view, Keep-style quick-add (Enter / multi-line paste), per-note reminders (quick chips + datetime + daily/weekly/monthly repeat) wired into the Notification Center, markdown toolbar + preview, share / `.md` export / duplicate, contact links + merge-to-timeline preserved. New: `src/lib/markdown.js`, `src/lib/notes.js`, `src/components/NoteCard.jsx`, `src/components/NoteEditor.jsx`; test harness: `vitest` + `probe-notes.test.jsx` (14 tests) and `probe-notes.mjs` (playwright, for browser environments). Notes attachments intentionally deferred to WS-5 (file store).
- **WS-2 Phone Contacts import/export — DONE** (2026-10-15): `@capacitor-community/contacts@8` (read + write, `READ_CONTACTS`/`WRITE_CONTACTS` in the Android manifest), `src/lib/contacts.js` (pure mapping + **phone → email → name** normalized dedupe, now shared by the Import diff preview AND `commitImport`) and `src/lib/contacts-native.js` (capability detection + graceful fallbacks). Import page gains a "From your phone" card (native address book → same diff-preview → commit → rollback pipeline; Chrome contact picker on the web; honest hints when unavailable; `/import?phone=1` deep link). Contacts page gains "From phone" and **"Save to phone"** (per-contact drawer + bulk bar; native-only, vCard share remains the everywhere-path). Phone imports land as `acquaintance`, vcf/paste imports keep the `lead` default. Tests: `probe-contacts.test.jsx` (10 tests — caught a `setRaw()` undefined crash in the commit flow).
- **WS-3 Files/Documents + Nearby transfer, WS-4 outbound share — DONE** (2026-10-15): `src/lib/filestore.js` (IndexedDB on web / Capacitor Filesystem `PersonalCRM/files/` on Android / memory fallback — blobs never leave their device), `src/lib/hash.js` (SHA-256 with pure-JS fallback for non-secure contexts), `src/lib/nearby.js` (deflate+base64url pairing codes, 16 KB chunk protocol, SHA-verified reassembly, WebRTC DataChannel sessions with backpressure), `src/lib/share.js` (Web Share L2 with download fallback, `fetchRemoteFile` for link import). New **Files page** (`/#/files`): upload, add-from-link, folders/device/starred/search filters, rename, share, download, delete, per-device listing ("which device holds what"), CSV index export. **Nearby transfer modal**: QR + copyable pairing codes both directions, per-file progress, checksum verify, received files land under "Received". File index + device registry sync via the existing Gist/Drive channel (blobs stay local). Tests: `probe-files.test.jsx` (15 — filestore roundtrip, SHA vectors, signal roundtrip, source→sink transfer, checksum-drop, page flows). Deferred to later: QR *scanning* (manual paste works today), Gist-relay signaling for cross-network auto-pairing, note-attachment UI (store model already carries `attachments`).
- **WS-5 Reminders & notification bells/rings — DONE** (2026-10-16, commit `8d0439c`): real reminders that ring with sound + system notifications — Android fires even with the app closed (`@capacitor/local-notifications@8`), web uses the Notification API, both degrading gracefully. New: `src/lib/reminders.js` (pure engine — `makeReminder`, `minutesBefore` lead-times, calendar-clamped `nextOccurrence` (Jan 31 monthly → Feb 28), `isDue`/`collectDue` merging the reminders slice with `note.remindAt`, `afterFire` repeat-advance vs one-shot latch, `snoozePatch`, `dueSoonLabel`), `src/lib/sound.js` (WebAudio-synthesized bell/chime/classic/gentle/silent — no audio asset files), `src/lib/native-notify.js` (stable int32 notification ids, `scheduleNative`/`cancelNative` Android bridge, `notifyNow` web fallback, permission state/request), `src/components/ReminderHost.jsx` (firing engine — 20 s tick + tab-focus recheck; rings sound + vibrate + system notification; alert cards with 10m/1h/1d snooze, Done, Dismiss; repeats advance; note CTA completion clears `remindAt`), `src/components/RemindMeRow.jsx` (reusable attach row — 9:00 / 1h-before / 10-min-before quick chips + custom datetime + existing list). Attach points: task detail modal, event create (lead-time select) + event detail, contact drawer. Topbar bell (count badge + upcoming-5 dropdown + deep link). Notification Center: `remind` category, "New reminder" modal (title/note/when/repeat/sound), "Scheduled reminders" panel (upcoming + history, snooze/done/delete). Settings "Reminder bells & rings" card (sound + Test ring, volume, vibrate, default lead time, system-permission chip). AndroidManifest gains `POST_NOTIFICATIONS`/`VIBRATE`/`RECEIVE_BOOT_COMPLETED`/`WAKE_LOCK`. Tests: `probe-reminders.test.jsx` (14 — engine contracts, ring-overlay fire/done/snooze with no AudioContext/Notification, note nag + CTA clear, silent crashless, task chip, bell dropdown, new-reminder modal, settings prefs). Full suite 53/53; build 806.22 kB / gzip 231.62. Deferred to later: on-device Android scheduling/permission UX check (needs APK run — WS-8), notification-action snooze buttons (in-app snooze works), per-reminder skip/holiday rules.
- **WS-6 Knowledge Base (new module) — DONE** (2026-10-16, commit `669b208`): standalone wiki module at `/#/kb`. New: `src/lib/wiki.js` (pure engine — `parseWikiLinks`/`findArticleByTitle` (case-insensitive), `backlinksFor`/`outLinksFor` ("Mentioned in" / "See also"), `linkifyHtml` (XSS-safe [[link]] → anchors, unresolved links marked), `extractToc` + `anchorHeadings` (in-page TOC), `articlesForContact`, `KB_TEMPLATES` (meeting notes / person profile / project brief / book summary / decision log), `toMarkdownFile`, `childrenOf`/`descendantIds` tree helpers); `src/pages/KnowledgeBase.jsx` (KB home — stat strip, nested collection tree with add-sub/delete, live search, collection scoping incl. descendants via `?collection=`, article cards with favorites, Pinned / Recently-viewed / tag-cloud rails, template picker `?new=1`); `src/pages/ArticleEditor.jsx` (article page — rendered markdown + TOC rail, edit mode, front-matter strip: collection move / tags / linked contacts, favorite, .md export, share-to-clipboard, delete, backlink + see-also panels). Store: `kbArticles`/`kbCollections`/`kbViews` slices + full CRUD + `touchKbView`, wired into persist + buildBackup/restoreAll/blankState/snapshotCore/applySyncSnapshot (Gist/Drive sync carries KB). Sidebar "Knowledge" nav, routes `/kb` + `/kb/:id`, ⌘K GlobalSearch indexes articles + "New article" action, contact drawer gains a "Knowledge" strip (`articlesForContact`: contactIds ∪ [[Name]] ∪ name mention). `src/lib/share.js` gains `copyText`. Seeds: 4 collections (one nested) + 3 mutually-linking sample articles. Tests: `probe-kb.test.jsx` (15 — engine contracts incl. hostile-title escape, nested collection create + descendant filter, template create, wiki-link resolve + reciprocal backlinks, contact strip, meta rail, .md export content, live edit backlink propagation, ⌘K navigation). Full suite 68/68; build 840.56 kB / gzip 240.51. Deferred to later: drag-to-move articles (collection dropdown covers it), backlink graph visual on the Network page, .zip collection export, note↔article cross-links, QuickCapture "Article" voice kind, article attachments via the WS-4 file store.
- **WS-7 Mobile responsiveness — DONE** (2026-10-16, commit `569fe11`): every screen usable at 360–430 px. New `src/components/Mobile.jsx` — `useIsMobile(breakpoint)` matchMedia hook, **BottomTabBar** (Home · Contacts · Tasks · Notes · More, `lg:hidden`, safe-area padded; More opens the full sidebar as a slide-over **Sheet** that auto-closes on navigation), **Sheet** (bottom-sheet w/ drag handle on phones → centered panel ≥md, Esc/backdrop/close), **ToolbarRow** (sideways-scrolling chip rows, scrollbar hidden). CSS (`index.css`): 44 px min tap targets below lg (`.icon-btn`/`.btn`/`.chip` media-query bumps), `.bottom-tabs` + `env(safe-area-inset-bottom)`, `.fab-raise` (QuickCapture FAB clears the bottom bar), `.sheet-panel`, `.toolbar-row`, and `.modal-wrap`/`.modal-panel` — **all detail modals go full-screen on phones via one CSS hook** (Modal in ui.jsx gained the classes). Sidebar: hidden below lg (desktop unchanged), gains a `sheet` mode (full-width nav with labels/badges) used by the More sheet. App shell: main gets `pb-28 lg:pb-6` + `overflow-x-hidden`. Screen sweep — **Contacts**: table hidden <md, stacked tap-cards (`contacts-cards`) with star/groups/tags/follow-up + edit/delete, tap opens the full-width drawer; **Tasks**: phone column picker (`task-col-picker` chips with counts, one column at a time, `min-w-full snap-start` snap board), desktop kanban unchanged; **Calendar**: phones default to the week view, month cells compact `min-h-[64px]`; GlobalSearch type chips scroll; month/week grids + tables audited (all tables already in `overflow-x-auto`). QA: `probe-mobile.test.jsx` (10 — bottom tabs navigate, More sheet open/close-on-route + Esc, phone column picker & desktop fallback, calendar phone/desktop default view, contacts cards → full-width drawer, modal hook classes, useIsMobile breakpoint tracking) + `probe-mobile.mjs` Playwright device matrix (360/390/768/1280 × 19 routes: no-horizontal-overflow + 44 px tap-target audit + screenshots — browser artifact like probe-notes.mjs, needs `playwright install chromium`). Full suite 78/78; build 848.96 kB / gzip 242.62. Deferred: physical-device pass on Android (with WS-8 APK), touch drag-and-drop on kanban (status select in the detail modal covers moves), ResponsiveTable generic migrator (handled per-table via visibility split + overflow wrappers).
- **PWA hardening + share-into-app ✅ · WS-8 Android rebuild ✅** (2026-10-16, commit `COMMITHASH`): **PWA** — service worker now registers in dev too (preview is installable) with a dev-safe pass-through for `/@vite|/src|/node_modules` live modules so HMR stays honest; cache bumped `pcrm-v3`; manifest refreshed (current feature description, `lang`/`dir`/`categories`, shortcuts for Notes/KB/Files) and gains a GET **`share_target`** — the WS-4 "share into the app" remainder: WhatsApp & friends → *Shared with you* modal (`ShareTargetHandler` in App.jsx) → **Save as note / Create task / Copy text**, URL cleaned after ingest. `probe-pwa.test.jsx` (7 — manifest contract incl. share_target + shortcuts, SW dev-guard source, share→note with URL cleanup, share→task, no-param no-modal, beforeinstallprompt → Install button → appinstalled clears). **WS-8** — `@capacitor/share@8` + `@capacitor/camera@8` added (6 plugins total: contacts, camera, filesystem, local-notifications, share, social-login); AndroidManifest gains `CAMERA`; `versionCode 1→2`, `versionName \"1.0\"→\"0.2.0\"`; `npx cap sync android` clean (plugins auto-registered, dist copied); android.yml workflow paths extended (`public/**`, `index.html`, `package-lock.json`) so shell changes rebuild the APK; `demo-standalone.html` regenerated from the singlefile build (851 kB — every feature keeps its web fallback so the standalone demo still works); README: new PWA/mobile section, Notes/Files/KB rows, Android first-run permissions row, Release notes for v0.2.0 (versionCode 2). Full suite 85/85; build 851.75 kB / gzip 243.37. Remaining before calling v0.2.0 shipped: **on-device QA matrix** (Android 10/13/14/15 — install, PIN lock, contacts import, notification with app closed, file save, nearby transfer, share-sheet round-trips) — needs physical devices or an emulator outside this sandbox; CI APK via *Actions → Build Android APK → Run workflow* is green-path ready. Deferred (still open): QR camera scanning, Gist-relay signaling, note-attachment UI, article attachments, contact timeline (X4), extras X1–X8.

---

## 1. Decisions locked in

| Decision | Choice |
|---|---|
| Knowledge Base | **New standalone KB module** (wiki-style articles, collections, backlinks) — separate from Keep-style Notes |
| Device-to-device transfer | **QR-paired local transfer** (WebRTC DataChannel) + share-sheet fallback (WhatsApp, links, etc.) |
| Platform priority | **Android APK first**, web gets graceful fallbacks for every native feature |
| Process | Plan first → implement after approval |

---

## 2. Where the app stands today

React 18 + Vite + Tailwind 4 + Capacitor 8 (`com.bitscol.personalcrm`), single `localStorage` store (`pcrm-v1` in `src/store.jsx`, ~1,027 lines), 17 screens, GitHub Actions APK workflow (`.github/workflows/android.yml`).

Relevant gaps this update closes:

| Area | Today | Gap |
|---|---|---|
| Notes | Title + markdown body + pin + contact links | No colors, checklists, labels, images, archive, reminders, grid |
| Notifications | Derived in-app inbox (`buildNotifications()`) | **No real alerts** — nothing fires at a time, no sound, no system notifications, no repeats |
| Phone contacts | Google People API only | No native phone contact access; manifest has only `INTERNET` |
| Files | — | No file storage, no document list, no device-to-device transfer |
| Sharing | vCard share (Web Share), `wa.me` deep links, ICS export | No file share, no import-from-link, no "share into app" |
| Knowledge Base | — (does not exist) | Needs building from scratch |
| Mobile | Sidebar → 62px icon rail | Tables, modals, kanban, topbar not phone-ready |
| Native plugins | `@capgo/capacitor-social-login` only | Need Contacts, Filesystem, LocalNotifications, Share, Camera |

---

## 3. Workstreams

### WS-1 · Notes → Google Keep-class ⭐ *(user item 1)*

**Goal:** keep the speed of Keep with the power of the existing markdown/contact-linking model.

**Features**
- **Note types:** text (markdown), checklist, and mixed notes (markdown + inline checklists).
- **Keep-style masonry grid** (responsive columns) with a compact list-view toggle; pinned row on top.
- **Colors:** 10 note backgrounds (Keep-like pastels + dark-compatible set), filter by color.
- **Labels:** note-specific labels (separate from contact tags) — create, rename, recolor, filter chips.
- **Archive & Trash:** archive (hidden from main grid, searchable), trash with restore + 30-day auto-purge.
- **Reminders per note** (uses WS-5 engine): `Remind me` with quick options + custom date/time + repeat.
- **Attachments:** images/files on a note (backed by the WS-4 file store); thumbnail preview, lightbox.
- **Quick-add bar** on the Notes page + extended QuickCapture ("Note / Checklist / Image note").
- **Sharing & export:** share note as text/markdown (Web Share → WhatsApp etc.), export `.md`/`.txt`, duplicate, pin-to-dashboard.
- **Editor upgrades:** markdown toolbar (B/I/H/list/checkbox/code/link), live preview split on desktop, word/char count, autosave indicator (store already autosaves — surface it).
- **Search:** title + body + labels + checklist text; sort by updated/created/title/color.

**Data model** (additive — no migration, keep `pcrm-v1` key)
```js
note = { id, title, body,                     // existing
  kind: 'text'|'checklist',                   // new
  checklist: [{id, text, done}],              // new
  color: null|'amber'|'rose'|…,               // new
  labels: ['lbl_…'],                          // new
  attachments: [{fileId, name, mime, size}],  // new (WS-4)
  pinned, archivedAt, trashedAt,              // new archive/trash
  remindAt, repeat,                           // new (WS-5)
  contactIds, updated, createdAt }
```

**Files:** `src/pages/Notes.jsx` (rewrite), `src/components/NoteEditor.jsx` + `src/components/NoteCard.jsx` (new), `src/lib/markdown.js` (extract `mdToHtml` for reuse by WS-6), `src/store.jsx` (notes CRUD + archive/trash), `src/data/seed.js` (sample labels/checklists), QuickCapture + GlobalSearch hooks.

**Acceptance:** create/check/archive/restore/color/label/remind on a note; grid looks like Keep at ≥768px and stays usable at 360px; trash purge rule works; note reminders fire (WS-5).

---

### WS-2 · Phone Contacts import / export ⭐ *(user item 2)*

**Goal:** one tap to pull the phone's address book into CRM, and push CRM contacts back out.

**Native (Android)**
- Plugin: `@capacitor-community/contacts` (read + write), runtime `READ_CONTACTS` permission (Android 13+ POST-style prompt), `WRITE_CONTACTS` for export-to-phone.
- **Import flow:** `Contacts page → Import → From phone` → permission primer → fetch → map (name, phones, emails, birthday, org/title) → **reuse the existing dedupe → diff-preview → commit → rollback pipeline** from `ImportPage` (match on normalized phone/email/name).
- **Export flow:** "Save to phone" (write selected/all via plugin) **and** the existing vCard share sheet (most reliable across OEMs).

**Web fallback (graceful)**
- Chrome **Contact Picker API** (`navigator.contacts.select`) for one-by-one picking where supported.
- `.vcf` file upload + download (the vCard parser in `src/lib/vcard.js` already exists; add file-input entry point next to paste).
- UI shows *"Phone contact access requires the Android app"* when no native/picker capability — never a dead button.

**Files:** `src/lib/native.js` (new — capability detection: `isNative()`, `hasContactsPlugin()`, etc.), `src/lib/contacts-native.js` (new), `src/pages/ImportPage.jsx` + `src/pages/Contacts.jsx` (new entry points), `android/app/src/main/AndroidManifest.xml` (permissions), `package.json`.

**Acceptance:** on Android — import 50+ phone contacts through the diff pipeline and roll back; export a contact to phone Contacts. On web — `.vcf` in/out works, picker used when available.

---

### WS-3 · Files / Documents + Nearby transfer ⭐ *(user items 3)*

**Goal:** a real document shelf on each device, with a list of what lives where, and SHAREit-style send/receive between two devices.

#### 3a. File storage (local-first)
- Plugin: `@capacitor/filesystem` (Android: app-external Documents dir `PersonalCRM/` so files are visible in Files app), web: **IndexedDB blob store** (`src/lib/filestore.js` abstracts both behind one API: `saveBlob`, `readBlob`, `deleteBlob`, `list`).
- **File index** lives in the main store and syncs via the existing Gist/Drive channel:
  ```js
  file = { id, name, mime, size, sha256, folder, tags[], contactIds[],
           deviceId, deviceName, storedAt, origin: 'import'|'camera'|'share'|'transfer'|'export' }
  ```
  Blobs **never** leave the device that holds them unless explicitly transferred — the index answers "which device has what".
- **Files page (`/#/files`):** folders + tag filter + search; grid/list; per-file actions: open, share, rename, star, tag, link-to-contact, delete; device filter ("On this phone / On laptop / …"); storage summary widget on Dashboard.
- Attachments from Notes (WS-1) and KB (WS-6) route through this store — one place for quotas/cleanup.

#### 3b. Nearby send/receive (SHAREit-style)
- **Pairing:** Sender picks files → "Nearby send"; generates a **QR code** (session code + compressed SDP offer). Receiver taps "Receive" → scans QR (`html5-qrcode`, one code path for web + Android WebView, camera permission in manifest) → answer flows back (second QR *or* over the tiny signaling channel below).
- **Transport:** `RTCPeerConnection` + `RTCDataChannel` — 64 KB chunks, per-file SHA-256 verify, progress bar per file, cancel/resume, auto-reject duplicates. LAN/Hotspot/any network path WebRTC negotiates; no server, no accounts.
- **Fallback signaling (cross-network / QR-too-big):** reuse the **Gist/Drive sync channel** as a signaling bus (device A writes an `offer` message, device B polls and answers) — internet needed but zero new infra.
- **Receive screen:** radar-style "waiting to receive" + history of received files; accepted files land in the file store and appear in the index.
- Honest note in UI/README: OS-level *Bluetooth SHAREit* is not available to web-bridge apps; this is the true peer-to-peer equivalent. (A custom native BT plugin is explicitly out of scope — per decision.)

#### 3c. Per-device file listing
- Devices register themselves (`syncState.deviceId` already exists — extend with `deviceName`, `lastSeen`).
- File index (3a) synced across devices → every device can show *"Files stored on: this phone / Pixel / laptop…"* with counts, sizes, last-seen, and "request file" (queues a nearby transfer when both are online).

**Files:** `src/lib/filestore.js`, `src/lib/nearby.js` (WebRTC + signaling), `src/pages/FilesPage.jsx` (new), `src/components/NearbyTransfer.jsx` (new — send/receive modals), `src/store.jsx` (files/devices slice + sync payload), `src/components/Sidebar.jsx` (nav entry), `src/components/dashboardWidgets.jsx` (storage widget).

**Acceptance:** save/open/delete a file on Android and web (IndexedDB); file index appears on the second synced device; two browsers (or phone + laptop) complete a QR-paired transfer with hash verification.

---

### WS-4 · Import/Export via link & sharing ⭐ *(user item 4)*

**Goal:** everything leaves and enters the app through the channels people actually use — WhatsApp, share sheet, links, QR.

**Outbound (share)**
- Central `lib/share.js`: `shareText`, `shareFile` (Web Share L2 on web, `@capacitor/share` on Android — WhatsApp/Telegram/Gmail appear in the sheet automatically).
- Share targets: contact card (.vcf), note (.md/.txt), task/event (.ics), KB article (.md), full/partial backup (`.json` — extend `exportData()`), any stored file.
- "Copy as link" for anything representable as text/URL; WhatsApp-specific button where a text deep link helps (`wa.me`).

**Inbound (import)**
- **From link:** paste a URL → fetch `.vcf / .csv / .json / .ics` → existing dedupe/diff/commit pipeline (works great with GitHub raw / Gist URLs; CORS-limited URLs get a clear "download then drop file" fallback).
- **From file:** drag-and-drop zone + file picker on the Import page (covers WhatsApp-downloaded files on Android).
- **From clipboard:** "paste to import" (already partially in QuickCapture — route it through the pipeline).
- **Share-into-app (Android):** manifest `SEND` intent-filter for `text/plain`, `text/vcard`, `application/json` + listener so "Share → Personal CRM" works from other apps.
- **QR exchange:** "Show my card" (vCard QR) and "Scan to import" — great at events; feeds WS-2's pipeline.

**Files:** `src/lib/share.js`, `src/pages/ImportPage.jsx` (link/file/drop zones), `src/pages/Contacts.jsx` (share/QR actions), `android/.../AndroidManifest.xml` (SEND intent), `src/components/QrCard.jsx` (new).

**Acceptance:** share a vCard to WhatsApp from the share sheet on Android; import a `.vcf` from a GitHub raw link; "Share to Personal CRM" from another app lands in the import pipeline.

---

### WS-5 · Reminders + notification bells/rings ⭐ *(user item 5)*

**Goal:** the app actually *reminds* you — meetings, tasks, note reminders, birthdays — with sound and system notifications, on schedule, even when the app is closed (Android).

**Reminder engine (`src/lib/reminders.js`)**
```js
reminder = { id, refType: 'task'|'event'|'note'|'contact'|'custom', refId,
             title, body, at: ISO, repeat: 'none'|'daily'|'weekly'|'monthly'|'yearly',
             sound: 'bell'|'chime'|'classic'|'gentle'|'silent', vibrate: true,
             leadTimes: [10, 60], status: 'scheduled'|'fired'|'done', origin }
```
- **Two firing paths:**
  1. **In-app:** ticker (30 s + on tab focus) checks due reminders → in-app alert overlay + **sound** (bundled royalty-free bell/chime MP3s via WebAudio, volume + test button in Settings) + `navigator.vibrate`.
  2. **System (Android):** `@capacitor/local-notifications` schedules the same reminders as native notifications with sound — fires with the app closed. All reminders are **re-scheduled on every app launch** (and a small `BOOT_COMPLETED` receiver if testing shows the plugin doesn't survive reboot). Android 13+ `POST_NOTIFICATIONS` runtime permission + in-app primer.
  3. **Web fallback:** Notification API (permission prompt) while the tab/PWA is open; otherwise the in-app overlay.
- **Where reminders attach:** task detail modal (`Remind me` chip + lead times), event editor (default "10 min before"), note editor (WS-1), contact drawer ("remind me about X on date"), free-form "Reminder" quick-capture type.
- **Reminders view:** new section in `/notifications` — upcoming, overdue, history; edit/snooze (5/15/30 min, 1 h)/dismiss/mark-done; completing a task clears its reminders.
- **Settings:** default lead time, default sound, per-category mute (extends existing `notifPrefs`), permission status chips + repair links, "Send test ring".
- Topbar bell gains a live badge + dropdown of the next 5 reminders.

**Files:** `src/lib/reminders.js`, `src/lib/sounds/` (4–5 small MP3s), `src/store.jsx` (reminders slice + `buildNotifications` merge), `src/pages/Notifications.jsx` (Reminders tab), task/event/note editors, `src/pages/SettingsSync.jsx` (sound & defaults), `package.json` (`@capacitor/local-notifications`), manifest (`POST_NOTIFICATIONS`, `VIBRATE`).

**Acceptance:** a task reminder set for +2 min rings with sound + system notification on Android with the app backgrounded; repeats weekly correctly; snooze/dismiss behaves; web shows in-app overlay + notification when permitted.

---

### WS-6 · Knowledge Base (new module) ⭐ *(user item 6 — new build)*

**Goal:** a personal wiki — long-form structured knowledge next to Keep-style quick notes.

**Features**
- **Articles:** title + markdown (shared `lib/markdown.js` with TOC extraction), summary, cover icon, front-matter strip.
- **Collections:** nested tree (folder → subfolder), color/icon per collection, drag-to-move articles.
- **Backlinks:** `[[Article title]]` wiki-links auto-resolve + every article shows *"Mentioned in"* / *"See also"*; backlink graph node-links into the existing Network page (optional visual).
- **Tags & links to the CRM:** label articles, link contacts/tasks/notes; contact drawer gains a "Knowledge" strip (all articles mentioning the contact).
- **Templates:** Meeting notes, Person profile, Project brief, Book/article summary, Decision log — "New from template".
- **Search & browse:** full-text search (title + body + tags) wired into ⌘K GlobalSearch; favorites; recently viewed; sort.
- **Attachments** via WS-4 file store (PDFs, images inline).
- **Export:** article/collection as `.md`/`.zip`; share via WS-4.
- **KB home:** cover page with collection cards, pinned articles, recent activity, tag cloud.

**Data model**
```js
kbArticle    = { id, title, body, summary, collectionId, tags[], contactIds[],
                 attachments[], favorite, createdAt, updatedAt }
kbCollection = { id, name, parentId, icon, color, order }
```

**Files:** `src/pages/KnowledgeBase.jsx` (+ `src/pages/ArticleEditor.jsx`), `src/lib/wiki.js` (backlink parse/resolve), `src/store.jsx` (kb slices + sync payload), `src/components/Sidebar.jsx` (`/#/kb`), GlobalSearch, QuickCapture ("Article" type), `src/data/seed.js` (3 sample articles + collections).

**Acceptance:** create nested collections and articles; `[[link]]` resolves and shows backlinks; contact drawer lists related articles; KB included in Gist/Drive sync and ⌘K search.

---

### WS-7 · Mobile responsiveness fixes ⭐ *(user item 7)*

**Goal:** every screen is genuinely usable at 360–430 px, not just "doesn't overflow".

**Global primitives (new, in `src/components/ui.jsx` or `Mobile.jsx`)**
- **Bottom tab bar** (< `lg`): Home · Contacts · Tasks · Notes · More (More opens the current sidebar as a slide-over sheet). Sidebar desktop layout unchanged.
- `Sheet` (bottom-sheet / full-screen modal on phones — all detail modals migrate), `ResponsiveTable` (data rows → stacked cards below `md`), `ToolbarRow` (horizontal scroll chips), safe-area padding (`env(safe-area-inset-bottom)`), min 44 px touch targets, FAB raised above bottom bar.

**Screen-by-screen sweep** (17 screens — the known offenders first)
- Contacts table → card list on phone; drawer → full-screen sheet.
- Tasks kanban → snap-scroll columns + column picker; detail modal → sheet.
- Calendar month grid compact mode; week/day default on phone.
- Dashboard widgets: `grid-cols-2 xl:grid-cols-4` → 1-col with compact KPI rows; reorder handles touch-friendly.
- Analytics/Graph/Tags/History/Import/Settings/Integrations: table + chart overflow audit, chip rows scrollable, form fields stack.
- Topbar: search collapses to icon → full-width overlay; keep ⌘K accessible as a tap.

**QA:** Playwright (already a devDependency) device-matrix script (`probe-mobile.mjs`) — screenshots at 360/390/768/1280 of every route, assert no horizontal overflow + tap-target sizes. Manual pass on one Android phone via APK.

**Files:** `src/components/Mobile.jsx` (new), `src/components/ui.jsx`, `src/components/Sidebar.jsx`, `src/components/Topbar.jsx`, `src/App.jsx`, every `src/pages/*.jsx`, `probe-mobile.mjs` (new, matches repo probe convention).

**Acceptance:** Playwright sweep green at 360 px on all routes; no page scrolls horizontally; primary flows (add contact, complete task, write note) done one-handed on a phone.

---

### WS-8 · Build / update the mobile app ⭐ *(user item 8)*

- Add plugins: `@capacitor-community/contacts`, `@capacitor/filesystem`, `@capacitor/local-notifications`, `@capacitor/share`, `@capacitor/camera` (photo attachments) — all Capacitor 8-compatible; `npx cap sync android`.
- **Manifest:** `READ_CONTACTS`, `WRITE_CONTACTS`, `POST_NOTIFICATIONS`, `CAMERA`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED` (+ `SEND` intent-filter from WS-4); runtime permission primers in-app.
- **Versioning:** bump `versionCode` / `versionName` (→ 2 / "0.2.0") in `android/app/build.gradle`; release notes in README.
- **CI:** existing `.github/workflows/android.yml` keeps building debug + signed release; extend paths if needed; verify with `workflow_dispatch`.
- **QA matrix:** Android 10 / 13 / 14 / 15 — install, PIN lock, contacts import, notification with app closed, file save, nearby transfer, share-sheet round-trips.
- Regenerate `demo-standalone.html` (vite singlefile) — all new features keep web fallbacks so the demo still works standalone.
- README: new feature sections + updated Android setup (new permissions).

---

## 4. Extra features proposed (beyond your list)

| # | Feature | Why | Size |
|---|---|---|---|
| X1 | **Recurring tasks** (daily/weekly/monthly/weekday-only) | Completing one spawns the next — classic CRM gap | S |
| X2 | **QR business-card mode** | At events: show your vCard QR / scan theirs → straight into WS-2 pipeline | S |
| X3 | **Biometric unlock** (fingerprint/face) alongside PIN | Phones unlock with a thumb; PIN remains fallback | S |
| X4 | **Contact timeline** in the drawer | Unified stream: touchpoints + linked notes + tasks + emails per person | M |
| X5 | **Auto-backup nudge** | "Last backup 14 days ago" toast + one-tap Drive/Gist backup | S |
| X6 | **English + বাংলা UI toggle** (i18n) | Dhaka-first audience; `lib/i18n.js` with string tables | M |
| X7 | **Android home-screen shortcuts** (long-press icon → New note / New contact / Scan) | Cheap native win via activity-alias shortcuts | S |
| X8 | **Dashboard widgets for the new modules** (storage usage, upcoming reminders, KB recents) | Keeps the dashboard the cockpit | S |

**Recommended for this cycle:** X1, X2, X3, X5, X8 (all S). X4/X6/X7 can follow.

---

## 5. Phasing & order (dependencies drive the order)

| Phase | Content | Depends on | Size |
|---|---|---|---|
| **P0 — Foundations** | `lib/markdown.js`, `lib/native.js` capability layer, file-store adapter skeleton, reminder-engine skeleton, mobile UI primitives (Sheet/ResponsiveTable/bottom-nav shell) | — | M |
| **P1 — Reminders & rings (WS-5)** | Engine, sounds, local-notifications, Reminders UI, Settings | P0 | M |
| **P2 — Notes 2.0 (WS-1)** | Keep-class notes incl. per-note reminders + attachments | P0, P1 | L |
| **P3 — Mobile sweep (WS-7)** | All 17 screens + Playwright probe | P0 (so new screens follow the pattern; run again at P8) | L |
| **P4 — Phone contacts (WS-2)** | Native contacts plugin + web fallbacks + pipeline | P0 | M |
| **P5 — Files & sharing (WS-3a + WS-4)** | File store, Files page, share.js, link/file import, QR exchange | P0 | L |
| **P6 — Nearby transfer (WS-3b/3c)** | QR pairing + WebRTC + device index | P5 | L |
| **P7 — Knowledge Base (WS-6)** | New module | P0, P5 (attachments) | L |
| **P8 — Android build + QA + docs (WS-8)** | Plugins, manifest, CI, device matrix, README, demo regen, extras X1/X2/X3/X5/X8 | all | M |

Each phase ends green: `npm run build`, existing `probe-*.mjs` scripts, new per-module probes, and a smoke pass. Work lands as separate commits per phase on `arena/8018c92d-personal-crm`.

---

## 6. Cross-cutting architecture notes

- **Store versioning:** new slices are **additive with defaults** — stay on `pcrm-v1`, no migration needed. New slices: `notes` (extended fields), `noteLabels`, `reminders`, `files`, `devices`, `kbArticles`, `kbCollections`.
- **Sync payloads** in `store.jsx` (`exportData` ~L432, `importData` ~L461, gist/Drive `local` ~L583) must include the new slices + file **index** (never blobs).
- **Capability layer (`lib/native.js`):** every native call is wrapped — `isNative()`, plugin availability probes, and a `WEB_FALLBACK` map so buttons degrade (or explain themselves) instead of breaking the standalone demo.
- **Security/privacy:** everything stays local-first; files/notes/KB only travel via explicit share/transfer/sync. No new network endpoints (WebRTC is P2P; Gist/Drive only via existing user-owned channels).
- **Standards:** keep the repo's conventions — probe scripts for verification, seed data for demos, `SectionHead`/`Card`/`chip` UI kit, lucide icons, no new UI framework.

---

## 7. Risks & honest constraints

| Risk | Mitigation |
|---|---|
| WebRTC signaling/QR size (SDP > QR capacity) | deflate-compress SDP (`CompressionStream`), split into short multi-QR sequence; Gist signaling fallback |
| OEM battery killers delay Android notifications | schedule via `@capacitor/local-notifications` (AlarmManager), reschedule on launch, test on aggressive OEMs (Xiaomi/Samsung) |
| Contacts plugin write support varies by OEM | "Save to phone" best-effort + vCard share sheet as guaranteed path |
| WebView camera for QR scanning | Android camera permission + `html5-qrcode` fallback to manual 6-char session code entry (works without camera) |
| localStorage quota with growing data | files in Filesystem/IndexedDB (blobs), notes/KB stay text-only in store; watch serialized size in Dashboard sync-health widget |
| IndexedDB vs Filesystem divergence | one `filestore.js` interface, probe scripts run against both backends |
| Bluetooth expectations vs WebRTC reality | UI copy says "Nearby send (Wi-Fi direct / internet)" honestly; README documents the decision |

**Out of scope this cycle:** iOS build, custom native Bluetooth plugin, web push (needs a server), end-to-end encrypted sync, multi-user/sharing accounts, custom note drawings (Keep's sketch feature).

---

## 8. Testing & QA plan

- **Per-module probe scripts** (`probe-notes.mjs`, `probe-reminders.mjs`, `probe-files.mjs`, `probe-kb.mjs`, `probe-nearby.mjs`) — jsdom-based like the existing `probe-crud/pin/legacy/real.mjs`.
- **Playwright mobile sweep** (`probe-mobile.mjs`) — 4 viewports × 17 routes, overflow + tap-target assertions, screenshots for review.
- **Integrations verification** — keep `verify-integrations.mjs` green after store changes (webhooks/vCard/ICS untouched but shared code moves).
- **Device matrix (manual, Android):** install → PIN → contacts import → reminder with app closed → file save/open → nearby transfer phone↔phone and phone↔laptop (browser) → WhatsApp share round-trip.
- **Regression:** `npm run build` (singlefile demo) + `npm run android:sync` + CI `workflow_dispatch` APK build.

---

## 9. Deliverables checklist (definition of done)

- [ ] All 8 user items implemented with web fallbacks where native-only
- [ ] Extras X1, X2, X3, X5, X8 landed
- [ ] Playwright mobile sweep green at 360 px
- [ ] Probe scripts green for every new module
- [ ] GitHub Actions builds debug + signed release APK; version 0.2.0
- [ ] README + `docs/UPDATE_PLAN.md` status updated; `demo-standalone.html` regenerated
- [ ] No data loss: `pcrm-v1` loads old backups unchanged

---

## 10. Next step

Approve this plan (or flag changes — e.g. drop/defer phases, swap extras). On approval implementation starts at **P0 → P1 → P2 …** with a working build at the end of every phase.
