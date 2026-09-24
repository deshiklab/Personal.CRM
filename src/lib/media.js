/* ═════════════════════════════════════════════════════════════════════════════
 * Image helpers — keep photos and visiting-card scans small enough for
 * local-first storage (localStorage / Preferences), without a server.
 *
 * Everything becomes a JPEG data-URL. Max edge and quality are tuned so a
 * portrait and a card together stay well under ~200 KB.
 * ═════════════════════════════════════════════════════════════════════════════ */

const readAsDataURL = file => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(r.result)
  r.onerror = () => reject(r.error || new Error('read failed'))
  r.readAsDataURL(file)
})

const loadImage = src => new Promise((resolve, reject) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = () => reject(new Error('image decode failed'))
  img.src = src
})

/**
 * Resize + JPEG-compress a File/Blob/data-URL.
 * @returns {Promise<{ dataUrl: string, width: number, height: number, bytes: number }>}
 */
export async function compressImage(input, {
  maxEdge = 960,
  quality = 0.72,
  mime = 'image/jpeg',
} = {}) {
  let src = input
  if (typeof input !== 'string') {
    if (!(input instanceof Blob)) throw new Error('expected a File, Blob or data-URL')
    src = await readAsDataURL(input)
  }
  const img = await loadImage(src)
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  let q = quality
  let dataUrl = canvas.toDataURL(mime, q)
  /* keep shrinking quality until we are under ~180 KB (or quality floor) */
  while (dataUrl.length > 180_000 && q > 0.45) {
    q -= 0.07
    dataUrl = canvas.toDataURL(mime, q)
  }
  return { dataUrl, width: w, height: h, bytes: Math.round(dataUrl.length * 0.75) }
}

/** Open the device camera / file picker. `capture` hints at the rear camera. */
export function pickImage({ accept = 'image/*', capture } = {}) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    if (capture) input.setAttribute('capture', capture)
    input.style.display = 'none'
    const done = (fn, v) => { try { document.body.removeChild(input) } catch {}; fn(v) }
    input.onchange = () => {
      const f = input.files && input.files[0]
      if (!f) return done(reject, new Error('cancelled'))
      done(resolve, f)
    }
    input.oncancel = () => done(reject, new Error('cancelled'))
    document.body.appendChild(input)
    input.click()
  })
}

/** Convenience: pick + compress in one step. Returns null if the user cancels. */
export async function pickAndCompress(opts = {}) {
  try {
    const file = await pickImage(opts)
    return await compressImage(file, opts)
  } catch {
    return null
  }
}

export const isDataUrl = s => typeof s === 'string' && /^data:image\//.test(s)
