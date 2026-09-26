/* Android share-sheet → Quick Capture (and web URL ?share= fallback).
 * Text is held in sessionStorage so a cold start from MAIN+SEND still works. */
import { Capacitor } from '@capacitor/core'

const KEY = 'pcrm-pending-share'

export function stashSharePayload(payload) {
  if (!payload) return
  const p = {
    text: String(payload.text || payload.title || '').trim(),
    title: String(payload.title || '').trim(),
    url: String(payload.url || '').trim(),
    at: Date.now(),
  }
  if (!p.text && !p.url && !p.title) return
  try { sessionStorage.setItem(KEY, JSON.stringify(p)) } catch {}
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch {}
  try { window.dispatchEvent(new CustomEvent('pcrm-share', { detail: p })) } catch {}
}

export function peekSharePayload() {
  let raw = null
  try { raw = sessionStorage.getItem(KEY) } catch {}
  if (!raw) try { raw = localStorage.getItem(KEY) } catch {}
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function consumeSharePayload() {
  const p = peekSharePayload()
  try { sessionStorage.removeItem(KEY) } catch {}
  try { localStorage.removeItem(KEY) } catch {}
  return p
}

/** Parse cold-start URL (?share= / #share=) and listen for native MainActivity bridge. */
export async function bootShareIntent() {
  try {
    const u = new URL(window.location.href)
    const q = u.searchParams.get('share') || u.searchParams.get('text')
    if (q) {
      stashSharePayload({ text: q, title: u.searchParams.get('title') || '' })
      u.searchParams.delete('share'); u.searchParams.delete('text'); u.searchParams.delete('title')
      const next = u.pathname + u.search + u.hash
      window.history.replaceState({}, '', next)
    }
    /* HashRouter: #/?share=... */
    const hash = u.hash || ''
    const qi = hash.indexOf('?')
    if (qi >= 0) {
      const hp = new URLSearchParams(hash.slice(qi + 1))
      const hq = hp.get('share') || hp.get('text')
      if (hq) {
        stashSharePayload({ text: hq, title: hp.get('title') || '' })
        hp.delete('share'); hp.delete('text'); hp.delete('title')
        const base = hash.slice(0, qi)
        const rest = hp.toString()
        window.history.replaceState({}, '', u.pathname + u.search + base + (rest ? '?' + rest : ''))
      }
    }
  } catch {}

  window.addEventListener('pcrm-native-share', e => {
    if (e?.detail) stashSharePayload(e.detail)
  })

  /* no-op on web; native MainActivity injects the event */
  try {
    if (Capacitor?.isNativePlatform?.()) {
      /* reserved for future ShareIntent plugin */
    }
  } catch {}
}
