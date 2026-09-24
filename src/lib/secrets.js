/* ═════════════════════════════════════════════════════════════════════════════
 * Secrets live apart from data.
 *
 * The main `pcrm-v1` blob is the thing people export, back up, restore and
 * (one day) sync. Credentials must never ride along inside it, so tokens and
 * passwords get their own keys: excluded from snapshots and backups, and
 * cleared on a factory reset.
 * ═════════════════════════════════════════════════════════════════════════════ */

const GIST = 'pcrm-secret-gist'

const safe = fn => { try { return fn() } catch { return null } }

export const getGistToken = () => safe(() => localStorage.getItem(GIST)) || ''
export const setGistToken = t => safe(() => {
  if (t) localStorage.setItem(GIST, t)
  else localStorage.removeItem(GIST)
})
export const clearSecrets = () => safe(() => { localStorage.removeItem(GIST) })
export const SECRET_KEYS = [GIST]
