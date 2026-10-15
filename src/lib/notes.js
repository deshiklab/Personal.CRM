import { uid } from '../lib'
import { mdToText } from './markdown'

/* Keep-style palette — ids are stable (stored on notes). Hex values work on
 * both dark and light themes when used at low alpha as card backgrounds. */
export const NOTE_COLORS = {
  amber:  '#fbbf24',
  rose:   '#fb7185',
  sky:    '#38bdf8',
  mint:   '#34d399',
  violet: '#a78bfa',
  peach:  '#fb923c',
  lime:   '#a3e635',
  pink:   '#f472b6',
  cyan:   '#22d3ee',
  sand:   '#d4a574',
}
export const NOTE_COLOR_IDS = Object.keys(NOTE_COLORS)

export const noteColorHex = id => NOTE_COLORS[id] || null

/* Card background / border for a color id (theme-proof) */
export const noteColorStyle = id => {
  const hex = noteColorHex(id)
  if (!hex) return {}
  return { background: hex + '1c', borderColor: hex + '55' }
}

/* Every note gets the full v2 shape — old backups (title/body/…) still load. */
export const normalizeNote = n => ({
  id: uid(),
  title: '',
  body: '',
  kind: 'text',                 // 'text' | 'checklist'
  checklist: [],                // [{id, text, done}]
  color: null,
  labels: [],                   // note-label ids (NOT contact tags)
  attachments: [],              // [{fileId, name, mime, size}] — file store comes later
  pinned: false,
  archivedAt: null,
  trashedAt: null,
  remindAt: null,               // 'YYYY-MM-DDTHH:mm' (local) | null
  repeat: 'none',               // 'none' | 'daily' | 'weekly' | 'monthly'
  contactIds: [],
  mergedAt: null,
  createdAt: new Date().toISOString(),
  updated: new Date().toISOString(),
  ...n,
  /* repair shapes from old seeds/backups */
  contactIds: Array.isArray(n.contactIds) ? n.contactIds : [],
  checklist: Array.isArray(n.checklist) ? n.checklist : [],
  labels: Array.isArray(n.labels) ? n.labels : [],
})

export const noteWords = n =>
  (n.body || '').split(/\s+/).filter(Boolean).length +
  (n.checklist || []).reduce((s, c) => s + (c.text || '').split(/\s+/).filter(Boolean).length, 0)

export const notePlain = n => {
  const parts = [n.title, mdToText(n.body), ...(n.checklist || []).map(c => c.text)]
  return parts.filter(Boolean).join(' ')
}

export const noteChecked = n => (n.checklist || []).filter(c => c.done).length

/* Live notes: not archived, not trashed */
export const isActiveNote = n => !n.archivedAt && !n.trashedAt

/* Advance a repeating reminder to its next occurrence (local time, same format) */
export const pad2 = v => String(v).padStart(2, '0')
export const fmtLocalDT = d =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`

export function advanceReminder(remindAt, repeat) {
  if (!remindAt || !repeat || repeat === 'none') return null
  const d = new Date(remindAt)
  if (isNaN(d)) return null
  if (repeat === 'daily') d.setDate(d.getDate() + 1)
  else if (repeat === 'weekly') d.setDate(d.getDate() + 7)
  else if (repeat === 'monthly') d.setMonth(d.getMonth() + 1)
  return fmtLocalDT(d)
}

/* 30-day trash retention */
export const TRASH_RETENTION_DAYS = 30
export const isTrashExpired = n =>
  !!n.trashedAt && (Date.now() - new Date(n.trashedAt).getTime()) > TRASH_RETENTION_DAYS * 86400000

export const newChecklistItem = (text = '') => ({ id: uid(), text, done: false })
