/* ═════════════════════════════════════════════════════════════════════════════
 * Local reminders — device nudges for tasks, follow-ups, birthdays, events.
 *
 * Pro feature (`can('reminders')`). Free users still see the in-app Notification
 * Center; only the OS-level push is gated.
 *
 * Platforms
 *   · Android (Capacitor) → @capacitor/local-notifications
 *   · Web / PWA           → Notification API (when permission granted)
 *
 * Everything is on-device. No FCM, no server, no account.
 * ═════════════════════════════════════════════════════════════════════════════ */

import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'
import { BRAND } from '../brand'

export const CHANNEL_ID = 'pcrm_reminders'
export const PREFS_KEY = 'pcrm-reminder-prefs'

const isNative = () => {
  try { return Capacitor.isNativePlatform?.() === true } catch { return false }
}

export const blankPrefs = () => ({
  enabled: true,
  leadMinutes: {
    task: 60 * 9,       // 09:00 local on due day
    'follow-up': 60 * 10,
    birthday: 60 * 9,
    event: 60,          // 1h before when time known; else 09:00
    system: 0,
  },
  quietHours: { start: 22, end: 7 }, // local hour 0–23; nulls = off
  lastSyncAt: null,
  permission: 'unknown', // 'granted' | 'denied' | 'prompt' | 'unknown'
})

export function readPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return blankPrefs()
    return { ...blankPrefs(), ...JSON.parse(raw) }
  } catch { return blankPrefs() }
}

export function writePrefs(p) {
  const next = { ...blankPrefs(), ...p }
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch {}
  return next
}

/** Stable positive 32-bit id from a string key (Android needs int ids). */
export function notifIdFromKey(key) {
  let h = 2166136261 >>> 0
  const s = String(key || '')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  /* keep in signed 31-bit positive range */
  return (h % 0x7fffffff) || 1
}

const parseHM = (time) => {
  if (!time || typeof time !== 'string') return null
  const m = time.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = +m[1], min = +m[2]
  if (h > 23 || min > 59) return null
  return { h, min }
}

/** Build a Date for when the OS should fire this reminder. */
export function fireAtFor(n, prefs = blankPrefs()) {
  const lead = (prefs.leadMinutes && prefs.leadMinutes[n.type]) || 0
  const ts = n.ts // ISO date YYYY-MM-DD
  if (!ts) return null
  const [y, mo, d] = ts.split('-').map(Number)
  if (!y || !mo || !d) return null

  let at
  if (n.type === 'event' && n.time) {
    const hm = parseHM(n.time)
    if (hm) {
      at = new Date(y, mo - 1, d, hm.h, hm.min, 0, 0)
      at = new Date(at.getTime() - lead * 60_000)
    }
  }
  if (!at) {
    /* default: leadMinutes interpreted as minutes-from-midnight on the day */
    const mins = Math.max(0, lead)
    const h = Math.floor(mins / 60) % 24
    const m = mins % 60
    at = new Date(y, mo - 1, d, h, m, 0, 0)
  }

  /* quiet hours: push into end-of-quiet if we'd fire inside the window */
  const qh = prefs.quietHours
  if (qh && typeof qh.start === 'number' && typeof qh.end === 'number') {
    const hour = at.getHours()
    const wraps = qh.start > qh.end
    const inQuiet = wraps
      ? (hour >= qh.start || hour < qh.end)
      : (hour >= qh.start && hour < qh.end)
    if (inQuiet) {
      at.setHours(qh.end, 0, 0, 0)
      if (wraps && hour >= qh.start) at.setDate(at.getDate() + 1)
    }
  }

  return at
}

export async function ensureChannel() {
  if (!isNative()) return
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Personal CRM reminders',
      description: 'Tasks, follow-ups, birthdays and events — on this device only.',
      importance: 4,
      visibility: 1,
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#818cf8',
    })
  } catch { /* older devices / channel exists */ }
}

export async function checkPermission() {
  if (isNative()) {
    try {
      const r = await LocalNotifications.checkPermissions()
      return r?.display || 'prompt'
    } catch { return 'unknown' }
  }
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission === 'default' ? 'prompt' : Notification.permission
}

export async function requestPermission() {
  if (isNative()) {
    try {
      await ensureChannel()
      const r = await LocalNotifications.requestPermissions()
      return r?.display || 'denied'
    } catch { return 'denied' }
  }
  if (typeof Notification === 'undefined') return 'unsupported'
  try {
    const p = await Notification.requestPermission()
    return p
  } catch { return 'denied' }
}

/**
 * Schedule (or refresh) OS reminders from the in-app notification list.
 * Only active, non-dismissed, future items are scheduled. Past-due items
 * fire once ~15s from now so the user still sees them on next unlock.
 *
 * @param {object[]} notifs  from buildNotifications()
 * @param {{enabled?:boolean, canRemind?:boolean}} opts
 */
export async function syncReminders(notifs = [], opts = {}) {
  const prefs = readPrefs()
  const enabled = opts.enabled !== false && prefs.enabled !== false
  const canRemind = opts.canRemind !== false
  if (!enabled || !canRemind) {
    await cancelAll()
    return { ok: true, scheduled: 0, reason: !canRemind ? 'pro-required' : 'disabled' }
  }

  const perm = await checkPermission()
  writePrefs({ ...prefs, permission: perm, lastSyncAt: new Date().toISOString() })
  if (perm !== 'granted') return { ok: false, scheduled: 0, reason: 'permission', permission: perm }

  await ensureChannel()

  const now = Date.now()
  const horizon = now + 1000 * 60 * 60 * 24 * 21 // 21 days ahead
  const candidates = []
  for (const n of notifs) {
    if (!n || !n.active) continue
    if (n.type === 'system') continue
    let at = fireAtFor(n, prefs)
    if (!at) continue
    let t = at.getTime()
    if (t < now - 1000 * 60 * 60 * 12) continue // too far past
    if (t < now + 5000) t = now + 15_000 // fire soon if already due
    if (t > horizon) continue
    candidates.push({
      id: notifIdFromKey(n.key),
      key: n.key,
      title: n.title || BRAND.app,
      body: n.body || '',
      at: new Date(t),
      extra: { key: n.key, type: n.type, contactId: n.contactId || null, taskId: n.taskId || null, eventId: n.eventId || null },
    })
  }

  /* de-dupe by id */
  const byId = new Map()
  candidates.forEach(c => byId.set(c.id, c))
  const list = [...byId.values()].slice(0, 64) // OS-friendly cap

  if (isNative()) {
    try {
      const pending = await LocalNotifications.getPending()
      const pendingIds = (pending?.notifications || []).map(x => x.id)
      if (pendingIds.length) {
        await LocalNotifications.cancel({ notifications: pendingIds.map(id => ({ id })) })
      }
    } catch { /* first run */ }

    if (list.length) {
      try {
        await LocalNotifications.schedule({
          notifications: list.map(c => ({
            id: c.id,
            title: c.title,
            body: c.body,
            schedule: { at: c.at, allowWhileIdle: true },
            channelId: CHANNEL_ID,
            extra: c.extra,
            smallIcon: 'ic_stat_icon_config_sample',
            largeIcon: 'ic_launcher',
            autoCancel: true,
            group: 'pcrm',
          })),
        })
      } catch (e) {
        return { ok: false, scheduled: 0, reason: String(e?.message || e) }
      }
    }
    return { ok: true, scheduled: list.length, platform: 'native' }
  }

  /* Web: we cannot truly schedule far-ahead without a service worker + periodicsync.
     Best effort: fire any that are due within the next few minutes via setTimeout,
     and show a one-shot when the tab is open. Persist the plan for the SW. */
  try {
    const plan = list.map(c => ({
      id: c.id, key: c.key, title: c.title, body: c.body,
      at: c.at.toISOString(), extra: c.extra,
    }))
    localStorage.setItem('pcrm-reminder-plan', JSON.stringify(plan))
    /* arm near-term timers (tab must stay open / PWA alive) */
    if (typeof window !== 'undefined') {
      window.__pcrmReminderTimers?.forEach(clearTimeout)
      window.__pcrmReminderTimers = []
      plan.forEach(p => {
        const delay = new Date(p.at).getTime() - Date.now()
        if (delay > 0 && delay < 1000 * 60 * 60 * 6) {
          const t = setTimeout(() => {
            try {
              if (Notification.permission === 'granted') {
                new Notification(p.title, {
                  body: p.body,
                  tag: p.key,
                  icon: './icons/icon-192.png',
                  data: p.extra,
                })
              }
            } catch {}
          }, delay)
          window.__pcrmReminderTimers.push(t)
        }
      })
    }
  } catch {}
  return { ok: true, scheduled: list.length, platform: 'web' }
}

export async function cancelAll() {
  if (isNative()) {
    try {
      const pending = await LocalNotifications.getPending()
      const ids = (pending?.notifications || []).map(x => x.id)
      if (ids.length) await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) })
    } catch {}
  }
  try {
    localStorage.removeItem('pcrm-reminder-plan')
    if (typeof window !== 'undefined') {
      window.__pcrmReminderTimers?.forEach(clearTimeout)
      window.__pcrmReminderTimers = []
    }
  } catch {}
}

/** Immediate test ping (permission must already be granted). */
export async function sendTestNotification() {
  const perm = await checkPermission()
  if (perm !== 'granted') {
    const p = await requestPermission()
    if (p !== 'granted') return { ok: false, reason: 'permission', permission: p }
  }
  await ensureChannel()
  const title = BRAND.app || 'Personal CRM'
  const body = 'Reminders work on this device. Nudges stay local — nothing leaves your phone.'
  if (isNative()) {
    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: 900001,
          title,
          body,
          schedule: { at: new Date(Date.now() + 1500) },
          channelId: CHANNEL_ID,
          autoCancel: true,
        }],
      })
      return { ok: true, platform: 'native' }
    } catch (e) {
      return { ok: false, reason: String(e?.message || e) }
    }
  }
  try {
    new Notification(title, { body, icon: './icons/icon-192.png', tag: 'pcrm-test' })
    return { ok: true, platform: 'web' }
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) }
  }
}

export async function getPendingCount() {
  if (!isNative()) {
    try {
      const plan = JSON.parse(localStorage.getItem('pcrm-reminder-plan') || '[]')
      return Array.isArray(plan) ? plan.length : 0
    } catch { return 0 }
  }
  try {
    const p = await LocalNotifications.getPending()
    return (p?.notifications || []).length
  } catch { return 0 }
}
