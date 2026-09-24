# Web licence keys via Merchant of Record (MoR)

**Standing decisions:** one-time purchase · Android + web/PWA · 100% local · no accounts · closed source.  
Play handles Android. **Web buyers** need a MoR that can take cards (and ideally local methods) and deliver a **licence key** the app verifies offline.

Product id (web): `personal-crm-pro`  
Key format: `PCRM1-<payload>-<hmac>` (minted offline with the existing `issueLicenseKey` pepper).

---

## Why a MoR (not Stripe direct)

BITSCOL is in **Bangladesh**. Stripe (and many PSPs) do not onboard BD merchants cleanly. A MoR is the seller of record: they charge the customer, handle VAT/tax, pay you out, and you deliver the key.

## Shortlist (2026)

| Provider | Fit | Notes |
|---|---|---|
| **Lemon Squeezy** | Strong default | One-time products, license keys built-in, EU MoR, decent payouts |
| **Paddle** | Strong | Classic MoR, invoices, tax; slightly heavier onboarding |
| **Gumroad** | Simple | Fast to list; weaker “license key” automation unless you use pings |
| **Dodo Payments** | Worth a look | Emerging; check BD payout + one-time support before committing |

Pick **one**. Do not wire three. Lemon Squeezy or Paddle first.

---

## Recommended flow (no BITSCOL backend)

```
Customer pays MoR (one-time “Personal CRM Pro”)
        ↓
MoR emails the buyer a licence key  (or shows it on the thank-you page)
        ↓
Buyer opens web app / PWA → /#/pro → paste key → offline HMAC verify
        ↓
pcrm-license written locally (source:'key') — same Pro as Play
```

**You never run a licence server.** Keys are minted by you (or a tiny offline tool) and either:

- **A.** Pre-generated pool uploaded into the MoR “license key” field, or  
- **B.** Generated on demand by a **manual** step when a sale email arrives (fine at low volume), or  
- **C.** MoR webhook → a **future** optional cloud function (explicitly out of scope until you want it; breaks pure local-only ops).

For launch, **A or B** is enough.

---

## Minting keys (owner machine only)

The app already ships `issueLicenseKey` (dev mint on Pro with `?dev=1` / `pcrm-dev=1`). For stock:

```bash
# From a trusted machine with the repo (never commit a bulk list of live keys)
node -e "
// Prefer the in-app mint on Pro screen with ?dev=1, or a one-off script that
// imports the same pepper: bitscol-personal-crm/\${BRAND.app}/v1/lifetime
"
```

Practical launch process:

1. On a private machine, open the built app with `localStorage.pcrm-dev = '1'`.
2. Pro screen → mint N keys (copy each).  
3. Store them in a **password manager** sheet: `key | status | sold_to | order_id | date`.
4. Upload unused keys into Lemon/Paddle license pool **or** paste one into each fulfilment email.

Pepper (must stay private to BITSCOL builds):

```
bitscol-personal-crm/<appName>/v1/lifetime
```

If the pepper ever leaks, mint a `PCRM2-` generation and accept both during a transition — not needed at v1.

---

## MoR product setup checklist

- [ ] Product name: **Personal CRM Pro (Lifetime)**
- [ ] Type: **One-time** (not subscription)
- [ ] Price: match Play (or web parity ± local tax)
- [ ] Description: same honesty as store listing — on-device, no account, no sub
- [ ] Thank-you / receipt: include  
  `Your licence key: PCRM1-…`  
  `Redeem at https://deshiklab.github.io/Personal.CRM/#/pro`  
  `Keep this email — the key is the unlock.`
- [ ] Support email: **sales@bitscol.com**
- [ ] Refund policy: e.g. 14 days if key unused (honour manually; revoke = don’t re-issue, buyer can still use a kept key — be aware offline keys can’t be remotely killed without a blocklist)

### Offline revoke reality

A pure offline HMAC key **cannot be revoked** on devices that already redeemed it. Mitigations:

- Don’t publish the pepper  
- Rate-limit how many keys you mint  
- For abuse, ship a future app update with a small blocklist of payload hashes (optional, rare)

---

## Listing copy (web checkout)

**Title:** Personal CRM Pro — Lifetime  

**Blurb:**

```
One-time unlock for Personal CRM by BITSCOL.
• Device reminders, unlimited contacts, automatic backups, advanced analytics
• Redeem with a licence key — verified on your device, no account
• Works in the browser / installed PWA; Android users can also buy on Google Play

After payment you’ll receive a key like PCRM1-…. Open the app → Pro → paste key.
```

---

## Ops when a sale lands

1. MoR email / dashboard → note order id + buyer email  
2. If keys are auto-delivered, mark row **sold** in your sheet  
3. If manual: mint or pick next key → email buyer (template below)  
4. Optional: BCC sales@bitscol.com for your records  

### Buyer email template

```
Subject: Your Personal CRM Pro licence key

Hi {{name}},

Thank you for supporting BITSCOL.

Your lifetime licence key:

PCRM1-................................

How to unlock
1. Open https://deshiklab.github.io/Personal.CRM/
2. Go to Pro (sidebar)
3. Paste the key → Unlock

The unlock stays on that device. After a reinstall, paste the same key again
(or use Restore on the Android app if you bought on Google Play).

Questions: sales@bitscol.com · www.bitscol.com · +8801711853769

— BITSCOL
```

---

## What we will not build (for now)

- Server-side key issuance API  
- Account login to “fetch my seats”  
- Automatic MoR webhook fulfilment (nice later; not required for launch)

---

## Link from the app

Pro screen already accepts keys. Optional later: a “Buy on the web” URL button pointing at the MoR product page — add when the storefront URL is live (`BRAND.proWebUrl` or similar).
