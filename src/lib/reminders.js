/* Reminder engine — pure logic shared by the store, the alert host and tests.
 *
 * A reminder: { id, refType, refId, title, body, at: 'YYYY-MM-DDTHH:mm',
 *               repeat, sound, vibrate, status: 'scheduled'|'fired'|'done',
 *               firedAt, createdAt }
 * Note-derived alerts (note.remindAt) merge into the same due stream so every
 * reminder path rings the same way. */
import { uid, pad } from '../lib'
import { advanceReminder } from './notes'

export const SOUND_NAMES = { bell: 'Bell', chime: 'Chime', classic: 'Classic', gentle: 'Gentle', silent: 'Silent' }
export const REPEATS = {
  none: 'No repeat', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly',
}

export const fmtLocalDT = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

export const parseDT = s => {
  if (!s) return null            // new Date(null) is the epoch — not a missing date!
  const d = new Date(s)
  return isNaN(d) ? null : d
}

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate()

export function nextOccurrence(at, repeat) {
  const d = parseDT(at)
  if (!d || !repeat || repeat === 'none') return null
  const day = d.getDate()
  if (repeat === 'daily') d.setDate(d.getDate() + 1)
  else if (repeat === 'weekly') d.setDate(d.getDate() + 7)
  else if (repeat === 'monthly') {           // Jan 31 → Feb 28 (clamped)
    d.setDate(1); d.setMonth(d.getMonth() + 1)
    d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())))
  } else if (repeat === 'yearly') {          // Feb 29 → Feb 28 (clamped)
    d.setDate(1); d.setFullYear(d.getFullYear() + 1)
    d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())))
  } else return null
  return fmtLocalDT(d)
}

/* reminder factory — fills sound/vibrate from prefs */
export function makeReminder(data, prefs = {}) {
  return {
    id: uid(),
    refType: 'custom', refId: null,
    title: 'Reminder', body: '',
    at: null, repeat: 'none',
    sound: prefs.sound || 'bell',
    vibrate: prefs.vibrate !== false,
    status: 'scheduled', firedAt: null,
    createdAt: new Date().toISOString(),
    ...data,
  }
}

/* quick helper: reminder at `minutes` before a date-time target */
export const minutesBefore = (dateISO, timeHHMM, minutes) => {
  const d = new Date(`${dateISO}T${timeHHMM || '09:00'}`)
  if (isNaN(d)) return null
  d.setMinutes(d.getMinutes() - minutes)
  return fmtLocalDT(d)
}

export const isDue = (r, now = new Date()) => {
  const t = parseDT(r.at)
  return !!t && t.getTime() <= now.getTime() && r.status === 'scheduled'
}

/* which slice reminders + note reminders should ring right now */
export function collectDue({ reminders = [], notes = [] }, now = new Date()) {
  const out = []
  reminders.forEach(r => {
    if (isDue(r, now)) {
      out.push({ key: `rem-${r.id}`, kind: 'reminder', id: r.id, title: r.title, body: r.body, at: r.at, sound: r.sound, vibrate: r.vibrate })
    }
  })
  notes.forEach(n => {
    if (n.trashedAt || !n.remindAt) return
    const t = parseDT(n.remindAt)
    if (!t || t.getTime() > now.getTime()) return
    out.push({
      key: `note-${n.id}`, kind: 'note', id: n.id,
      title: n.title || 'Note reminder',
      body: (n.checklist?.[0]?.text || n.body || '').slice(0, 120),
      at: n.remindAt, sound: 'bell', vibrate: true,
    })
  })
  return out.sort((a, b) => (a.at || '').localeCompare(b.at || ''))
}

/* the reminder's next life after firing (repeat) — null means one-shot */
export const afterFire = r => {
  const next = nextOccurrence(r.at, r.repeat)
  return next ? { at: next, status: 'scheduled', firedAt: new Date().toISOString() } : { status: 'fired', firedAt: new Date().toISOString() }
}

/* snooze: push `minutes` out and re-arm */
export const snoozePatch = (r, minutes) => {
  const d = parseDT(r.at) || new Date()
  d.setMinutes(d.getMinutes() + minutes)
  return { at: fmtLocalDT(d), status: 'scheduled', firedAt: r.firedAt }
}

export const dueSoonLabel = at => {
  const t = parseDT(at)
  if (!t) return ''
  const mins = Math.round((t.getTime() - Date.now()) / 60000)
  if (mins < -1440) return `${Math.round(-mins / 1440)}d overdue`
  if (mins < -60) return `${Math.round(-mins / 60)}h overdue`
  if (mins < 0) return `${-mins}m overdue`
  if (mins < 60) return `in ${mins}m`
  if (mins < 1440) return `in ${Math.round(mins / 60)}h`
  return `in ${Math.round(mins / 1440)}d`
}
