/* System notifications for reminders.
 * Android: @capacitor/local-notifications schedules real notifications that
 * fire with the app closed (system default sound — custom sounds would need
 * raw resources in the APK). Web: Notification API while the tab is open.
 * Everything degrades to the in-app overlay. */
import { isNative } from './google'

/* string id → stable int32 for the native scheduler */
export const notifId = str => {
  let h = 0
  for (let i = 0; i < String(str).length; i++) h = (h * 31 + String(str).charCodeAt(i)) | 0
  return Math.abs(h) || 1
}

export async function notifyPermissionState() {
  try {
    if (isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const perm = await LocalNotifications.checkPermissions()
      return perm.display === 'granted' ? 'granted' : 'denied'
    }
    if (typeof Notification !== 'undefined') return Notification.permission // 'default'|'granted'|'denied'
    return 'unavailable'
  } catch { return 'unavailable' }
}

export async function requestNotifyPermission() {
  try {
    if (isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const perm = await LocalNotifications.requestPermissions()
      return perm.display === 'granted' ? 'granted' : 'denied'
    }
    if (typeof Notification !== 'undefined') {
      return await Notification.requestPermission()
    }
    return 'unavailable'
  } catch { return 'unavailable' }
}

/* schedule future reminders as native notifications (Android) */
export async function scheduleNative(reminders) {
  if (!isNative()) return 0
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const ats = reminders
      .filter(r => r.at && r.status === 'scheduled')
      .map(r => ({ at: new Date(r.at) }))
      .filter(x => x.at > new Date())
    if (!ats.length) return 0
    await LocalNotifications.schedule({
      notifications: reminders
        .filter(r => r.at && r.status === 'scheduled' && new Date(r.at) > new Date())
        .map(r => ({
          id: notifId(r.id),
          title: r.title || 'Reminder',
          body: r.body || '',
          schedule: { at: new Date(r.at) },
          smallIcon: 'ic_launcher',
          extra: { reminderId: r.id },
        })),
    })
    return reminders.length
  } catch { return 0 }
}

export async function cancelNative(ids) {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: ids.map(id => ({ id: notifId(id) })) })
  } catch { /* already gone */ }
}

/* one-shot system notification (web + as an immediate native ping) */
export function notifyNow(title, body) {
  try {
    if (!isNative() && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, tag: 'pcrm-reminder' })
      return true
    }
  } catch { /* blocked */ }
  return false
}
