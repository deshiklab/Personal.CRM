# Encrypted backup (PIN / passphrase)

**Where:** Settings → App lock card → **Encrypted backup…**  
**Restore:** Settings → **Restore from a data file…** (auto-detects `.pcrm.json`)

## What it is

A full CRM export locked with **AES-256-GCM**. The key is derived with **PBKDF2-SHA-256** (210 000 iterations) from:

- your **app pincode**, or  
- any **passphrase** (≥ 4 characters) you choose at export time.

Nothing is sent to BITSCOL. There is **no recovery** if you forget the passphrase.

## File shape

```json
{
  "app": "personal-crm",
  "format": "pcrm-enc-v1",
  "kdf": "PBKDF2-SHA-256",
  "iter": 210000,
  "salt": "<base64>",
  "iv": "<base64>",
  "ct": "<base64>",
  "hint": "app-pin",
  "exportedAt": "…"
}
```

Plain JSON backups (`app: personal-crm`, `data: { contacts: […] }`) still work.

## What is *not* inside

- Gist / Google tokens (secrets stay in a separate storage slot)  
- The licence unlock record (`pcrm-license`) — re-paste key or Restore Play after a wipe  

## Threat model (honest)

| Protects against | Does not protect against |
|---|---|
| Someone finding the file on a USB stick | Attacker with your unlocked phone |
| Casual snooping of a cloud folder | Forgotten passphrase (file is gone) |
| Emailing a backup to yourself | Weak 4-digit PIN offline brute force (use a long phrase for high stakes) |

For serious threats use a long passphrase and OS full-disk encryption.

## Code

- `src/lib/secureBackup.js` — encrypt / decrypt / detect  
- Settings UI in `AppLockCard`  
