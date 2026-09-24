/* ═════════════════════════════════════════════════════════════════════════════
 * Entitlements — what this install is allowed to do.
 *
 * Commercial model (standing decision):
 *   · one-time purchase, no subscription
 *   · Android via Play Billing (non-consumable)  — @capgo/native-purchases
 *   · Web/PWA via a licence key from a Merchant of Record  — wired later
 *   · 100% offline verification once unlocked (no account, no phone-home)
 *
 * Until a real purchase is recorded the install runs as FREE. Free is the
 * full CRM for a small network; Pro unlocks the additive power features
 * listed in PRO_FEATURES. We never hold the user's own data hostage.
 *
 * The unlock record lives in its own storage key (not inside pcrm-v1) so a
 * factory reset of CRM data does not wipe a paid licence, and a licence
 * never rides along inside a backup someone might share.
 * ═════════════════════════════════════════════════════════════════════════════ */

import * as storage from './storage'
import { BRAND } from '../brand'

export const LICENSE_KEY = 'pcrm-license'
export const PRODUCT_ID_PLAY = 'personal_crm_pro_lifetime'
export const PRODUCT_ID_WEB  = 'personal-crm-pro'

/** Free-tier caps. Soft limits — Pro removes them. */
export const FREE_LIMITS = {
  contacts: 75,
  snapshots: 3,
  historyDays: 90,
  analyticsDays: 30,
}

/**
 * Features that require Pro. Keys are stable IDs used by `can()` and the
 * Pro screen. Anything not listed here is free forever.
 */
export const PRO_FEATURES = {
  reminders: {
    id: 'reminders',
    name: 'Reminders & notifications',
    blurb: 'Local nudges for follow-ups, tasks and birthdays — on this device only.',
  },
  unlimited_contacts: {
    id: 'unlimited_contacts',
    name: 'Unlimited contacts',
    blurb: `Free covers up to ${FREE_LIMITS.contacts}. Pro removes the cap.`,
  },
  auto_snapshots: {
    id: 'auto_snapshots',
    name: 'Automatic rolling backups',
    blurb: 'Snapshots after every burst of edits, not only when you tap the button.',
  },
  drive_autosync: {
    id: 'drive_autosync',
    name: 'Drive / Gist auto-sync',
    blurb: 'Background multi-device sync on a schedule. Manual backup stays free.',
  },
  advanced_analytics: {
    id: 'advanced_analytics',
    name: 'Advanced analytics',
    blurb: 'Longer windows, exportable charts, deeper relationship stats.',
  },
  graph_export: {
    id: 'graph_export',
    name: 'Network graph export',
    blurb: 'Export the graph as SVG/PNG for slides and reviews.',
  },
  themes: {
    id: 'themes',
    name: 'Extra themes',
    blurb: 'Additional colour themes beyond light and dark.',
  },
  unlimited_history: {
    id: 'unlimited_history',
    name: 'Unlimited history',
    blurb: `Free keeps ${FREE_LIMITS.historyDays} days of activity. Pro keeps it all.`,
  },
}

export const PRO_FEATURE_LIST = Object.values(PRO_FEATURES)

/* ── licence record shape ───────────────────────────────────────────────────
 * {
 *   tier: 'free' | 'pro',
 *   source: 'play' | 'key' | 'comp' | null,
 *   productId: string | null,
 *   licenseKey: string | null,   // web key, never a Play token
 *   unlockedAt: ISO string | null,
 *   deviceId: string | null,
 *   // offline verification payload (filled when billing is wired)
 *   proof: string | null,
 * }
 * ────────────────────────────────────────────────────────────────────────── */

export const blankLicense = () => ({
  tier: 'free',
  source: null,
  productId: null,
  licenseKey: null,
  unlockedAt: null,
  deviceId: null,
  proof: null,
})

export function readLicense() {
  try {
    const raw = storage.getItem(LICENSE_KEY)
    if (!raw) return blankLicense()
    const j = JSON.parse(raw)
    if (!j || typeof j !== 'object') return blankLicense()
    return { ...blankLicense(), ...j, tier: j.tier === 'pro' ? 'pro' : 'free' }
  } catch {
    return blankLicense()
  }
}

export function writeLicense(lic) {
  const next = { ...blankLicense(), ...lic }
  storage.setItem(LICENSE_KEY, JSON.stringify(next))
  return next
}

export function clearLicense() {
  storage.removeItem(LICENSE_KEY)
  return blankLicense()
}

export const isPro = (lic = readLicense()) => lic?.tier === 'pro'

/** Feature gate. Free features (anything not in PRO_FEATURES) always pass. */
export function can(featureId, lic = readLicense()) {
  if (!PRO_FEATURES[featureId]) return true
  return isPro(lic)
}

export function contactCap(lic = readLicense()) {
  return isPro(lic) ? Infinity : FREE_LIMITS.contacts
}

export function snapshotCap(lic = readLicense()) {
  return isPro(lic) ? Infinity : FREE_LIMITS.snapshots
}

/* ── web licence keys ───────────────────────────────────────────────────────
 * Format (v1, offline-verifiable without a server):
 *   PCRM1-<payload_b64url>-<sig_b64url>
 * payload = JSON { v:1, pid, email?, iat, exp? }
 * sig     = HMAC-SHA256(payload_bytes, APP_PEPPER) truncated
 *
 * The pepper is public-in-the-binary (honest offline apps can't hide secrets).
 * It stops casual key forgery; a determined cracker can still patch `isPro`.
 * That is accepted — we optimise for honest buyers (see commercial plan).
 * ───────────────────────────────────────────────────────────────────────── */

const PEPPER = `bitscol-personal-crm/${BRAND.app}/v1/lifetime`

const b64url = bytes => {
  let s
  if (typeof bytes === 'string') s = btoa(bytes)
  else {
    let bin = ''
    bytes.forEach(b => { bin += String.fromCharCode(b) })
    s = btoa(bin)
  }
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
const unb64url = s => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  return atob(b64)
}

async function hmacSign(message) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(PEPPER), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return b64url(new Uint8Array(sig)).slice(0, 22)
}

/**
 * Verify a web licence key offline.
 * @returns {{ ok: true, payload } | { ok: false, reason: string }}
 */
export async function verifyLicenseKey(key) {
  /* Do NOT uppercase the whole key — payload is base64url and case-sensitive. */
  const raw = String(key || '').trim()
  if (!raw) return { ok: false, reason: 'Paste a licence key to unlock Pro.' }
  const m = raw.match(/^PCRM1-([A-Za-z0-9_-]+)-([A-Za-z0-9_-]+)$/i)
  if (!m) return { ok: false, reason: 'That does not look like a Personal CRM key (PCRM1-…).' }
  const [, payloadB64, sig] = m
  let payload
  try {
    payload = JSON.parse(unb64url(payloadB64))
  } catch {
    return { ok: false, reason: 'Key payload is damaged.' }
  }
  if (payload.v !== 1) return { ok: false, reason: 'Unsupported key version.' }
  if (payload.pid && payload.pid !== PRODUCT_ID_WEB && payload.pid !== PRODUCT_ID_PLAY) {
    return { ok: false, reason: 'Key is for a different product.' }
  }
  if (payload.exp && Date.now() > Number(payload.exp)) {
    return { ok: false, reason: 'This key has expired.' }
  }
  const expect = await hmacSign(payloadB64)
  if (expect.toUpperCase() !== sig.toUpperCase()) {
    return { ok: false, reason: 'Key signature does not match — check for typos.' }
  }
  return { ok: true, payload }
}

/** Issue a key (dev / support tool). Not shown in the UI. */
export async function issueLicenseKey({ email = '', days = null } = {}) {
  const payload = {
    v: 1,
    pid: PRODUCT_ID_WEB,
    email: String(email || '').toLowerCase() || undefined,
    iat: Date.now(),
    exp: days ? Date.now() + days * 864e5 : undefined,
  }
  const payloadB64 = b64url(JSON.stringify(payload))
  const sig = await hmacSign(payloadB64)
  return `PCRM1-${payloadB64}-${sig}`
}

/**
 * Activate Pro from a verified web key.
 * @returns the new licence record
 */
export async function activateWithKey(key, { deviceId } = {}) {
  const v = await verifyLicenseKey(key)
  if (!v.ok) throw new Error(v.reason)
  return writeLicense({
    tier: 'pro',
    source: 'key',
    productId: v.payload.pid || PRODUCT_ID_WEB,
    licenseKey: String(key).trim(),
    unlockedAt: new Date().toISOString(),
    deviceId: deviceId || null,
    proof: v.payload.email || null,
  })
}

/** Activate Pro as a complimentary unlock (support / beta). */
export function activateComp({ reason = 'comp', deviceId } = {}) {
  return writeLicense({
    tier: 'pro',
    source: 'comp',
    productId: PRODUCT_ID_WEB,
    licenseKey: null,
    unlockedAt: new Date().toISOString(),
    deviceId: deviceId || null,
    proof: reason,
  })
}

/**
 * Restore a Play lifetime purchase. Delegates to lib/billing so the Pro
 * screen and store share one code path. Returns the new licence, or null
 * when nothing was restored (web / no purchase / error).
 */
export async function restorePlayPurchase(opts = {}) {
  try {
    const billing = await import('./billing')
    const r = await billing.restorePurchases(opts)
    return r?.ok ? r.license : null
  } catch {
    return null
  }
}

/** Activate Pro from a verified Play transaction (used by billing.purchasePro). */
export function activateFromPlay(tx = {}, { deviceId } = {}) {
  return writeLicense({
    tier: 'pro',
    source: 'play',
    productId: tx.productIdentifier || PRODUCT_ID_PLAY,
    licenseKey: null,
    unlockedAt: tx.purchaseDate || new Date().toISOString(),
    deviceId: deviceId || null,
    proof: tx.transactionId || tx.purchaseToken || null,
    play: {
      transactionId: tx.transactionId || null,
      purchaseToken: tx.purchaseToken || null,
      purchaseState: tx.purchaseState ?? null,
      acknowledged: tx.isAcknowledged ?? true,
    },
  })
}

/** Human label for the current tier. */
export function tierLabel(lic = readLicense()) {
  if (lic.tier === 'pro') {
    if (lic.source === 'play') return 'Pro · Play'
    if (lic.source === 'key') return 'Pro · licence key'
    if (lic.source === 'comp') return 'Pro · complimentary'
    return 'Pro'
  }
  return 'Free'
}
