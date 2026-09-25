# Play Billing setup — Personal CRM Pro

Product id (must match the app exactly):

```
personal_crm_pro_lifetime
```

## Play Console checklist

1. **App** → `com.bitscol.personalcrm` (already the applicationId).
2. **Monetize with Play → Products → In-app products → Create product**
   - Product ID: `personal_crm_pro_lifetime`
   - Name: Personal CRM Pro (Lifetime)
   - Description: One-time unlock — reminders, unlimited contacts, automatic backups, advanced analytics. No subscription.
   - Type: **Managed product / one-time** (non-consumable)
   - Default price: set your one-time price (e.g. USD 9.99 / local equivalent)
   - Activate the product
3. **License testers** (Setup → License testing): add Gmail accounts that will sandbox-buy without being charged.
4. **Closed testing** track: upload a release AAB that includes this build, add 15–16 testers, start the 14-day clock.
5. On device: install from the testing track (not a sideload) so Play Billing can resolve the product.

## In the app

- Pro screen (`/#/pro`) shows **Buy on Play** when `isBillingSupported()` is true (Android + Play Store).
- **Restore purchases** re-queries owned INAPP products and rewrites the local `pcrm-license` record.
- On every cold start the app silently syncs Play ownership; it never downgrades a web-key unlock.

## Web / PWA

Play Billing is unavailable. Users unlock with a **licence key** (`PCRM1-…`) sold via a Merchant of Record.

## Notes

- No server-side token verification (local-first). Purchase token is stored on-device as proof for support.
- `com.android.vending.BILLING` is declared in `AndroidManifest.xml`.

## iOS / StoreKit

Same product id on App Store Connect (non-consumable): `personal_crm_pro_lifetime`.  
See `docs/IOS.md`. Billing code path is shared (`src/lib/billing.js`); licence `source` is `appstore` on iOS.
