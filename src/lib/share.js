/* One share entry point for everything — Web Share L2 on phones, download
 * fallback on desktop. WhatsApp/Telegram/Gmail appear in the native sheet
 * automatically; direct-to-WhatsApp file sends are not possible without it. */

export const canShareFiles = () =>
  typeof navigator !== 'undefined' && !!navigator.canShare && !!navigator.share

/* share a Blob/File; falls back to download */
export async function shareFile({ blob, name, title, text }) {
  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' })
  if (canShareFiles() && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: title || name, text })
      return 'shared'
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled'
    }
  }
  downloadBlob(blob, name)
  return 'downloaded'
}

/* share plain text (notes, links, contact summaries) */
export async function shareText({ title, text, url }) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return 'shared'
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText([text, url].filter(Boolean).join('\n'))
    return 'copied'
  } catch {
    return 'failed'
  }
}

export function downloadBlob(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

/* import a remote file by URL (raw GitHub / Gist / any CORS-open link).
 * Returns { ok, blob, name } — never throws. */
export async function fetchRemoteFile(url) {
  try {
    const u = new URL(url, location.href)
    if (!/^https?:$/.test(u.protocol)) return { ok: false, reason: 'bad-url' }
    const res = await fetch(u.href)
    if (!res.ok) return { ok: false, reason: `http-${res.status}` }
    const blob = await res.blob()
    const seg = u.pathname.split('/').filter(Boolean).pop() || 'remote-file'
    return { ok: true, blob, name: decodeURIComponent(seg).slice(0, 120) }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

/* copy plain text to the clipboard; true on success */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      const ok = document.execCommand && document.execCommand('copy')
      ta.remove()
      return !!ok
    } catch { return false }
  }
}
