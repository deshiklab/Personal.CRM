/* Publish overdue / next-up counts for the Android home-screen widget (local only). */
import * as storage from './storage'

const KEY = 'pcrm-widget-stats'

/**
 * @param {{ contacts: any[], followUpStatus: (c:any)=>any }} crm
 */
export function publishWidgetStats(crm) {
  try {
    if (!crm?.contacts || typeof crm.followUpStatus !== 'function') return
    let overdue = 0
    let next = null
    let nextDays = Infinity
    for (const c of crm.contacts) {
      const st = crm.followUpStatus(c)
      if (!st) continue
      if (st.state === 'overdue') {
        overdue += 1
        const d = st.overdueBy ?? 0
        if (d < nextDays) { nextDays = d; next = c.name }
      } else if (st.state === 'due-soon') {
        const d = st.dueIn ?? 3
        if (d < nextDays) { nextDays = d; next = c.name }
      }
    }
    const payload = { overdue, next: next || '', at: Date.now() }
    storage.setJSON(KEY, payload)
    /* also mirror plain localStorage for native Preference bridge */
    try { localStorage.setItem(KEY, JSON.stringify(payload)) } catch {}
  } catch { /* ignore */ }
}

export const WIDGET_STATS_KEY = KEY
