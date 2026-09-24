# Changelog

## 2.0.0 — Phase 2 · Make it sellable (2026-09-25)

Phase 2 branch opens. First slice: entitlements foundation + Pro screen.

### Added
- **Entitlements module** (`src/lib/entitlements.js`) — free/pro tier, offline licence-key verify (HMAC), Play product id placeholder, feature catalogue
- **Pro screen** (`/#/pro`) — Free vs Pro comparison, licence-key redeem, Restore purchases stub, honest money copy
- Free-tier **contact cap** (75) with upgrade toast
- Version **2.0.0** (app, package, Android `versionName` / `versionCode` 3)
- `probe-pro.mjs` — key mint/verify + Pro UI + redeem round-trip
- KB article `pro.lifetime`

### Still this phase
- Play Billing (one-time product) + real restore
- Local reminders (Android + Web Notifications)
- A11y / virtualised contacts / 5k test
- Store assets + closed-test AAB

## 1.x — Phase 0 / Phase 1

Local-first CRM, safety net, native Preferences storage, light-theme contrast, mobile polish, visiting-card scan, probes in CI.
