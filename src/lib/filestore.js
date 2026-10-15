/* Blob storage for the Files module — one API, three backends:
 *   1. Capacitor Filesystem (Android)  — app dir PersonalCRM/files/<id>
 *   2. IndexedDB (web)                 — db pcrm-files, store blobs
 *   3. In-memory fallback              — tests / private-mode browsers
 * The file *index* (metadata) lives in the main store and syncs; the blobs
 * themselves never leave the device that holds them, unless transferred. */
import { isNative } from './google'

const DB_NAME = 'pcrm-files'
const STORE = 'blobs'

let memory = new Map()
let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    } catch { resolve(null) }
  })
  return dbPromise
}

export const storageBackend = () => {
  if (isNative()) return 'filesystem'
  return typeof indexedDB !== 'undefined' ? 'indexeddb' : 'memory'
}

/* ── file storage location (user-selectable) ──
 * On Android the blobs can live in one of three roots; on the web they are
 * always browser-local (IndexedDB). The choice is read from the store's
 * `filesPrefs.location` at call time — no boot wiring, never stale. */
export const FILE_LOCATIONS = [
  { key: 'data', nativeDir: 'Data', label: 'App private storage',
    where: 'Android/data/com.bitscol.personalcrm/…/files',
    note: 'Private to the app. Removed when the app is uninstalled.' },
  { key: 'documents', nativeDir: 'Documents', label: 'Documents folder',
    where: 'Documents/PersonalCRM/files',
    note: 'Visible in the Files app, easy to copy or back up, survives uninstall.' },
  { key: 'external', nativeDir: 'External', label: 'External app storage',
    where: 'Android/media/com.bitscol.personalcrm/…/files',
    note: 'Shared-storage side of the app — visible to file managers and gallery apps.' },
]

export function fileLocationKey() {
  try {
    const raw = localStorage.getItem('pcrm-v1')
    if (raw) {
      const k = JSON.parse(raw)?.filesPrefs?.location
      if (k && FILE_LOCATIONS.some(l => l.key === k)) return k
    }
  } catch { /* fall through */ }
  return 'data'
}

export const fileLocationInfo = (key = fileLocationKey()) =>
  FILE_LOCATIONS.find(l => l.key === key) || FILE_LOCATIONS[0]

/* property name into the plugin's `Directory` enum (kept lazy — web builds
 * never touch the native module) */
export const nativeDirEnum = (key = fileLocationKey()) => fileLocationInfo(key).nativeDir

/* ── native bridge ── */
const fsNative = async () => {
  const mod = await import('@capacitor/filesystem')
  return mod
}

export async function saveBlob(id, data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(await data.arrayBuffer?.() ?? data)
  if (isNative()) {
    const { Filesystem, Directory, Encoding } = await fsNative()
    const directory = Directory[nativeDirEnum()]
    try { await Filesystem.mkdir({ path: 'files', directory, recursive: true }) } catch { /* exists */ }
    await Filesystem.writeFile({
      path: `files/${id}`,
      data: b64FromBytes(bytes),
      directory,
      encoding: Encoding.Base64,
    })
    return id
  }
  const db = await openDb()
  if (!db) { memory.set(id, bytes); return id }
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(bytes, id)
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error)
  })
  return id
}

export async function readBlob(id) {
  if (isNative()) {
    const { Filesystem, Directory, Encoding } = await fsNative()
    const order = [fileLocationKey(), ...FILE_LOCATIONS.map(l => l.key).filter(k => k !== fileLocationKey())]
    for (const key of order) {
      try {
        const res = await Filesystem.readFile({ path: `files/${id}`, directory: Directory[nativeDirEnum(key)], encoding: Encoding.Base64 })
        return bytesFromB64(res.data)
      } catch { /* try the next root */ }
    }
    return null
  }
  const db = await openDb()
  if (!db) return memory.get(id) || null
  return new Promise(resolve => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => resolve(null)
  })
}

export async function deleteBlob(id) {
  if (isNative()) {
    const { Filesystem, Directory } = await fsNative()
    for (const l of FILE_LOCATIONS) {
      try { await Filesystem.deleteFile({ path: `files/${id}`, directory: Directory[l.nativeDir] }) } catch { /* already gone */ }
    }
    return
  }
  memory.delete(id)
  const db = await openDb()
  if (!db) return
  await new Promise(resolve => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = resolve; tx.onerror = resolve
  })
}

/* read → Blob (what download/share APIs want) */
export async function readBlobAsBlob(meta) {
  const bytes = await readBlob(meta.id)
  if (!bytes) return null
  return new Blob([bytes], { type: meta.mime || 'application/octet-stream' })
}

/* Move existing blobs into the currently-selected location.
 * Read uses the fallback chain (finds each blob wherever it lives), then
 * writes to the target root and cleans the others. Web/IndexedDB: no-op. */
export async function migrateBlobs(ids, onProgress) {
  const target = fileLocationKey()
  if (storageBackend() !== 'filesystem') return { moved: ids.length, failed: 0 }
  const { Filesystem, Directory, Encoding } = await fsNative()
  const targetDir = Directory[nativeDirEnum(target)]
  try { await Filesystem.mkdir({ path: 'files', directory: targetDir, recursive: true }) } catch { /* exists */ }
  let moved = 0, failed = 0
  for (const [i, id] of ids.entries()) {
    try {
      const bytes = await readBlob(id)          // fallback chain — finds old location
      if (!bytes) { failed++; continue }
      await Filesystem.writeFile({
        path: `files/${id}`, data: b64FromBytes(bytes),
        directory: targetDir, encoding: Encoding.Base64,
      })
      for (const l of FILE_LOCATIONS) {
        if (l.key === target) continue
        try { await Filesystem.deleteFile({ path: `files/${id}`, directory: Directory[l.nativeDir] }) } catch { /* fine */ }
      }
      moved++
    } catch { failed++ }
    onProgress?.(i + 1, ids.length)
  }
  return { moved, failed }
}

/* ── base64 helpers (chunked — safe for big buffers) ── */
export function b64FromBytes(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  }
  return btoa(s)
}
export function bytesFromB64(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/* ── formatting helper for the UI ── */
export function fmtSize(n) {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
