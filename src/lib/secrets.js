/* ═════════════════════════════════════════════════════════════════════════════
 * Secrets live apart from data.
 *
 * The main `pcrm-v1` blob is the thing people export, back up, restore and
 * (one day) sync. Credentials must never ride along inside it, so tokens and
 * passwords get their own keys: excluded from snapshots and backups, and
 * cleared on a factory reset.
 * ═════════════════════════════════════════════════════════════════════════════ */

import * as storage from './storage'

const GIST = 'pcrm-secret-gist'

export const getGistToken = () => storage.getItem(GIST) || ''
export const setGistToken = t => {
  if (t) storage.setItem(GIST, t)
  else storage.removeItem(GIST)
}
export const clearSecrets = () => { storage.removeItem(GIST) }
export const SECRET_KEYS = [GIST]
