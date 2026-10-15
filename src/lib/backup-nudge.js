/* X5 — auto-backup nudge: "when did we last back this up?" */
export const BACKUP_NUDGE_DAYS = 7

/* Returns a nudge string, or null when the last backup is recent enough. */
export function backupNudgeText(last, now = Date.now()) {
  const t = last ? new Date(last).getTime() : NaN
  const day = 86400000
  if (!Number.isFinite(t) || t <= 0) return '⏳ No backup yet — Settings → Drive backup saves a full copy in one tap'
  const days = Math.floor((now - t) / day)
  if (days < BACKUP_NUDGE_DAYS) return null
  return `⏳ Last backup was ${days} day${days === 1 ? '' : 's'} ago — Settings → Drive backup saves a fresh copy in one tap`
}
