# Launch ops pack — Personal CRM 2.0

**Repo product work (Phase 2 + 3) is complete.**  
**One-page sheet:** [`LAUNCH-DAY1.md`](LAUNCH-DAY1.md) · **Repo gate:** `npm run launch:check` What remains is **outside the repo**: Play Console, MoR, testers, and (when ready) App Store Connect.

Live web: <https://deshiklab.github.io/Personal.CRM/>  
Package: `com.bitscol.personalcrm` · versionName **2.0.0** · versionCode **4**  
Pro product id (Play + App Store): `personal_crm_pro_lifetime`  
Web key product id: `personal-crm-pro` · keys `PCRM1-…`

---

## Status (in-repo)

| Item | State |
|---|---|
| Sellable CRM + Pro gates | done |
| Play Billing client (Capgo) | done |
| StoreKit path (same Capgo plugin) | done · `ios/` + `docs/IOS.md` |
| Encrypted backup · welcome · locale bn/en | done |
| Store assets PNG (8 shots + feature + icon) | done · replace with device shots when you can |
| Listing copy · closed-test emails · MoR guide | done (docs) |
| Signed AAB on a real machine | **you** — needs Android SDK + keystore |
| Play closed test 14–16 × 14 days | **you** — long pole |
| MoR live + `BRAND.proWebUrl` | **you** |
| App Store / TestFlight | **you** · Mac + Apple Developer |

---

## Owner day-1 sequence (do in order)

### 1. Keystore (once, forever)

```bash
git clone git@github.com:deshiklab/Personal.CRM.git && cd Personal.CRM
git checkout phase2
npm ci
npm run keystore:release
# → android/upload-keystore.jks  (git-ignored)
# Back up JKS + passwords offline. Losing it ends the Play listing.
```

### 2. Play Console app shell

1. Create/link app **Personal CRM** · application id `com.bitscol.personalcrm`
2. Paste listing from `STORE-LISTING.md` (short + full + data safety answers)
3. Upload from `docs/store-assets/`:
   - `feature-graphic.png` (1024×500)
   - `icon-512.png`
   - `screenshot-01-…png` … `08` (phone)
4. Privacy / Terms:
   - https://deshiklab.github.io/Personal.CRM/privacy.html
   - https://deshiklab.github.io/Personal.CRM/terms.html
5. Content rating questionnaire · category **Productivity**

### 3. IAP + license testers

1. Monetize → In-app products → **one-time / managed**
   - ID: **`personal_crm_pro_lifetime`** (exact)
   - See `PLAY-BILLING.md`
2. Setup → License testing → add Gmail accounts that will sandbox-buy
3. (Optional later) App Store Connect non-consumable with the **same product id** — `IOS.md`

### 4. Signed AAB → closed test

```bash
export KEYSTORE_FILE=/absolute/path/to/upload-keystore.jks
export KEY_ALIAS=upload
export KEYSTORE_PASSWORD='…'
export KEY_PASSWORD='…'
./scripts/build-aab.sh
# → android/app/build/outputs/bundle/release/app-release.aab
```

1. Play → Testing → Closed testing → new track (e.g. `phase2-testers`)
2. Upload AAB · release notes from `STORE-LISTING.md`
3. Add **14–16** tester emails (or Google Group)
4. Copy **opt-in URL** → send `TESTER-EMAILS.md` invite
5. Testers must install **from the Play testing link** (not sideload) so Billing works
6. Ask: open ≥3 times / 2 weeks · add 1 contact · tick 1 task · (license testers) Pro → Buy
7. After **≥14 days × ≥12 engaged** → apply for production

Full policy: `CLOSED-TEST.md`.

### 5. Web MoR (parallel with closed test)

1. Pick **one** MoR (Lemon Squeezy or Paddle — see `WEB-KEYS-MOR.md`)
2. Product: one-time “Personal CRM Pro”
3. Mint a key pool **offline** (never commit):

```bash
npm run mint-keys -- --count 50 --csv ~/secure/pcrm-keys-pool.csv --fingerprints
# Store CSV offline only. Upload unused keys into MoR license field, or fulfill manually.
```

4. Thank-you email / page shows `PCRM1-…` + link  
   `https://deshiklab.github.io/Personal.CRM/#/pro`
5. When checkout URL is live, set in `src/brand.js`:

```js
proWebUrl: 'https://…your-mor-checkout…',
```

   Rebuild, commit, deploy gh-pages — Pro screen gains **Buy on the web**.

### 6. Support

- [ ] `sales@bitscol.com` monitored  
- [ ] Refund / key-reissue rule (MoR doc)  
- [ ] BITSCOL credit already in About  

---

## Checklist (tick in your own tracker)

### A. Play Console (Android)

1. [ ] App `com.bitscol.personalcrm` created / linked  
2. [ ] Store listing text from `STORE-LISTING.md`  
3. [ ] feature-graphic.png + icon-512.png  
4. [ ] Screenshots 01–08 (device shots preferred)  
5. [ ] Privacy / Terms URLs (gh-pages)  
6. [ ] Data safety + content rating  
7. [ ] IAP `personal_crm_pro_lifetime`  
8. [ ] License testers  
9. [ ] Upload keystore generated & backed up  
10. [ ] Signed AAB versionCode **≥ 4**  
11. [ ] Closed testing + 14–16 testers  
12. [ ] 14 days × ≥12 engaged → production  

### B. Web / PWA

1. [x] gh-pages current build  
2. [ ] MoR product live  
3. [ ] Key pool minted offline  
4. [ ] Thank-you delivers key + `/#/pro`  
5. [ ] `BRAND.proWebUrl` set + redeploy  

### C. iOS (after Android closed test is running)

1. [ ] Apple Developer Program  
2. [ ] `npm run ios:sync && npm run ios:open` on a Mac  
3. [ ] Signing + In-App Purchase capability  
4. [ ] App Store Connect app + non-consumable `personal_crm_pro_lifetime`  
5. [ ] TestFlight group  

### D. Support

1. [ ] sales@bitscol.com monitored  
2. [ ] Refund / reissue policy  
3. [x] BITSCOL credit in-app  

---

## Asset map

| File | Use |
|---|---|
| `docs/store-assets/feature-graphic.png` | Play feature graphic |
| `docs/store-assets/icon-512.png` | Hi-res icon |
| `docs/store-assets/screenshot-0N-*.png` | Phone screenshots |
| `docs/STORE-LISTING.md` | Listing copy + data safety |
| `docs/CLOSED-TEST.md` | Tester policy |
| `docs/TESTER-EMAILS.md` | Invite + nudges |
| `docs/PLAY-BILLING.md` | Play IAP |
| `docs/IOS.md` | Xcode / StoreKit / TestFlight |
| `docs/WEB-KEYS-MOR.md` | MoR + keys |
| `docs/OPS-LAUNCH.md` | This file |

## Commands

```bash
npm ci && npm run build
npm run mint-keys -- --count 20 --csv keys.csv --fingerprints   # offline only
npm run capture:store                                            # refresh web shots
./scripts/build-aab.sh                                           # Android SDK + keystore env
npm run ios:sync && npm run ios:open                             # macOS + Xcode
```

## Versioning

- Stay on **2.0.x** for closed-test hotfixes; bump **versionCode** every AAB  
- **2.1.0** only if you ship a new product feature after launch  
- iOS: bump `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in the Xcode project to match  
