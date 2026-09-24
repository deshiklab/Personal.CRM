# Changelog

## 2.0.0 — Phase 2 · Make it sellable (2026-09-25)

### Play Billing
- `@capgo/native-purchases` — one-time INAPP product `personal_crm_pro_lifetime`
- `src/lib/billing.js` — purchase, restore, silent boot sync, web no-op
- Pro screen: live price when Play is available, **Buy** + **Restore**
- Android `BILLING` permission + Gradle module wired
- Local licence written with `source:'play'` after acknowledge

### Entitlements & Pro screen
- **Entitlements module** (`src/lib/entitlements.js`) — free/pro tier, offline licence-key verify (HMAC), feature catalogue
- **Pro screen** (`/#/pro`) — Free vs Pro comparison, licence-key redeem, honest money copy
- Free-tier **contact cap** (75) with upgrade toast
- Version **2.0.0** (app, package, Android `versionName` / `versionCode` 3)
- `probe-pro.mjs` — key mint/verify + Pro UI + Play affordances
- KB article `pro.lifetime`
- `docs/PLAY-BILLING.md` — Play Console setup checklist

### Still this phase
- Local reminders (Android + Web Notifications)
- A11y / virtualised contacts / 5k test
- Store assets + closed-test AAB

## 1.x — Phase 0 / Phase 1

Local-first CRM, safety net, native Preferences storage, light-theme contrast, mobile polish, visiting-card scan, probes in CI.
