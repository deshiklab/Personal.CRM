/* ICS export + Google Calendar template links — no auth needed, works everywhere */
const dt = (date, time) => `${date.replace(/-/g, '')}T${(time || '09:00').replace(':', '')}00`
const icsEsc = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n')

export const toICS = (events, contactById = {}) => [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PersonalCRM//EN', 'CALSCALE:GREGORIAN',
  ...events.map(e => [
    'BEGIN:VEVENT',
    `UID:${e.id}@personal-crm`,
    `DTSTART:${dt(e.date, e.time)}`,
    `DTEND:${dt(e.date, e.endTime || e.time)}`,
    `SUMMARY:${icsEsc(e.title)}`,
    e.location ? `LOCATION:${icsEsc(e.location)}` : null,
    e.contactId && contactById[e.contactId] ? `DESCRIPTION:With ${icsEsc(contactById[e.contactId].name)}` : null,
    'END:VEVENT',
  ].filter(Boolean).join('\r\n')),
  'END:VCALENDAR',
].join('\r\n')

export const downloadICS = (events, contactById, filename = 'personal-crm-events.ics') => {
  const blob = new Blob([toICS(events, contactById)], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

/** "Add to Google Calendar" URL — opens the genuine GCal UI, zero auth needed by us */
export const gcalTemplateUrl = (e, contact) => {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${dt(e.date, e.time)}/${dt(e.date, e.endTime || e.time)}`,
    ...(contact?.email ? { add: contact.email } : {}),
    ...(e.location ? { location: e.location } : {}),
    ...(contact ? { details: `With ${contact.name}${contact.phone ? ' · ' + contact.phone : ''}` } : {}),
  })
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

/* ── feed reading side (read-only, real calendars incl. public Google ICS) ── */
const unesc = s => s.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')

export const parseICS = text => {
  const lines = []
  text.replace(/\r\n|\r/g, '\n').split('\n').forEach(l => {
    if (/^[ \t]/.test(l) && lines.length) lines[lines.length - 1] += l.slice(1)
    else lines.push(l)
  })
  const dt = l => {
    const v = (l.split(':').slice(1).join(':') || '').trim()
    if (/^\d{8}$/.test(v)) return { date: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`, time: '09:00' }
    const m = v.match(/^(\d{8})T(\d{6})/)
    if (!m) return null
    const date = `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6, 8)}`
    if (/Z$/.test(v)) {
      const d = new Date(`${date}T${m[2].slice(0, 2)}:${m[2].slice(2, 4)}:00Z`)
      const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0')
      return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, time: `${hh}:${mm}` }
    }
    return { date, time: `${m[2].slice(0, 2)}:${m[2].slice(2, 4)}` }
  }
  const rows = []
  let cur = null
  lines.forEach(l => {
    if (l === 'BEGIN:VEVENT') cur = { title: '', date: '', time: '09:00', endTime: '', location: '', desc: '' }
    else if (l === 'END:VEVENT' && cur) { if (cur.title && cur.date) rows.push(cur); cur = null }
    else if (cur) {
      if (l.startsWith('SUMMARY')) cur.title = unesc(l.split(':').slice(1).join(':').trim())
      else if (l.startsWith('DTSTART')) { const d = dt(l); if (d) { cur.date = d.date; cur.time = d.time } }
      else if (l.startsWith('DTEND'))   { const d = dt(l); if (d) cur.endTime = d.time }
      else if (l.startsWith('LOCATION')) cur.location = unesc(l.split(':').slice(1).join(':').trim())
      else if (l.startsWith('DESCRIPTION')) cur.desc = unesc(l.split(':').slice(1).join(':').trim())
    }
  })
  rows.forEach(r => { if (!r.endTime) r.endTime = r.time })
  return rows
}

/* google & most providers block browser CORS on ICS URLs; a public read-only
   relay is OPTIONAL and only safe for public feeds — consent flag required */
export const RELAY_PREFIX = 'https://api.allorigins.win/raw?url='

export const fetchICS = async (url, { allowProxy = false } = {}) => {
  const grab = async u => {
    const r = await fetch(u)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const text = await r.text()
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('That URL did not return a calendar (.ics)')
    return text
  }
  try { return { text: await grab(url), via: 'direct' } }
  catch (e) {
    if (!allowProxy) throw Object.assign(new Error(e.message || 'fetch failed'), { needsProxy: true })
    try { return { text: await grab(RELAY_PREFIX + encodeURIComponent(url)), via: 'relay' } }
    catch (e2) { throw new Error(`relay failed: ${e2.message}`) }
  }
}
