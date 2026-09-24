/* Personal CRM — offline-first service worker
 * The whole app builds to ONE inlined HTML file, so caching the shell = offline app. */
const VERSION = 'pcrm-v5'
/* OCR assets under ./ocr/ are cache-first on first use (too large to precache). */
const SHELL = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  if (request.method !== 'GET') return

  /* navigations: network-first, fall back to cached shell (true offline) */
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone()
          caches.open(VERSION).then(c => c.put('./index.html', copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    )
    return
  }

  /* everything else (icons, manifest): cache-first with background fill */
  e.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(res => {
      if (res.ok && new URL(request.url).origin === location.origin) {
        const copy = res.clone()
        caches.open(VERSION).then(c => c.put(request, copy)).catch(() => {})
      }
      return res
    }).catch(() => hit))
  )
})

/* Open the app (and deep-link when extra.key is present) when the user taps a reminder. */
self.addEventListener('notificationclick', event => {
  event.notification.click && event.notification.close()
  try { event.notification.close() } catch {}
  const data = event.notification.data || {}
  let path = './'
  if (data.type === 'task') path = './#/tasks'
  else if (data.type === 'follow-up' || data.type === 'birthday') path = './#/contacts' + (data.contactId ? ('?open=' + data.contactId) : '')
  else if (data.type === 'event') path = './#/calendar'
  else path = './#/notifications'
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if ('focus' in c) { try { await c.focus(); c.navigate && c.navigate(path) } catch {}; return }
    }
    if (clients.openWindow) return clients.openWindow(path)
  })())
})
