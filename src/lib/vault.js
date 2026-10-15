/* Encrypted backups — .pcrm.json (AES-GCM 256, PBKDF2-SHA256 250k).
 * The password never leaves the device; the file is unreadable without it.
 * WebCrypto-only: environments without subtle get a clear error. */
export const ENC_MARKER = 'PCRMENC1'

const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0))

const subtle = () => {
  const s = globalThis.crypto?.subtle
  if (!s) throw new Error('Encryption needs a modern browser (WebCrypto)')
  return s
}

async function deriveKey(password, salt, usage) {
  const material = await subtle().importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return subtle().deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  )
}

export async function encryptBackup(jsonText, password) {
  if (!password || password.length < 4) throw new Error('Pick a password of at least 4 characters')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, 'encrypt')
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(jsonText))
  return JSON.stringify({ marker: ENC_MARKER, v: 1, kdf: 'PBKDF2-SHA256-250k', cipher: 'AES-GCM-256', salt: b64(salt), iv: b64(iv), data: b64(ct) })
}

export async function decryptBackup(fileText, password) {
  let obj
  try { obj = JSON.parse(fileText) } catch { throw new Error('Not a .pcrm.json encrypted backup') }
  if (obj?.marker !== ENC_MARKER) throw new Error('Not a .pcrm.json encrypted backup')
  const key = await deriveKey(password, unb64(obj.salt), 'decrypt')
  try {
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(obj.iv) }, key, unb64(obj.data))
    return new TextDecoder().decode(pt)
  } catch {
    throw new Error('Wrong password — nothing was changed')
  }
}

/* what kind of backup text is this? */
export function detectBackup(text) {
  try {
    const obj = JSON.parse(text)
    if (obj?.marker === ENC_MARKER) return 'encrypted'
    if (obj && (Array.isArray(obj.contacts) || Array.isArray(obj?.data?.contacts))) return 'plain'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}
