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

/* ── native bridge ── */
const fsNative = async () => {
  const mod = await import('@capacitor/filesystem')
  return mod
}

export async function saveBlob(id, data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(await data.arrayBuffer?.() ?? data)
  if (isNative()) {
    const { Filesystem, Directory, Encoding } = await fsNative()
    await Filesystem.writeFile({
      path: `files/${id}`,
      data: b64FromBytes(bytes),
      directory: Directory.Data,
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
    try {
      const { Filesystem, Directory, Encoding } = await fsNative()
      const res = await Filesystem.readFile({ path: `files/${id}`, directory: Directory.Data, encoding: Encoding.Base64 })
      return bytesFromB64(res.data)
    } catch { return null }
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
    try {
      const { Filesystem, Directory } = await fsNative()
      await Filesystem.deleteFile({ path: `files/${id}`, directory: Directory.Data })
    } catch { /* already gone */ }
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
