/* Note / task / message templates — starters + user-saved, 100% local. */
import * as storage from './storage'

const KEY = 'pcrm-templates'

export const STARTERS = [
  {
    id: 's_note_call',
    kind: 'note',
    name: 'Call log',
    title: 'Call log',
    body: 'Spoke with {name}.\n• Topics:\n• Next step:\n• Mood / tone:',
  },
  {
    id: 's_note_meet',
    kind: 'note',
    name: 'Meeting notes',
    title: 'Meeting with {name}',
    body: 'Date:\nAttendees:\n\nAgenda\n-\n\nDecisions\n-\n\nFollow-ups\n-',
  },
  {
    id: 's_note_intro',
    kind: 'note',
    name: 'How we met',
    title: 'How we met',
    body: 'Met {name} at …\nContext:\nMutual connection:\nWhat they care about:',
  },
  {
    id: 's_task_follow',
    kind: 'task',
    name: 'Follow up',
    title: 'Follow up with {name}',
    body: '',
  },
  {
    id: 's_task_send',
    kind: 'task',
    name: 'Send proposal',
    title: 'Send proposal to {name}',
    body: '',
  },
  {
    id: 's_task_thank',
    kind: 'task',
    name: 'Thank-you note',
    title: 'Send thank-you to {name}',
    body: '',
  },
  {
    id: 's_msg_checkin',
    kind: 'message',
    name: 'Friendly check-in',
    title: 'Check-in',
    body: 'Hi {name} — hope you are well. Wanted to check in and see how things are going on your side. Free for a quick chat this week?',
  },
  {
    id: 's_msg_thanks',
    kind: 'message',
    name: 'Thank you',
    title: 'Thank you',
    body: 'Hi {name}, thank you again for your time today. I really appreciated the conversation and will follow up on the next steps we discussed.',
  },
  {
    id: 's_msg_birthday',
    kind: 'message',
    name: 'Birthday wish',
    title: 'Happy birthday',
    body: 'Happy birthday, {name}! Wishing you a wonderful year ahead.',
  },
]

export function loadUserTemplates() {
  const list = storage.getJSON(KEY, [])
  return Array.isArray(list) ? list : []
}

export function saveUserTemplates(list) {
  return storage.setJSON(KEY, Array.isArray(list) ? list : [])
}

export function allTemplates() {
  return [...loadUserTemplates(), ...STARTERS]
}

export function templatesByKind(kind) {
  return allTemplates().filter(t => !kind || t.kind === kind)
}

export function applyTemplate(tpl, vars = {}) {
  if (!tpl) return { title: '', body: '' }
  const fill = s => String(s || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`))
  return { title: fill(tpl.title || tpl.name || ''), body: fill(tpl.body || ''), kind: tpl.kind }
}

export function addUserTemplate({ kind = 'note', name, title, body }) {
  const list = loadUserTemplates()
  const item = {
    id: `u_${Date.now().toString(36)}`,
    kind,
    name: (name || title || 'Template').trim(),
    title: (title || name || '').trim(),
    body: body || '',
    createdAt: new Date().toISOString(),
  }
  list.unshift(item)
  saveUserTemplates(list)
  return item
}

export function deleteUserTemplate(id) {
  const list = loadUserTemplates().filter(t => t.id !== id)
  saveUserTemplates(list)
  return list
}

/** Ensure storage.OWNED_KEYS knows about templates (called once from main). */
export const TEMPLATE_STORAGE_KEY = KEY
