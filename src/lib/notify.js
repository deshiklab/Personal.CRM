/* ─────────────────────────────────────────────────────────────────────────────
 * Owner notification channel
 * ─────────────────────────────────────────────────────────────────────────────
 * Sends registration + verification requests to the app owner's inbox WITHOUT
 * running our own server, by posting to a form/email service that relays the
 * submission as an email.
 *
 * TO ACTIVATE (owner only, once):
 *   1. Create a free form endpoint, e.g.
 *        · Web3Forms  — https://web3forms.com  (free tier ≈ 250 submissions/mo)
 *        · Formspree  — https://formspree.io   (free tier ≈ 50 submissions/mo)
 *        · EmailJS    — https://www.emailjs.com (free tier ≈ 200 emails/mo)
 *      Set its destination address to: sales@bitscol.com
 *   2. Paste the endpoint URL and access/public key into CONFIG below.
 *   3. Rebuild (`npm run build`). The Settings → Identity screen shows whether
 *      the channel is configured.
 *
 * Until then every call returns { ok:false, reason:'not-configured' } and the
 * app behaves exactly as before — registration never depends on this.
 *
 * SECURITY NOTE: a browser-side endpoint is inherently public. Only ever put a
 * *submit-only* form key here (one that can send you mail and nothing else),
 * never an account key, and never a key that can read mail or billing.
 * ───────────────────────────────────────────────────────────────────────────── */

import { BRAND } from '../brand'

export const NOTIFY_CONFIG = {
  endpoint: '',      // e.g. 'https://api.web3forms.com/submit'
  accessKey: '',     // e.g. 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
  to: BRAND.email,   // sales@bitscol.com
}

export const notifyConfigured = () => !!(NOTIFY_CONFIG.endpoint && NOTIFY_CONFIG.accessKey)

const deviceLabel = () => {
  try {
    const native = typeof window !== 'undefined' && !!window.Capacitor
    const standalone = typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches
    return native ? 'Android app' : standalone ? 'Installed web app (PWA)' : 'Browser'
  } catch { return 'Unknown device' }
}

/**
 * Fire-and-forget notification to the owner. Never throws, never blocks the UI.
 * @returns {{ok:boolean, reason?:string}}
 */
export async function notifyOwner({ type = 'registration', subject, ...fields }) {
  if (!notifyConfigured()) return { ok: false, reason: 'not-configured' }

  const body = {
    access_key: NOTIFY_CONFIG.accessKey,
    subject: subject || `[Personal CRM] ${type} — ${fields.name || 'new user'}`,
    type,
    kind: fields.kind || '',        // 'email' | 'mobile' — which channel to verify
    to: NOTIFY_CONFIG.to,
    name: fields.name || '',
    email: fields.email || '',
    mobile: fields.mobile || '',
    code: fields.code || '',
    device: deviceLabel(),
    app_version: BRAND.version,
    submitted_at: new Date().toISOString(),
    message: fields.message || '',
  }

  const attempt = async () => {
    const res = await fetch(NOTIFY_CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok
  }

  try {
    if (await attempt()) return { ok: true }
  } catch { /* network error — try once more below */ }
  try {
    await new Promise(r => setTimeout(r, 1200))
    if (await attempt()) return { ok: true }
  } catch { /* give up silently */ }
  return { ok: false, reason: 'send-failed' }
}
