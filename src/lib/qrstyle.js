/* QR design studio — shared by the my-card QR and per-contact QRs.
 * Layered rendering:
 *   1. qr-code-styling  — dots/corners patterns, logo, colors, gradients
 *   2. qrcode fallback  — colors + margin only (older/no-canvas environments)
 *   3. null             — caller shows a graceful message
 * Style prefs live in the store as `qrStyle` (additive, backed up). */
import QRCode from 'qrcode'

export const QR_STYLE_DEFAULTS = {
  fg: '#0a0c11',
  bg: '#ffffff',
  dot: 'square',        // square | dots | rounded | extra-rounded | classy
  corner: 'square',     // square | dot | extra-rounded
  logo: '',             // data URL (small) or empty
  logoSize: 0.3,
  margin: 2,
}

export const DOT_TYPES = [
  { id: 'square', label: 'Square' },
  { id: 'dots', label: 'Dots' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'extra-rounded', label: 'Soft' },
  { id: 'classy', label: 'Classy' },
]
export const CORNER_TYPES = [
  { id: 'square', label: 'Square' },
  { id: 'dot', label: 'Round' },
  { id: 'extra-rounded', label: 'Soft' },
]

export const QR_PRESETS = [
  { id: 'classic', label: 'Classic', fg: '#0a0c11', bg: '#ffffff', dot: 'square', corner: 'square' },
  { id: 'midnight', label: 'Midnight', fg: '#e2e8f0', bg: '#0f172a', dot: 'rounded', corner: 'extra-rounded' },
  { id: 'indigo', label: 'Indigo', fg: '#312e81', bg: '#eef2ff', dot: 'dots', corner: 'dot' },
  { id: 'forest', label: 'Forest', fg: '#14532d', bg: '#f0fdf4', dot: 'rounded', corner: 'dot' },
  { id: 'sunset', label: 'Sunset', fg: '#7c2d12', bg: '#fff7ed', dot: 'classy', corner: 'extra-rounded' },
  { id: 'ocean', label: 'Ocean', fg: '#0c4a6e', bg: '#f0f9ff', dot: 'extra-rounded', corner: 'dot' },
  { id: 'rose', label: 'Rose', fg: '#881337', bg: '#fff1f2', dot: 'dots', corner: 'extra-rounded' },
  { id: 'mono', label: 'Mono', fg: '#000000', bg: '#ffffff', dot: 'classy', corner: 'square' },
]

export const qrStyleOf = st => ({ ...QR_STYLE_DEFAULTS, ...(st || {}) })

/* downscale an uploaded logo to a small square PNG data URL (browser only) */
export async function shrinkLogo(file, px = 160) {
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(file)
  })
  try {
    // no real canvas (jsdom etc.) → keep the original data URL, never hang
    if (!document.createElement('canvas').getContext?.('2d')) return dataUrl
    const img = await Promise.race([
      new Promise((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = () => reject(new Error('decode failed'))
        i.src = dataUrl
      }),
      new Promise(resolve => setTimeout(() => resolve(null), 2500)),
    ])
    if (!img) return dataUrl
    const cv = document.createElement('canvas')
    const side = Math.min(img.width, img.height)
    cv.width = px; cv.height = px
    const ctx = cv.getContext('2d')
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, px, px)
    return cv.toDataURL('image/png')
  } catch {
    return dataUrl   // environments without canvas keep the original
  }
}

/* render into `container` (a fresh div the caller owns); returns 'styled' | 'plain' | null */
export async function renderStyledQr(container, text, style) {
  const st = qrStyleOf(style)
  container.innerHTML = ''
  try {
    const { default: QRCodeStyling } = await import('qr-code-styling')
    const qr = new QRCodeStyling({
      type: 'canvas',
      width: 260,
      height: 260,
      data: text,
      margin: st.margin * 4,
      qrOptions: { errorCorrectionLevel: st.logo ? 'H' : 'M' },
      dotsOptions: { color: st.fg, type: st.dot },
      cornersSquareOptions: { color: st.fg, type: st.corner },
      cornersDotOptions: { color: st.fg, type: st.corner },
      backgroundOptions: { color: st.bg },
      image: st.logo || undefined,
      imageOptions: { crossOrigin: 'anonymous', margin: 4, imageSize: st.logoSize },
    })
    qr.append(container)
    // a canvas node must actually appear — otherwise fall through
    if (container.querySelector('canvas, svg')) return 'styled'
  } catch { /* fall through */ }
  try {
    const url = await QRCode.toDataURL(text, {
      margin: st.margin,
      width: 260,
      errorCorrectionLevel: st.logo ? 'H' : 'M',
      color: { dark: st.fg, light: st.bg },
    })
    const img = document.createElement('img')
    img.width = 260; img.height = 260
    img.alt = 'QR code'
    img.src = url
    container.appendChild(img)
    return 'plain'
  } catch { return null }
}

/* PNG data URL of the rendered QR (for download/share) — best effort */
export async function styledQrDataUrl(text, style) {
  const st = qrStyleOf(style)
  try {
    const { default: QRCodeStyling } = await import('qr-code-styling')
    const qr = new QRCodeStyling({
      type: 'canvas',
      width: 640,
      height: 640,
      data: text,
      margin: st.margin * 4,
      qrOptions: { errorCorrectionLevel: st.logo ? 'H' : 'M' },
      dotsOptions: { color: st.fg, type: st.dot },
      cornersSquareOptions: { color: st.fg, type: st.corner },
      cornersDotOptions: { color: st.fg, type: st.corner },
      backgroundOptions: { color: st.bg },
      image: st.logo || undefined,
      imageOptions: { crossOrigin: 'anonymous', margin: 4, imageSize: st.logoSize },
    })
    const blob = await qr.getRawData('png')
    if (blob) return await new Promise(resolve => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result || ''))
      r.onerror = () => resolve(null)
      r.readAsDataURL(blob)
    })
  } catch { /* fall through */ }
  try {
    return await QRCode.toDataURL(text, {
      margin: st.margin, width: 640,
      errorCorrectionLevel: st.logo ? 'H' : 'M',
      color: { dark: st.fg, light: st.bg },
    })
  } catch { return null }
}
