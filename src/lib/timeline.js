/* Build a per-contact timeline from notes, tasks, events, activity (all local). */

const dayKey = iso => (iso || '').slice(0, 10)

/**
 * @param {object} c contact
 * @param {{ notes, tasks, events, activity }} data
 * @returns {Array<{ id, at, kind, title, body?, tone }>}
 */
export function buildContactTimeline(c, { notes = [], tasks = [], events = [], activity = [] } = {}) {
  if (!c?.id) return []
  const items = []

  notes.forEach(n => {
    if (!Array.isArray(n.contactIds) || !n.contactIds.includes(c.id)) return
    items.push({
      id: `note-${n.id}`,
      at: n.updated || n.updatedAt || n.createdAt || n.ts || '',
      kind: 'note',
      title: n.title || 'Note',
      body: (n.body || '').replace(/\s+/g, ' ').slice(0, 160),
      tone: '#38bdf8',
    })
  })

  tasks.forEach(t => {
    if (t.contactId !== c.id) return
    items.push({
      id: `task-${t.id}`,
      at: t.completedAt || t.updatedAt || t.updated || t.createdAt || t.due || '',
      kind: 'task',
      title: t.title || 'Task',
      body: t.column === 'done' ? 'Completed' : (t.due ? `Due ${t.due}` : (t.column || '')),
      tone: t.column === 'done' ? '#34d399' : '#fbbf24',
      done: t.column === 'done',
    })
  })

  events.forEach(e => {
    if (e.contactId !== c.id) return
    const at = e.date ? `${e.date}T${(e.time || '12:00')}:00` : (e.ts || '')
    items.push({
      id: `event-${e.id}`,
      at,
      kind: 'event',
      title: e.title || 'Event',
      body: e.date ? `${e.date}${e.time ? ' · ' + e.time : ''}` : '',
      tone: '#a78bfa',
    })
  })

  activity.forEach(a => {
    if (a.contactId !== c.id) return
    items.push({
      id: `act-${a.id}`,
      at: a.ts || '',
      kind: 'touch',
      title: a.text || 'Activity',
      body: '',
      tone: '#94a3b8',
    })
  })

  if (c.lastContact) {
    const has = items.some(i => dayKey(i.at) === dayKey(c.lastContact))
    if (!has) {
      items.push({
        id: `last-${c.id}`,
        at: c.lastContact.length === 10 ? `${c.lastContact}T12:00:00` : c.lastContact,
        kind: 'touch',
        title: 'Last logged contact',
        body: '',
        tone: '#818cf8',
      })
    }
  }

  items.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
  return items
}

export const TIMELINE_KIND_I18N = {
  note: 'contacts.timelineNote',
  task: 'contacts.timelineTask',
  event: 'contacts.timelineEvent',
  touch: 'contacts.timelineTouch',
}
