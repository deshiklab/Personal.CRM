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
