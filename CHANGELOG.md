# Changelog

## 2.0.0 — Phase 2 · Make it sellable (2026-09-25)

### Pro feature gates · mint · real screenshots
- Gate auto-snapshots, Drive/Gist auto-sync interval, analytics 6M/12M, graph SVG/PNG export
- Ocean extra theme (Pro); free stays light/dark
- `scripts/mint-keys.mjs` — offline PCRM1 key pool for MoR
- `scripts/capture-store-shots.mjs` — 1080×1920 captures from the live build
- Real phone screenshots replaced stylized stand-ins in `docs/store-assets/`

### Ops pack · reminders UI · web keys
- Inbox: quiet hours + per-type lead times + Apply schedule (Pro)
- `docs/OPS-LAUNCH.md`, `TESTER-EMAILS.md`, `WEB-KEYS-MOR.md`
- Play-ready PNGs: feature graphic, icon-512, 8 phone screenshots
- Pro screen: optional `BRAND.proWebUrl` “Buy on the web”; MoR copy when empty


### Local reminders
- `@capacitor/local-notifications` — on-device nudges for tasks, follow-ups, birthdays, events
- `src/lib/reminders.js` — schedule/cancel/sync, quiet hours, web Notification fallback
- Notification Center → **Device reminders** (Pro-gated); free keeps in-app inbox
- Android: `POST_NOTIFICATIONS`, exact alarm, boot, vibrate; channel `pcrm_reminders`
- Service worker `notificationclick` deep-links into the right screen

### A11y & virtualised contacts
- Skip-to-content link, `main#main-content`, focus-visible rings, `prefers-reduced-motion`
- Larger touch targets for icon buttons on coarse pointers
- `VirtualList` windowing on Contacts — smooth past 5 000 rows
- Contact rows keyboard-activatable (Enter/Space) with aria-labels

### Store assets & closed test
- `docs/STORE-LISTING.md` — short/full description, data safety, screenshot plan
- `docs/CLOSED-TEST.md` — 14–16 testers × 14 days, invite blurb, AAB steps
- `docs/store-assets/` — feature graphic SVG + 8 screenshot frame templates
- Android `versionCode` **4** (versionName 2.0.0)

### Play Billing (earlier in 2.0.0)
- `@capgo/native-purchases` — one-time INAPP `personal_crm_pro_lifetime`
- Pro screen Buy + Restore; web degrades to licence key
- `docs/PLAY-BILLING.md`

### Entitlements & Pro screen
- Free/pro tier, offline HMAC licence keys, contact cap 75
- Pro screen Free vs Pro · KB `pro.lifetime`

### Still optional / ops
- Capture real 1080×1920 screenshots from a device into `docs/store-assets/`
- Upload signed AAB to closed testing; recruit 14–16 testers
- Create Play product + license testers

## 1.x — Phase 0 / Phase 1

Local-first CRM, safety net, native Preferences storage, light-theme contrast, mobile polish, visiting-card scan, probes in CI.
