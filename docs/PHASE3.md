# Phase 3 — After closed test (ideas, not commitments)

Phase 2 made the app **sellable**. Phase 3 is **delight + distribution** once Play closed test is running.

## Do first (ops — outside the repo)

1. Play product `personal_crm_pro_lifetime` + license testers  
2. Signed AAB + closed track + 14–16 testers (`docs/OPS-LAUNCH.md`)  
3. MoR storefront + `npm run mint-keys` pool + set `BRAND.proWebUrl`  
4. Optional: replace web-capture screenshots with physical-device shots  

## Product candidates (pick later)

| Idea | Why | Effort |
|---|---|---|
| Onboarding checklist widget | First-run clarity for closed testers | S |
| Contact density / compact list | Power users with 1k+ people | S |
| Export full backup encrypt (PIN-derived) | Paranoid local-first buyers | M |
| iOS shell (Capacitor) | Second store; StoreKit already in Capgo path | L |
| Locale pack (bn / en) | BD home market + export | M |
| Widget: “who to call today” | Daily habit loop | S |
| Blocklist of revoked key payload hashes | Abuse response without a server | S |

## Explicit non-goals (still)

- User accounts / BITSCOL-hosted backend  
- Subscriptions  
- Ads / trackers  
- Server-side licence verification as a requirement  

## Versioning

- Stay on **2.0.x** for Play closed-test hotfixes  
- **2.1.0** when a product candidate above ships  
- Bump `versionCode` every AAB upload  

## Docs map

| Doc | Use |
|---|---|
| `OPS-LAUNCH.md` | Master launch checklist |
| `CLOSED-TEST.md` / `TESTER-EMAILS.md` | Testers |
| `PLAY-BILLING.md` | IAP |
| `WEB-KEYS-MOR.md` | Web keys |
| `STORE-LISTING.md` | Play text + assets |
| `PHASE3.md` | This file |
