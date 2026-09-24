/* ═════════════════════════════════════════════════════════════════════════════
 * Rolling local snapshots — the safety net under everything else.
 *
 * A local-first app has no server to recover from, so a mistake (a bad import,
 * a restore that went wrong, a wipe by accident) has to be recoverable on the
 * device. We keep a small ring of full snapshots:
 *   · one is taken shortly after each burst of edits, never more than
 *     MIN_GAP apart, and only when the data actually changed;
 *   · the ring is capped by count AND by total size, because local storage is
 *     finite (a few MB, not a few hundred);
 *   · snapshots hold the same shape as a backup file, so any snapshot can be
 *     restored through the ordinary restore path.
 * ═════════════════════════════════════════════════════════════════════════════ */

import * as storage from './storage'

const KEY = 'pcrm-snapshots'
const MAX_COUNT_FREE = 3
const MAX_COUNT_PRO = 12
const MAX_COUNT = 6  /* default; takeSnapshot opts can override */
const MAX_BYTES = 4 * 1024 * 1024   // trim the ring rather than exceed local storage
const MIN_GAP_MS = 45 * 1000        // never snapshot more than once per 45s of edits

const fnv = s => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return 'fnv:' + (h >>> 0).toString(16)
}

const read = () => {
  try { const v = JSON.parse(storage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : [] }
  catch { return [] }
}
const write = list => {
  try { storage.setItem(KEY, JSON.stringify(list)); return true }
  catch {
    /* out of room — drop the oldest until it fits (or give up quietly) */
    let l = list.slice()
    while (l.length > 1) {
      l = l.slice(0, -1)
      try { storage.setItem(KEY, JSON.stringify(l)); return true } catch {}
    }
    return false
  }
}

/** Metadata only — cheap enough to call while rendering. */
export const listSnapshots = () =>
  read().map(({ id, at, label, bytes, hash }) => ({ id, at, label, bytes, hash }))

/** The stored snapshot as a parsed object (the same shape as a backup file). */
export const readSnapshot = id => {
  const s = read().find(x => x.id === id)
  if (!s) return null
  try { return JSON.parse(s.json) } catch { return null }
}

export const latestSnapshotHash = () => (read()[0]?.hash || null)

/**
 * Store a snapshot of `data`.
 * @returns the snapshot record, or null when nothing worth storing happened.
 */
export const takeSnapshot = (data, label = 'auto', { force = false, maxCount = MAX_COUNT } = {}) => {
  if (!data) return null
  let json
  try { json = JSON.stringify(data) } catch { return null }
  const hash = fnv(json)
  const list = read()

  /* nothing changed since the last one — don't churn the ring */
  if (!force && list[0]?.hash === hash) return null
  /* too soon after the previous one (unless the caller insists) */
  if (!force && list[0]?.at && Date.now() - new Date(list[0].at).getTime() < MIN_GAP_MS) return null

  const rec = {
    id: `snap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    label, hash, bytes: json.length, json,
  }
  let next = [rec, ...list]

  /* trim: newest-first by count, then by total size */
  next = next.slice(0, Math.max(1, maxCount || MAX_COUNT))
  let total = next.reduce((n, s) => n + (s.bytes || 0), 0)
  while (next.length > 1 && total > MAX_BYTES) {
    const dropped = next.pop()
    total -= dropped.bytes || 0
  }
  write(next)
  return { id: rec.id, at: rec.at, label: rec.label, bytes: rec.bytes, hash: rec.hash }
}

export const deleteSnapshot = id => write(read().filter(s => s.id !== id))

export const clearSnapshots = () => write([])

export const snapshotStats = () => {
  const list = read()
  return { count: list.length, bytes: list.reduce((n, s) => n + (s.bytes || 0), 0), newest: list[0]?.at || null }
}

export const SNAPSHOT_LIMITS = { MAX_COUNT, MAX_BYTES, MIN_GAP_MS }
