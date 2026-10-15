/* X7 — home-screen shortcuts (and any external deep link) land here.
 * Shortcuts fire VIEW intents like pcrm://quick/note — we map them to the
 * in-app hash route. Unknown links return null (ignored safely). */
export const QUICK_LINKS = {
  note:    { hash: '#/notes?new=1',   label: 'New note' },
  contact: { hash: '#/contacts?new=1', label: 'New contact' },
  kb:      { hash: '#/kb',           label: 'Knowledge Base' },
  files:   { hash: '#/files',        label: 'Files' },
  tasks:   { hash: '#/tasks',        label: 'Tasks' },
}

export function parseQuickLink(url) {
  try {
    const u = String(url || '')
    const m = /^(?:pcrm|capacitor|https?):\/\/quick\/([a-z]+)/i.exec(u)
      || /^[a-z]+:\/\/[^/]*\/#?\/?quick\/([a-z]+)/i.exec(u)
    if (!m) return null
    return QUICK_LINKS[m[1].toLowerCase()] || null
  } catch { return null }
}
