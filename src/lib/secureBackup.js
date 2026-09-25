/* ═════════════════════════════════════════════════════════════════════════════
 * Encrypted backup — PIN / passphrase derived AES-GCM.
 *
 * Local-first: no server, no key escrow. If you forget the passphrase the
 * file is unreadable. The app lock PIN can be reused, or any longer phrase.
 *
 * Format (JSON, version 1):
 * {
 *   app: 'personal-crm',
 *   format: 'pcrm-enc-v1',
 *   kdf: 'PBKDF2-SHA-256',
 *   iter: 210000,
 *   salt: <b64>,
 *   iv: <b64>,
 *   ct: <b64>,           // AES-GCM ciphertext of UTF-8 JSON backup
 *   hint: optional string
 * }
 * Plain backups remain supported (app:'personal-crm', data:{…}).
 * ═════════════════════════════════════════════════════════════════════════════ */

const FORMAT = 'pcrm-enc-v1'
const ITER = 210_000
const enc = new TextEncoder()
const dec = new TextDecoder()

const b64 = (buf) => {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf
  let s = ''
  bytes.forEach(b => { s += String.fromCharCode(b) })
  return btoa(s)
}
const unb64 = (str) => {
  const bin = atob(str)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function deriveKey(passphrase, saltBytes, iter = ITER) {
  const base = await crypto.subtle.importKey(
    'raw', enc.encode(String(passphrase)), 'PBKDF2', false, ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: iter, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function isEncryptedBackup(obj) {
  return !!(obj && obj.format === FORMAT && obj.ct && obj.salt && obj.iv)
}

export function isPlainBackup(obj) {
  if (!obj || typeof obj !== 'object') return false
  const d = obj.data || obj
  return Array.isArray(d.contacts)
}

/**
 * @param {object|string} backupObject  plain backup object or JSON string
 * @param {string} passphrase
 * @param {{hint?:string}} [opts]
 * @returns {Promise<object>} encrypted envelope (JSON-serialisable)
 */
export async function encryptBackup(backupObject, passphrase, opts = {}) {
  if (!passphrase || String(passphrase).length < 4) {
    throw new Error('Passphrase must be at least 4 characters (use your app PIN or a longer phrase).')
  }
  if (!crypto?.subtle) throw new Error('Web Crypto is not available in this browser.')

  const plain = typeof backupObject === 'string'
    ? backupObject
    : JSON.stringify(backupObject)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt, ITER)
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plain),
  )
  return {
    app: 'personal-crm',
    format: FORMAT,
    kdf: 'PBKDF2-SHA-256',
    iter: ITER,
    salt: b64(salt),
    iv: b64(iv),
    ct: b64(ct),
    hint: opts.hint ? String(opts.hint).slice(0, 80) : undefined,
    exportedAt: new Date().toISOString(),
  }
}

/**
 * @param {object} envelope  pcrm-enc-v1 object
 * @param {string} passphrase
 * @returns {Promise<object>} plain backup object
 */
export async function decryptBackup(envelope, passphrase) {
  if (!isEncryptedBackup(envelope)) throw new Error('That file is not an encrypted Personal CRM backup.')
  if (!passphrase) throw new Error('Enter the passphrase used when this file was exported.')
  if (!crypto?.subtle) throw new Error('Web Crypto is not available in this browser.')

  const salt = unb64(envelope.salt)
  const iv = unb64(envelope.iv)
  const ct = unb64(envelope.ct)
  const iter = Number(envelope.iter) || ITER
  const key = await deriveKey(passphrase, salt, iter)
  let plainBuf
  try {
    plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  } catch {
    throw new Error('Wrong passphrase, or the file is damaged.')
  }
  let parsed
  try {
    parsed = JSON.parse(dec.decode(plainBuf))
  } catch {
    throw new Error('Decrypted data is not valid JSON.')
  }
  if (!isPlainBackup(parsed)) throw new Error('Decrypted file is not a Personal CRM backup.')
  return parsed
}

/** Download helper — writes a .pcrm.json envelope. */
export function downloadJsonFile(obj, filename) {
  const json = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)
  const el = document.createElement('a')
  el.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  el.download = filename
  document.body.appendChild(el); el.click(); el.remove()
  setTimeout(() => URL.revokeObjectURL(el.href), 2000)
}
