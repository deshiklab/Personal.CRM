/* ═════════════════════════════════════════════════════════════════════════════
 * Visiting-card scanner.
 *
 * Runs Tesseract.js entirely in the browser. Assets are loaded in this order:
 *   1. Local ./ocr/ next to the page (Android APK, gh-pages, Vite public/)
 *   2. jsDelivr CDN (so the single-file standalone HTML still works)
 *
 * A stuck "0%" was almost always the worker never finishing load — missing
 * local assets + no timeout + no fallback. This module probes, falls back,
 * times out, and surfaces real progress so the UI never sits silent.
 * ═════════════════════════════════════════════════════════════════════════════ */

let workerPromise = null
let lastProgress = { status: 'idle', progress: 0 }
const listeners = new Set()

const TESS_VERSION = '5.1.1'
const CORE_VERSION = '5.0.0'
const CDN = {
  worker: `https://cdn.jsdelivr.net/npm/tesseract.js@${TESS_VERSION}/dist/worker.min.js`,
  core:   `https://cdn.jsdelivr.net/npm/tesseract.js-core@${CORE_VERSION}`,
  lang:   'https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0',
}

const emit = p => {
  lastProgress = { ...lastProgress, ...p }
  listeners.forEach(fn => { try { fn(lastProgress) } catch {} })
}
export const onScanProgress = fn => {
  listeners.add(fn)
  try { fn(lastProgress) } catch {}
  return () => listeners.delete(fn)
}

const ocrBaseCandidates = () => {
  const out = []
  try {
    /* document.baseURI respects <base href>; location.href covers hash-routed SPAs */
    out.push(new URL('ocr/', document.baseURI || location.href).href)
  } catch {}
  try {
    /* GitHub Pages project site: /Personal.CRM/ocr/ even if opened deep */
    const parts = location.pathname.split('/').filter(Boolean)
    if (parts.length) {
      out.push(location.origin + '/' + parts[0] + '/ocr/')
    }
    out.push(location.origin + '/ocr/')
  } catch {}
  /* de-dupe */
  return [...new Set(out)]
}

const headOk = async url => {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'force-cache' })
    if (r.ok) return true
  } catch {}
  /* some static hosts reject HEAD — try a tiny range GET */
  try {
    const r = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, cache: 'force-cache' })
    return r.ok || r.status === 206
  } catch {
    return false
  }
}

/** Find a working local OCR base, or null if none is reachable. */
async function resolveLocalBase() {
  for (const base of ocrBaseCandidates()) {
    emit({ status: 'looking for OCR files', progress: 0.02, detail: base })
    const ok = await headOk(base + 'worker.min.js')
    if (ok) return base
  }
  return null
}

const withTimeout = (promise, ms, label) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms)
  promise.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
})

async function createTessWorker(paths) {
  const { createWorker, PSM } = await import('tesseract.js')
  emit({ status: 'starting OCR engine', progress: 0.05, detail: paths.source })
  const worker = await createWorker('eng', 1, {
    workerPath: paths.workerPath,
    corePath: paths.corePath,
    langPath: paths.langPath,
    /* blob URL wrapper avoids cross-origin Worker restrictions on CDN worker */
    workerBlobURL: true,
    gzip: true,
    logger: m => {
      /* map tesseract phases onto a smoother 5→95% bar */
      const phase = String(m.status || '')
      let base = 0.05, span = 0.9
      if (/loading tesseract core/i.test(phase)) { base = 0.05; span = 0.25 }
      else if (/initializ|loading language|loaded language/i.test(phase)) { base = 0.30; span = 0.25 }
      else if (/loading script|loading worker/i.test(phase)) { base = 0.05; span = 0.15 }
      else if (/recogniz/i.test(phase)) { base = 0.55; span = 0.40 }
      else if (/done|idle/i.test(phase)) { base = 0.95; span = 0.05 }
      const p = base + (m.progress || 0) * span
      emit({ status: phase || 'working', progress: Math.min(0.99, p) })
    },
    errorHandler: err => emit({ status: 'error', progress: lastProgress.progress, error: String(err) }),
  })
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: '1',
  })
  return worker
}

async function getWorker() {
  if (workerPromise) return workerPromise
  workerPromise = (async () => {
    const local = await resolveLocalBase()
    const attempts = []
    if (local) {
      attempts.push({
        source: 'local',
        workerPath: local + 'worker.min.js',
        corePath: local,
        langPath: local,
      })
    }
    attempts.push({
      source: 'cdn',
      workerPath: CDN.worker,
      corePath: CDN.core,
      langPath: CDN.lang,
    })

    let lastErr
    for (const paths of attempts) {
      try {
        emit({ status: `loading OCR (${paths.source})`, progress: 0.04 })
        const w = await withTimeout(createTessWorker(paths), 90_000, `OCR engine (${paths.source})`)
        emit({ status: 'OCR ready', progress: 0.5 })
        return w
      } catch (e) {
        lastErr = e
        emit({ status: `OCR ${paths.source} failed — trying next`, progress: 0.04, error: String(e?.message || e) })
        /* force a fresh attempt next loop */
      }
    }
    workerPromise = null
    throw lastErr || new Error('Could not start the OCR engine')
  })().catch(err => { workerPromise = null; throw err })
  return workerPromise
}

/* ── text → contact fields ────────────────────────────────────────────────── */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig
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
  const words = line.split(/\s+/).filter(Boolean)
  if (words.length < 1 || words.length > 5) return false
  const cap = words.filter(w => /^[A-ZÀ-ÖØ-Ý]/.test(w) || /^[A-Z]{2,}$/.test(w)).length
  return cap >= Math.ceil(words.length * 0.5)
}

export function parseCardText(text) {
  const raw = String(text || '')
  const lines = raw.split(/\r?\n/).map(l => clean(l)).filter(Boolean)

  const emails = [...raw.matchAll(EMAIL_RE)].map(m => m[0].toLowerCase())
  const email = emails[0] || ''

  const phones = [...raw.matchAll(PHONE_RE)]
    .map(m => clean(m[0]))
    .filter(p => digits(p).length >= 7 && digits(p).length <= 15)
  phones.sort((a, b) => digits(b).length - digits(a).length)
  const phone = phones[0] || ''

  const urls = [...raw.matchAll(URL_RE)]
    .map(m => m[0].replace(/[),.;]+$/, ''))
    .filter(u => !/@/.test(u) && !/^\d/.test(u))
  const website = urls[0]
    ? (/^https?:\/\//i.test(urls[0]) ? urls[0] : 'https://' + urls[0].replace(/^\/\//, ''))
    : ''

  let role = '', company = '', name = '', address = ''

  for (const line of lines) {
    if (!role && ROLE_HINT.test(line) && line.length < 60) { role = line; continue }
    if (!company && COMPANY_HINT.test(line) && line.length < 60) { company = line; continue }
  }
  for (const line of lines) {
    if (looksLikeName(line)) { name = line; break }
  }
  if (name && COMPANY_HINT.test(name) && !company) { company = name; name = '' }
  if (!name) {
    const skip = new Set([role, company, email, phone, website].map(clean).filter(Boolean))
    name = lines.find(l => !skip.has(l) && !EMAIL_RE.test(l) && !PHONE_RE.test(l) && l.length > 2 && l.length < 48) || ''
  }

  const used = new Set([name, role, company, email, phone, website].map(s => clean(s).toLowerCase()))
  const addrLines = lines.filter(l => {
    const k = l.toLowerCase()
    if (used.has(k)) return false
    if (EMAIL_RE.test(l) || PHONE_RE.test(l) || URL_RE.test(l)) return false
    return /\b(road|rd\.?|street|st\.?|avenue|ave\.?|lane|ln\.?|floor|suite|plot|block|sector|city|dhaka|bangladesh|india|pakistan|uae|uk|usa|zip|post\s*code)\b/i.test(l)
      || (/\b\d{3,6}\b/.test(l) && /[A-Za-z]/.test(l))
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
 */
export async function scanVisitingCard(image, opts = {}) {
  const unsub = opts.onProgress ? onScanProgress(opts.onProgress) : null
  try {
    emit({ status: 'preparing', progress: 0.01 })
    const worker = await getWorker()
    emit({ status: 'recognizing text', progress: 0.55 })
    const { data } = await withTimeout(
      worker.recognize(image),
      120_000,
      'Reading the card',
    )
    const draft = parseCardText(data?.text || '')
    emit({ status: 'done', progress: 1 })
    return { ...draft, confidence: data?.confidence || 0 }
  } finally {
    if (unsub) unsub()
  }
}

/** Free the worker when the user leaves the screen (optional). */
export async function disposeScanner() {
  if (!workerPromise) return
  try {
    const w = await workerPromise
    await w.terminate()
  } catch {}
  workerPromise = null
  emit({ status: 'idle', progress: 0 })
}

/** Warm the engine in the background so the first scan feels faster. */
export function prefetchScanner() {
  getWorker().catch(() => { /* surfaced on first real scan */ })
}
