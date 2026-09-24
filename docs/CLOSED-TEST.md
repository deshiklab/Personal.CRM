# Closed testing checklist — Personal CRM

Google Play requires a closed test with engaged testers before production
for personal developer accounts (post-13 Nov 2023 policy).

## Targets (2026)

| Requirement | Our plan |
|---|---|
| Minimum testers | **12** engaged |
| Buffer | Recruit **14–16** |
| Engaged window | **≥ 14 days** with installs + opens |
| Track | Closed testing |
| App id | `com.bitscol.personalcrm` |
| Product | `personal_crm_pro_lifetime` (one-time) |

## Before you upload

1. **Upload keystore** — once: `npm run keystore:release`  
   Back up `android/upload-keystore.jks` + passwords offline. Losing it ends the listing.
2. **Env for CI/local AAB**
   ```bash
   export KEYSTORE_FILE=../upload-keystore.jks   # path relative to android/app or absolute
   export KEY_ALIAS=upload
   export KEYSTORE_PASSWORD=…
   export KEY_PASSWORD=…
   ```
3. **Play Console product** — create non-consumable `personal_crm_pro_lifetime` (see `PLAY-BILLING.md`).
4. **License testers** — Setup → License testing → add the same Gmail accounts.
5. **versionCode** must increase every upload (currently **4** / versionName **2.0.0**).

## Build the release AAB

```bash
cd personal-crm   # or Personal.CRM after sync
npm ci
npm run build
npx cap sync android
npm run android:aab
# → android/app/build/outputs/bundle/release/app-release.aab
```

If signing env vars are unset, the release build may be unsigned — set them first.

## Closed-test track

1. Play Console → Testing → Closed testing → Create track (e.g. `phase2-testers`).
2. Create release → upload AAB → release notes (see store listing copy below).
3. Add **email list** of 14–16 testers (or a Google Group).
4. **Copy the opt-in link** and send it — testers must accept before install.
5. Testers install **from the Play Store testing link** (not sideload) so Billing works.
6. Ask each tester to:
   - Open the app ≥ 3 times across 2 weeks
   - Add 1 contact, complete 1 task
   - (License testers) try **Pro → Buy on Play** with a test card
7. Track engagement in Play Console → Statistics / Reach and devices.
8. After **14 days × ≥12 engaged**, apply for production.

## Tester invite blurb (copy/paste)

```
You're invited to closed-test Personal CRM by BITSCOL.

1. Open this link on your Android phone and accept the tester invite:
   <PASTE_OPT_IN_URL>
2. Install "Personal CRM" from the Play Store listing that appears.
3. Open it a few times over the next two weeks — add a contact, tick a task.
4. Optional: Settings → Inbox → Enable device reminders (needs notification permission).
5. Feedback: sales@bitscol.com or reply in the tester chat.

Privacy: 100% on-device. No account. BITSCOL · www.bitscol.com · +8801711853769
```

## Store listing (short)

See `docs/STORE-LISTING.md` for full Play text, screenshots spec, and feature graphic.
