/* ═════════════════════════════════════════════════════════════════════════════
 * Device storage — one API, two backends.
 *
 * Browser / PWA  → plain localStorage (same keys the probes already poke).
 * Android (Capacitor native) → @capacitor/preferences, which lives outside the
 *   WebView's localStorage so an app update, cache clear or WebView reset
 *   cannot wipe the user's CRM. On first native boot we copy any leftover
 *   localStorage keys into Preferences and then leave them alone.
 *
 * Reads after `hydrate()` are synchronous (in-memory cache). Writes update
 * the cache immediately and flush to the backend; callers that must wait for
 * the flush (factory reset, crash-screen snapshot restore) can `await` the
 * returned promise.
 * ═════════════════════════════════════════════════════════════════════════════ */

import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

let backend = 'ls'          // 'ls' | 'native'
let ready = false
const cache = new Map()     // key → string | null
const pending = new Map()   // key → latest write promise (coalesce)

const safeLS = fn => { try { return fn() } catch { return null } }

const lsGet = k => safeLS(() => localStorage.getItem(k))
const lsSet = (k, v) => safeLS(() => { localStorage.setItem(k, v); return true }) || false
const lsDel = k => safeLS(() => { localStorage.removeItem(k); return true }) || false

const nativeGet = async k => {
  const { value } = await Preferences.get({ key: k })
  return value
}
const nativeSet = async (k, v) => { await Preferences.set({ key: k, value: v }) }
const nativeDel = async k => { await Preferences.remove({ key: k }) }

/** Keys the app owns. Used for migration + full wipe. */
export const OWNED_KEYS = [
  'pcrm-v1',
  'pcrm-theme',
  'pcrm-snapshots',
  'pcrm-secret-gist',
  'pcrm-last-error',
  'pcrm-dev',
  'pcrm-license',
]

/**
 * Load every owned key into the cache. Must run once before the React tree
 * mounts. Safe to call more than once; subsequent calls are no-ops.
 */
export async function hydrate() {
  if (ready) return { backend }
  backend = (Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform())
    ? 'native' : 'ls'

  if (backend === 'native') {
    /* pull from Preferences first */
    await Promise.all(OWNED_KEYS.map(async k => {
      try {
        const v = await nativeGet(k)
        if (v != null) cache.set(k, v)
      } catch { /* leave absent */ }
    }))

    /* one-shot migration: anything still sitting in WebView localStorage that
     * Preferences does not yet hold is copied across. We do not delete the
     * WebView copy — a later factory reset clears both. */
    for (const k of OWNED_KEYS) {
      if (cache.has(k)) continue
      const legacy = lsGet(k)
      if (legacy == null) continue
      cache.set(k, legacy)
      try { await nativeSet(k, legacy) } catch {}
    }
  } else {
    for (const k of OWNED_KEYS) {
      const v = lsGet(k)
      if (v != null) cache.set(k, v)
    }
  }

  ready = true
  return { backend }
}

export const isReady = () => ready
export const getBackend = () => backend

/**
 * Synchronous read against the hydrated cache.
 * Falls back to localStorage so a probe that writes a key mid-test (and the
 * rare pre-hydrate read) still sees the live value without waiting for a
 * re-hydrate.
 */
export function getItem(key) {
  /* always prefer a fresh localStorage value when one exists — probes (and the
   * user, via DevTools) may have written underneath us between renders */
  if (backend !== 'native') {
    const live = lsGet(key)
    if (live != null) { cache.set(key, live); return live }
    if (cache.has(key)) return cache.get(key)
    return null
  }
  if (cache.has(key)) return cache.get(key)
  const live = lsGet(key)
  if (live != null) { cache.set(key, live); return live }
  return null
}

/** Write-through. Returns a promise that settles when the backend has it. */
export function setItem(key, value) {
  const str = String(value)
  cache.set(key, str)
  /* always mirror to localStorage so probes that read localStorage directly
   * (and the web path) keep working. On native this is a cheap secondary copy. */
  lsSet(key, str)
  const job = (async () => {
    if (backend === 'native') {
      try { await nativeSet(key, str) } catch { /* secondary copy already written */ }
    }
  })()
  pending.set(key, job)
  return job
}

export function removeItem(key) {
  cache.delete(key)
  lsDel(key)
  const job = (async () => {
    if (backend === 'native') {
      try { await nativeDel(key) } catch {}
    }
  })()
  pending.set(key, job)
  return job
}

/** Drop every owned key from cache + both backends. */
export async function clearOwned() {
  for (const k of OWNED_KEYS) cache.delete(k)
  if (backend === 'native') {
    await Promise.all(OWNED_KEYS.map(k => nativeDel(k).catch(() => {})))
  }
  for (const k of OWNED_KEYS) lsDel(k)
}

/** Wait for every in-flight write to land (used before a hard reload). */
export async function flush() {
  const jobs = [...pending.values()]
  pending.clear()
  await Promise.allSettled(jobs)
}

/* ── tiny helpers used by the rest of the app ─────────────────────────────── */
export const getJSON = (key, fallback = null) => {
  const raw = getItem(key)
  if (raw == null) return fallback
  try { return JSON.parse(raw) } catch { return fallback }
}

export const setJSON = (key, value) => {
  try { return setItem(key, JSON.stringify(value)) }
  catch { return Promise.resolve(false) }
}
