/* ═════════════════════════════════════════════════════════════════════════════
 * Visiting-card scanner.
 *
 * Runs Tesseract.js entirely on-device. Worker, WASM core and English
 * language data are vendored under ./ocr/ so the scan still works offline
 * once the first load has cached them (and always works in the Android app
 * where those files ship inside the APK).
 *
 * Output is a best-effort contact draft — name, role, company, phones,
 * emails, website, address — which the user confirms before anything is
 * saved. OCR is never perfect; the confirm step is the product.
 * ═════════════════════════════════════════════════════════════════════════════ */

let workerPromise = null
let lastProgress = { status: '', progress: 0 }
const listeners = new Set()

const ocrBase = () => {
  /* resolve against the page so it works on GitHub Pages subpaths and file:// */
  try {
    return new URL('ocr/', document.baseURI || location.href).href
  } catch {
    return './ocr/'
  }
}

const emit = p => { lastProgress = p; listeners.forEach(fn => { try { fn(p) } catch {} }) }
export const onScanProgress = fn => { listeners.add(fn); fn(lastProgress); return () => listeners.delete(fn) }

async function getWorker() {
  if (workerPromise) return workerPromise
  workerPromise = (async () => {
    const { createWorker, PSM } = await import('tesseract.js')
    const base = ocrBase()
    const worker = await createWorker('eng', 1, {
      workerPath: base + 'worker.min.js',
      corePath: base,                       /* finds tesseract-core-*.wasm.js next to it */
      langPath: base,                       /* finds eng.traineddata.gz */
      workerBlobURL: false,                 /* load the real file, not a blob URL */
      logger: m => emit({ status: m.status || '', progress: m.progress || 0 }),
      errorHandler: err => emit({ status: 'error', progress: 0, error: String(err) }),
    })
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: '1',
    })
    return worker
  })().catch(err => { workerPromise = null; throw err })
  return workerPromise
}

/* ── text → contact fields ────────────────────────────────────────────────── */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig
/* phones: +country, spaces/dashes, 7–15 digits once stripped */
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/g
const URL_RE = /(?:https?:\/\/)?(?:www\.)?[A-Z0-9][-A-Z0-9.]*\.[A-Z]{2,}(?:\/[^\s]*)?/ig
const ROLE_HINT = /\b(ceo|cto|cfo|coo|founder|co-?founder|director|managing director|md|manager|engineer|developer|designer|consultant|partner|president|vp|vice president|head of|lead|officer|executive|specialist|analyst|architect|professor|dr\.?|doctor|lawyer|advocate|sales|marketing|product|owner|proprietor)\b/i
const COMPANY_HINT = /\b(ltd|limited|llc|inc|corp|corporation|gmbh|pvt|private|company|co\.|group|labs?|studio|agency|technologies|tech|solutions|services|bank|hospital|university|institute)\b/i

const clean = s => String(s || '').replace(/\s+/g, ' ').trim()
const digits = s => String(s || '').replace(/\D/g, '')

const looksLikeName = line => {
  if (!line || line.length < 2 || line.length > 48) return false
  if (EMAIL_RE.test(line) || PHONE_RE.test(line) || URL_RE.test(line)) return false
  if (/\d{3,}/.test(line)) return false
  if (ROLE_HINT.test(line) || COMPANY_HINT.test(line)) return false
  /* two-to-four capitalised words is the usual shape */
  const words = line.split(/\s+/).filter(Boolean)
  if (words.length < 1 || words.length > 5) return false
  const cap = words.filter(w => /^[A-ZÀ-ÖØ-Ý]/.test(w) || /^[A-Z]{2,}$/.test(w)).length
  return cap >= Math.ceil(words.length * 0.5)
}

/**
 * Parse OCR plain text into a contact draft.
 * @returns {{ name, role, company, phone, email, website, address, raw }}
 */
export function parseCardText(text) {
  const raw = String(text || '')
  const lines = raw.split(/\r?\n/).map(l => clean(l)).filter(Boolean)

  const emails = [...raw.matchAll(EMAIL_RE)].map(m => m[0].toLowerCase())
  const email = emails[0] || ''

  const phones = [...raw.matchAll(PHONE_RE)]
    .map(m => clean(m[0]))
    .filter(p => digits(p).length >= 7 && digits(p).length <= 15)
  /* prefer the longest plausible mobile */
  phones.sort((a, b) => digits(b).length - digits(a).length)
  const phone = phones[0] || ''

  const urls = [...raw.matchAll(URL_RE)]
    .map(m => m[0].replace(/[),.;]+$/, ''))
    .filter(u => !/@/.test(u) && !/^\d/.test(u))
  const website = urls[0]
    ? (/^https?:\/\//i.test(urls[0]) ? urls[0] : 'https://' + urls[0].replace(/^\/\//, ''))
    : ''

  let role = ''
  let company = ''
  let name = ''
  let address = ''

  for (const line of lines) {
    if (!role && ROLE_HINT.test(line) && line.length < 60) { role = line; continue }
    if (!company && COMPANY_HINT.test(line) && line.length < 60) { company = line; continue }
  }
  /* name: first line that looks like a person, preferring ones above the role */
  for (const line of lines) {
    if (looksLikeName(line)) { name = line; break }
  }
  /* if the "name" is actually the company (all caps + Ltd), swap */
  if (name && COMPANY_HINT.test(name) && !company) { company = name; name = '' }
  if (!name) {
    /* fall back: first non-contact line */
    const skip = new Set([role, company, email, phone, website].map(clean).filter(Boolean))
    name = lines.find(l => !skip.has(l) && !EMAIL_RE.test(l) && !PHONE_RE.test(l) && l.length > 2 && l.length < 48) || ''
  }

  /* address: lines with street-ish tokens that we have not already used */
  const used = new Set([name, role, company, email, phone, website].map(s => clean(s).toLowerCase()))
  const addrLines = lines.filter(l => {
    const k = l.toLowerCase()
    if (used.has(k)) return false
    if (EMAIL_RE.test(l) || PHONE_RE.test(l) || URL_RE.test(l)) return false
    return /\b(road|rd\.?|street|st\.?|avenue|ave\.?|lane|ln\.?|floor|suite|plot|block|sector|city|dhaka|bangladesh|india|pakistan|uae|uk|usa|zip|post\s*code)\b/i.test(l)
      || /\b\d{3,6}\b/.test(l) && /[A-Za-z]/.test(l)
  })
  address = addrLines.slice(0, 3).join(', ')

  return {
    name: clean(name),
    role: clean(role),
    company: clean(company),
    phone: clean(phone),
    email: clean(email),
    website: clean(website),
    address: clean(address),
    raw,
  }
}

/**
 * Run OCR on an image (File, Blob, data-URL or canvas) and return a contact draft.
 * @param {object} [opts]
 * @param {(p:{status:string,progress:number})=>void} [opts.onProgress]
 */
export async function scanVisitingCard(image, opts = {}) {
  const unsub = opts.onProgress ? onScanProgress(opts.onProgress) : null
  try {
    const worker = await getWorker()
    emit({ status: 'recognizing text', progress: 0 })
    const { data } = await worker.recognize(image)
    const draft = parseCardText(data?.text || '')
    emit({ status: 'done', progress: 1 })
    return { ...draft, confidence: data?.confidence || 0 }
  } finally {
    if (unsub) unsub()
  }
}

/** Optional: free the worker when the user leaves the screen. */
export async function disposeScanner() {
  if (!workerPromise) return
  try { const w = await workerPromise; await w.terminate() } catch {}
  workerPromise = null
}
