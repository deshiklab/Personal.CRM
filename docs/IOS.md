# iOS shell (Capacitor)

**Bundle id:** `com.bitscol.personalcrm`  
**Display name:** Personal CRM  
**Version:** 2.0.0 · build 4 (align with Android `versionName` / bump `CURRENT_PROJECT_VERSION` each upload)  
**Min iOS:** 15.0  
**Plugins:** Preferences · Local Notifications · Capgo Social Login · Capgo Native Purchases (StoreKit 2)

## What this is

The same single-file web app runs inside a native WKWebView. Data stays on-device (`@capacitor/preferences`). Pro unlocks via **StoreKit** (same product id as Play) or a **PCRM1** licence key.

This Linux CI environment cannot run Xcode — you open the project on a Mac.

## One-time Mac setup

1. Install **Xcode 16+** (App Store) and accept the license.
2. Install CocoaPods if SPM resolution fails: `sudo gem install cocoapods` (Capacitor 8 prefers SPM).
3. Clone the repo, then:

```bash
npm ci
npm run ios:sync          # build web → copy into ios/App/App/public → update plugins
npm run ios:open          # opens ios/App/App.xcworkspace or .xcodeproj in Xcode
```

4. In Xcode:
   - **Signing & Capabilities** → your Team · automatically manage signing  
   - Bundle Identifier stays `com.bitscol.personalcrm`  
   - Add capability **In-App Purchase**  
   - Add capability **Push Notifications** only if you later use remote pushes (local notifications work without it)  
   - Run on a simulator or device

## App Store Connect

1. Create app **Personal CRM** with bundle id `com.bitscol.personalcrm`.
2. **Monetization → In-App Purchases → Non-Consumable**
   - Product ID: **`personal_crm_pro_lifetime`** (must match Play / `PRODUCT_ID_PLAY`)
   - Reference name: Personal CRM Pro (Lifetime)
   - Price tier: same commercial price as Play
3. Attach the IAP to the app version before submit.
4. Privacy policy URL: `https://deshiklab.github.io/Personal.CRM/privacy.html`
5. Categories: Productivity / Business. Age rating: no user-generated public content.

## StoreKit testing

- Xcode → **StoreKit Configuration** file (optional local `.storekit`) with product `personal_crm_pro_lifetime`, or  
- Sandbox Apple ID under Settings → App Store on a device  
- **Restore purchases** on the Pro screen re-queries StoreKit and writes `source: 'appstore'`

## Google Sign-In on iOS (optional)

Social Login is already linked. For live Google:

1. Google Cloud → OAuth client type **iOS** · bundle `com.bitscol.personalcrm`
2. Keep using the **Web** client id in Settings → Google hub (Capgo online mode), or configure the iOS client per Capgo docs.
3. Add any required URL schemes to `Info.plist` when you enable it.

## Scripts

| npm script | Does |
|---|---|
| `ios:sync` | `vite build` + `cap sync ios` |
| `ios:open` | open Xcode project |
| `cap:sync` | build + sync **android and ios** |
| `android:sync` | Android only (unchanged) |

## Permissions (Info.plist)

| Key | Why |
|---|---|
| `NSCameraUsageDescription` | Visiting-card OCR |
| `NSPhotoLibraryUsageDescription` | Contact / card photos |
| `NSPhotoLibraryAddUsageDescription` | Optional save-out |

## What is *not* automated here

- Apple Developer Program enrollment ($99/yr)  
- App Store screenshots / review notes (reuse `docs/store-assets` + device shots)  
- TestFlight groups  
- Actual `.ipa` signing (needs your team certs on a Mac)

## Related

- `docs/PLAY-BILLING.md` — Android product (same id)  
- `docs/OPS-LAUNCH.md` — master launch  
- `src/lib/billing.js` — Play + StoreKit via Capgo  
