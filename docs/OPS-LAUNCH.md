# Launch ops pack — Personal CRM 2.0

Single checklist that ties Billing, closed test, store assets, and web keys.

## A. Play Console (Android)

1. [ ] App `com.bitscol.personalcrm` created / linked  
2. [ ] Store listing text pasted from `STORE-LISTING.md`  
3. [ ] Upload **feature-graphic.png** (1024×500) from `docs/store-assets/`  
4. [ ] Upload **icon-512.png**  
5. [ ] Upload screenshots 01–08 PNG (replace with real device shots when you have them)  
6. [ ] Privacy / Terms URLs (gh-pages)  
7. [ ] Data safety form — answers in `STORE-LISTING.md`  
8. [ ] Content rating questionnaire  
9. [ ] In-app product **`personal_crm_pro_lifetime`** one-time — `PLAY-BILLING.md`  
10. [ ] License testers Gmail list  
11. [ ] Upload keystore generated & backed up (`npm run keystore:release`)  
12. [ ] Signed AAB (`scripts/build-aab.sh` / `npm run android:aab`) versionCode **≥ 4**  
13. [ ] Closed testing track + 14–16 testers — `CLOSED-TEST.md` + `TESTER-EMAILS.md`  
14. [ ] 14 days × ≥12 engaged → apply for production  

## B. Web / PWA

1. [ ] gh-pages serves current `dist` (already on deshiklab.github.io/Personal.CRM)  
2. [ ] MoR product live — `WEB-KEYS-MOR.md`  
3. [ ] Key pool minted & stored offline  
4. [ ] Thank-you email delivers `PCRM1-…` + redeem link `/#/pro`  
5. [ ] Optional: “Buy on the web” button on Pro when URL exists  

## C. Support readiness

1. [ ] sales@bitscol.com monitored  
2. [ ] Refund / key-reissue policy decided (see MoR doc)  
3. [ ] BITSCOL credit visible in-app (About) — already shipped  

## D. Asset locations in repo

| File | Use |
|---|---|
| `docs/store-assets/feature-graphic.png` | Play feature graphic |
| `docs/store-assets/icon-512.png` | Play / hi-res icon |
| `docs/store-assets/screenshot-0N-*.png` | Phone screenshots (stylized stand-ins) |
| `docs/store-assets/*.svg` | Editable sources |
| `docs/STORE-LISTING.md` | Listing copy |
| `docs/CLOSED-TEST.md` | Tester policy |
| `docs/TESTER-EMAILS.md` | Invite + nudges |
| `docs/PLAY-BILLING.md` | IAP product |
| `docs/WEB-KEYS-MOR.md` | Web MoR + keys |
| `docs/OPS-LAUNCH.md` | This file |

## E. Commands (dev machine with Android SDK)

```bash
cd Personal.CRM   # git clone, branch phase2
npm ci
npm run keystore:release   # once; back up JKS + passwords
export KEYSTORE_FILE=../upload-keystore.jks
export KEY_ALIAS=upload
export KEYSTORE_PASSWORD=…
export KEY_PASSWORD=…
./scripts/build-aab.sh
# → android/app/build/outputs/bundle/release/app-release.aab
```
