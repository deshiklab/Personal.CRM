/* ═════════════════════════════════════════════════════════════════════════════
 * Native store billing — lifetime Pro unlock.
 *
 * Uses @capgo/native-purchases:
 *   · Android → Google Play Billing
 *   · iOS     → StoreKit 2
 * Web/PWA has neither store, so every call degrades cleanly: isAvailable() →
 * false, and the Pro screen keeps the licence-key path as the web unlock.
 *
 * Product: non-consumable one-time INAPP / non-consumable IAP
 *   id = PRODUCT_ID_PLAY  (personal_crm_pro_lifetime) — same id on both stores
 *
 * Offline-first: once purchased we write a local licence (source:'play' |
 * 'appstore') and trust it. Honest buyers restore via the store account.
 * ═════════════════════════════════════════════════════════════════════════════ */

import { Capacitor } from '@capacitor/core'
import {
  PRODUCT_ID_PLAY, writeLicense, readLicense, isPro, blankLicense,
} from './entitlements'

let NativePurchases = null
let PURCHASE_TYPE = null
let loadPromise = null

const nativePlatform = () => {
  try {
    if (!Capacitor?.isNativePlatform?.()) return null
    const p = Capacitor.getPlatform?.()
    return (p === 'android' || p === 'ios') ? p : null
  } catch { return null }
}
const isNativeAndroid = () => nativePlatform() === 'android'
const isNativeIos = () => nativePlatform() === 'ios'
const isNativeStore = () => !!nativePlatform()

async function loadPlugin() {
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    if (!isNativeStore()) return null
    try {
      const mod = await import('@capgo/native-purchases')
      NativePurchases = mod.NativePurchases
      PURCHASE_TYPE = mod.PURCHASE_TYPE
      return mod
    } catch (e) {
      console.warn('[billing] native-purchases unavailable', e)
      return null
    }
  })()
  return loadPromise
}

const licenseSource = () => (isNativeIos() ? 'appstore' : 'play')

/** True on Android/iOS when the store billing API is reachable. */
export async function isBillingAvailable() {
  if (!isNativeStore()) return false
  const mod = await loadPlugin()
  if (!mod) return false
  try {
    const r = await NativePurchases.isBillingSupported()
    return !!r?.isBillingSupported
  } catch {
    return false
  }
}

/**
 * Fetch the Play product for the Pro lifetime unlock.
 * @returns {Promise<null | { id, title, description, price, priceString, currencyCode, raw }>}
 */
export async function getProProduct() {
  const ok = await isBillingAvailable()
  if (!ok) return null
  try {
    const { products } = await NativePurchases.getProducts({
      productIdentifiers: [PRODUCT_ID_PLAY],
      productType: PURCHASE_TYPE.INAPP,
    })
    const p = (products || []).find(x => x.identifier === PRODUCT_ID_PLAY) || products?.[0]
    if (!p) return null
    return {
      id: p.identifier,
      title: p.title || 'Personal CRM Pro',
      description: p.description || 'Lifetime unlock',
      price: p.price,
      priceString: p.priceString || (p.price != null ? String(p.price) : ''),
      currencyCode: p.currencyCode || '',
      raw: p,
    }
  } catch (e) {
    console.warn('[billing] getProducts failed', e)
    return null
  }
}

const transactionToLicense = (tx, { deviceId } = {}) => writeLicense({
  tier: 'pro',
  source: licenseSource(),
  productId: tx?.productIdentifier || PRODUCT_ID_PLAY,
  licenseKey: null,
  unlockedAt: tx?.purchaseDate || new Date().toISOString(),
  deviceId: deviceId || null,
  proof: tx?.transactionId || tx?.purchaseToken || null,
  play: {
    /* Android shape; iOS fills the same fields for support */
    transactionId: tx?.transactionId || null,
    purchaseToken: tx?.purchaseToken || null,
    purchaseState: tx?.purchaseState ?? null,
    acknowledged: tx?.isAcknowledged ?? true,
  },
  store: isNativeIos() ? 'appstore' : 'play',
})

const isOwnedTx = tx => {
  if (!tx) return false
  /* Android: purchaseState "PURCHASED" or "1"; iOS one-shots have no state flag */
  const state = tx.purchaseState
  if (state != null && state !== 'PURCHASED' && state !== '1' && state !== 1) return false
  const id = tx.productIdentifier
  return !id || id === PRODUCT_ID_PLAY
}

/**
 * Launch the Play purchase sheet for the lifetime Pro product.
 * @returns {{ ok:true, license } | { ok:false, reason:string, code?:string }}
 */
export async function purchasePro({ deviceId } = {}) {
  const ok = await isBillingAvailable()
  if (!ok) {
    return {
      ok: false,
      reason: 'Store billing is only available inside the Android or iOS app.',
      code: 'unavailable',
    }
  }
  try {
    const tx = await NativePurchases.purchaseProduct({
      productIdentifier: PRODUCT_ID_PLAY,
      productType: PURCHASE_TYPE.INAPP,
      quantity: 1,
      autoAcknowledgePurchases: true,
    })
    if (!isOwnedTx(tx)) {
      return { ok: false, reason: 'Purchase did not complete.', code: 'incomplete' }
    }
    const license = transactionToLicense(tx, { deviceId })
    return { ok: true, license, transaction: tx }
  } catch (e) {
    const msg = String(e?.message || e)
    const cancelled = /cancel|user.?cancel|canceled/i.test(msg) || e?.code === 'USER_CANCELLED'
    return {
      ok: false,
      reason: cancelled ? 'Purchase cancelled.' : (msg || 'Purchase failed.'),
      code: cancelled ? 'cancelled' : 'error',
      error: e,
    }
  }
}

/**
 * Restore previously owned lifetime purchases for this Play account.
 * @returns {{ ok:true, license } | { ok:false, reason:string, code?:string }}
 */
export async function restorePurchases({ deviceId } = {}) {
  const ok = await isBillingAvailable()
  if (!ok) {
    /* web: nothing to restore from Play */
    if (isPro(readLicense())) {
      return { ok: true, license: readLicense(), code: 'already' }
    }
    return {
      ok: false,
      reason: 'Nothing to restore here. On Android/iOS open the store build and tap Restore. On the web, paste your licence key.',
      code: 'unavailable',
    }
  }
  try {
    /* sync with Play, then query owned one-time products */
    try { await NativePurchases.restorePurchases() } catch { /* some devices throw if empty */ }
    const { purchases } = await NativePurchases.getPurchases({
      productType: PURCHASE_TYPE.INAPP,
    })
    const owned = (purchases || []).filter(isOwnedTx)
    const match = owned.find(p => p.productIdentifier === PRODUCT_ID_PLAY) || owned[0]
    if (!match) {
      return {
        ok: false,
        reason: isNativeIos() ? 'No Pro purchase found on this Apple ID.' : 'No Pro purchase found on this Google account.',
        code: 'not_found',
      }
    }
    const license = transactionToLicense(match, { deviceId })
    return { ok: true, license, transaction: match }
  } catch (e) {
    return {
      ok: false,
      reason: String(e?.message || e) || 'Restore failed.',
      code: 'error',
      error: e,
    }
  }
}

/**
 * Silent boot check: if Play says we own Pro and local licence is free, unlock.
 * Never downgrades a key/comp unlock.
 */
export async function syncPlayEntitlement({ deviceId } = {}) {
  const current = readLicense()
  if (isPro(current) && current.source !== 'play' && current.source !== 'appstore') return current
  const ok = await isBillingAvailable()
  if (!ok) return current
  try {
    const { purchases } = await NativePurchases.getPurchases({
      productType: PURCHASE_TYPE.INAPP,
    })
    const match = (purchases || []).find(p => isOwnedTx(p) && p.productIdentifier === PRODUCT_ID_PLAY)
    if (!match) return current
    return transactionToLicense(match, { deviceId })
  } catch {
    return current
  }
}

export function billingPlatformLabel() {
  return nativePlatform() || 'web'
}

export { PRODUCT_ID_PLAY, blankLicense }
