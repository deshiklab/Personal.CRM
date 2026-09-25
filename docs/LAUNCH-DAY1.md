# Launch day-1 — BiTsCol (one page)

**Repo is done.** Run this on a machine with your Play / keystore / email.

Live web: https://deshiklab.github.io/Personal.CRM/  
Package: `com.bitscol.personalcrm` · **2.0.0** (versionCode **4**)  
IAP id (Play + App Store): `personal_crm_pro_lifetime`

```bash
git clone git@github.com:deshiklab/Personal.CRM.git && cd Personal.CRM
git checkout phase2 && npm ci
npm run launch:check          # must be green
```

---

## Morning — signing + Play shell

| ☐ | Step | Command / where |
|---|---|---|
| ☐ | Create upload keystore **once** | `npm run keystore:release` |
| ☐ | Back up `.jks` + both passwords | password manager **and** offline drive |
| ☐ | Play Console → create/link app | application id `com.bitscol.personalcrm` |
| ☐ | Paste listing | `docs/STORE-LISTING.md` |
| ☐ | Upload graphics | `docs/store-assets/feature-graphic.png`, `icon-512.png`, screenshots 01–08 |
| ☐ | Privacy / Terms | `…/privacy.html` · `…/terms.html` (gh-pages) |
| ☐ | Data safety + content rating | answers in `STORE-LISTING.md` |
| ☐ | IAP one-time product | id **`personal_crm_pro_lifetime`** · `PLAY-BILLING.md` |
| ☐ | License testers | Setup → License testing → Gmails |

## Afternoon — AAB + closed test

```bash
export KEYSTORE_FILE=/absolute/path/to/upload-keystore.jks
export KEY_ALIAS=upload
export KEYSTORE_PASSWORD='…'
export KEY_PASSWORD='…'
./scripts/build-aab.sh
# → android/app/build/outputs/bundle/release/app-release.aab
```

| ☐ | Step |
|---|---|
| ☐ | Play → Closed testing → upload AAB (release notes in `STORE-LISTING.md`) |
| ☐ | Add **14–16** tester emails |
| ☐ | Copy opt-in URL → send `docs/TESTER-EMAILS.md` invite |
| ☐ | Confirm testers install **from Play link** (not sideload) |
| ☐ | Start 14-day engagement clock (≥12 must open the app) |

## Parallel — web MoR keys

```bash
# NEVER commit the CSV
npm run mint-keys -- --count 50 --csv ~/secure/pcrm-keys-pool.csv --fingerprints
```

| ☐ | Step |
|---|---|
| ☐ | Pick one MoR (Lemon Squeezy or Paddle) · `WEB-KEYS-MOR.md` |
| ☐ | One-time product “Personal CRM Pro” |
| ☐ | Load unused keys into MoR **or** fulfill manually from CSV |
| ☐ | Thank-you shows key + https://deshiklab.github.io/Personal.CRM/#/pro |
| ☐ | Set `proWebUrl` in `src/brand.js` → rebuild → push phase2 + gh-pages |

## Later — iOS (after Android test is running)

```bash
npm run ios:sync && npm run ios:open   # macOS + Xcode
```

| ☐ | Step |
|---|---|
| ☐ | Apple Developer · signing · **In-App Purchase** capability |
| ☐ | App Store Connect non-consumable **`personal_crm_pro_lifetime`** |
| ☐ | TestFlight |

---

## Support

- sales@bitscol.com · +8801711853769 · www.bitscol.com  
- Refund / key-reissue: decide once (note in MoR dashboard)  
- Full checklist: `docs/OPS-LAUNCH.md`

## Do not

- Commit keystores, live key CSVs, or `.env`  
- Sideload the closed-test build (Billing won’t resolve)  
- Change the IAP product id after stock is sold  
