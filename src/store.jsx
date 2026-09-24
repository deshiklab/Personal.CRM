import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as seed from './data/seed'
import { uid, todayISO, daysAheadISO, diffDays, daysUntil } from './lib'
import * as goog from './lib/google'
import * as icslib from './lib/ics'
import * as ds from './lib/drivesync'
import * as gs from './lib/gistsync'
import { notifyOwner, notifyConfigured } from './lib/notify'
import * as snap from './lib/snapshots'
import * as secrets from './lib/secrets'
import * as storage from './lib/storage'

const KEY = 'pcrm-v1'
/* Fields that must be arrays. A half-written or hand-edited blob should lose
 * the broken field and fall back to the seed — not take the whole app down. */
const ARRAY_FIELDS = ['contacts', 'tasks', 'events', 'notes', 'tags', 'groups', 'rules', 'audit', 'activity', 'imports', 'emails', 'kbArticles']
const load = () => {
  let s
  try { s = JSON.parse(storage.getItem(KEY) || 'null') } catch { return null }
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null
  ARRAY_FIELDS.forEach(k => { if (s[k] != null && !Array.isArray(s[k])) delete s[k] })
  return s
}

/* ── groups model ────────────────────────────────────────────────────────────
 * A contact can belong to MANY groups. `groupIds: []` is the canonical field;
 * the legacy single `groupId` is kept in sync (always groupIds[0]) so older
 * backups, the CSV/vCard exporters and the graph keep working unchanged. */
export const contactGroupIds = c =>
  Array.isArray(c?.groupIds) ? c.groupIds.filter(Boolean)
    : (c?.groupId ? [c.groupId] : [])
const normalizeContact = c => {
  const ids = [...new Set((Array.isArray(c.groupIds) ? c.groupIds : (c.groupId ? [c.groupId] : [])).filter(Boolean))]
  return { ...c, groupIds: ids, groupId: ids[0] || null }
}

const DEFAULT_WIDGET_ORDER = ['stats','growth','taskCols','upcoming','stayInTouch','syncHealth','birthdays','topTags','overdueCountdown','taskHeatmap','activityFeed']
const Ctx = createContext(null)
export const useCrm = () => useContext(Ctx)

export function CrmProvider({ children }) {
  const init = load()
  const [contacts, setContacts]   = useState(() => (init?.contacts || seed.CONTACTS).map(normalizeContact))
  const [tasks, setTasks]         = useState(init?.tasks     || seed.TASKS)
  const [events, setEvents]       = useState(init?.events    || seed.EVENTS)
  const [notes, setNotes]         = useState(init?.notes     || seed.NOTES)
  const [tags, setTags]           = useState(init?.tags      || seed.TAGS)
  const [groups, setGroups]       = useState(init?.groups    || seed.GROUPS)
  const [rules, setRules]         = useState(init?.rules     || seed.SYNC_RULES)
  const [audit, setAudit]         = useState(init?.audit     || seed.AUDIT)
  const [activity, setActivity]   = useState(init?.activity  || seed.ACTIVITY)
  const [imports, setImports]     = useState(init?.imports   || seed.IMPORTS)
  const [relFreq, setRelFreq]     = useState(init?.relFreq   || seed.REL_FREQ)
  const [snoozes, setSnoozes]     = useState(init?.snoozes   || {})
  const [gcal, setGcal]           = useState(init?.gcal      || seed.GCAL)
  const [mailboxes, setMailboxes] = useState(init?.mailboxes || {
    gmail:   { connected: false, address: '', lastSync: null },
    outlook: { connected: false, address: '', lastSync: null },
  })
  const [emails, setEmails]       = useState(init?.emails    || [])
  const [notifState, setNotifState] = useState(init?.notifState || {})
  const [notifPrefs, setNotifPrefs] = useState(init?.notifPrefs || { task: true, 'follow-up': true, birthday: true, event: true, system: true })
  const [widgetPrefs, setWidgetPrefs] = useState(init?.widgetPrefs || { order: DEFAULT_WIDGET_ORDER, hidden: [] })
  const [toasts, setToasts]       = useState([])
  /* google workspace (8b/live): clientId persisted, token in memory only */
  const [googleClientId, setGoogleClientId] = useState(init?.googleClientId || '')
  const [gtoken, setGtoken] = useState(null)
  const [driveState, setDriveState] = useState(init?.driveState || { fileId: null, lastBackup: null, lastRestore: null, lastContactsSync: null })
  const [icsFeeds, setIcsFeeds] = useState(init?.icsFeeds || [])
  /* multi-device sync: one personal-crm-sync.json in the user's Drive */
  const [syncState, setSyncState] = useState(init?.syncState || {
    deviceId: uid(), enabled: true, lastRev: 0, lastSyncAt: null, baselineData: null, baselineHash: '',
  })
  const [syncing, setSyncing] = useState(false)
  /* registered user profile (device-local): null = not registered,
   * { skipped:true } = deliberately skipped, otherwise { name, email, mobile, verified:{} } */
  const [profile, setProfile] = useState(init?.profile || null)
  /* app lock (per-device pincode): null = never offered | {hash:null,skipped} = skipped/off | {salt,hash} = locked */
  const [lock, setLock] = useState(init?.lock || null)
  const [sessionUnlocked, setSessionUnlocked] = useState(false)   // in-memory only
  /* github gist is the no-OAuth sync backend: token + created gist id */
  const [gist, setGist] = useState(() => ({ token: secrets.getGistToken(), gistId: init?.gist?.gistId || null }))
  const syncBusy = useRef(false)
  const [syncReport, setSyncReport] = useState(null)     // { conflicts, fromRemote, rev }
  /* knowledge base: articles the user wrote themselves + help preferences.
   * Both live with the rest of the data so they travel in every backup. */
  const [kbArticles, setKbArticles] = useState(init?.kbArticles || [])
  const [helpPrefs, setHelpPrefs]   = useState(init?.helpPrefs || {
    tips: true, tourDone: false, tourStep: 0, tourStarted: false, onboardDone: false, bookmarks: [], votes: {}, seenVersion: '',
  })
  const [webhooks, setWebhooks]   = useState(init?.webhooks || {
    url: '', on: { lead: true, contact: false, task_done: true, touch: false }, log: [],
  })

  const [theme, setTheme]         = useState(() => storage.getItem('pcrm-theme') || 'dark')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    storage.setItem('pcrm-theme', theme)
  }, [theme])
  const toggleTheme = () => { setTheme(t => t === 'dark' ? 'light' : 'dark') }

  const wiping = useRef(false)
  useEffect(() => {
    if (wiping.current) return          // a factory reset owns storage now
    try {
      storage.setItem(KEY, JSON.stringify({
        contacts, tasks, events, notes, tags, groups, rules, audit,
        activity, imports, relFreq, snoozes, gcal, notifState, notifPrefs, widgetPrefs, mailboxes, emails, googleClientId, driveState, webhooks, icsFeeds, syncState, lock, profile,
        kbArticles, helpPrefs,
        gist: { gistId: gist.gistId },   // the token is kept apart — see lib/secrets
      }))
    } catch {}
  }, [contacts, tasks, events, notes, tags, groups, rules, audit, activity, imports, relFreq, snoozes, gcal, notifState, notifPrefs, widgetPrefs, mailboxes, emails, googleClientId, driveState, webhooks, icsFeeds, syncState, gist, lock, profile, kbArticles, helpPrefs])

  /* the gist token is mirrored into its own key — never into the data blob */
  useEffect(() => { secrets.setGistToken(gist.token) }, [gist.token])

  /* ── toasts ── */
  const toast = (msg, tone = 'ok') => {
    const id = uid()
    setToasts(t => [...t, { id, msg, tone }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2800)
  }

  /* ── audit & activity ── */
  const logAudit = (actor, action, entity, detail, status = 'ok') =>
    setAudit(a => [{ id: uid(), ts: new Date().toISOString(), actor, action, entity, detail, status }, ...a].slice(0, 300))
  const logActivity = (text, contactId = null) =>
    setActivity(a => [{ id: uid(), ts: new Date().toISOString(), text, contactId }, ...a].slice(0, 200))

  /* ── lookups ── */
  const contactById = useMemo(() => Object.fromEntries(contacts.map(c => [c.id, c])), [contacts])
  const groupById   = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups])
  const tagById     = useMemo(() => Object.fromEntries(tags.map(t => [t.id, t])), [tags])

  /* ── contacts ── */
  const addContact = data => {
    const c = normalizeContact({ id: uid(), role: '', company: '', phone: '', email: '', birthday: null, tags: [], rel: 'acquaintance', starred: false, introducedBy: null, interests: [], socials: {}, photo: null, cardImage: null, address: '', lastContact: todayISO(), createdAt: todayISO(), ...data })
    setContacts(cs => [c, ...cs])
    logAudit('user', 'Added contact', c.name, c.company || 'No company')
    fireWebhook('contact', { name: c.name, email: c.email, phone: c.phone, group: c.groupIds[0] })
    if (c.rel === 'lead') fireWebhook('lead', { name: c.name, email: c.email, phone: c.phone, source: data.source || 'crm' })
    return c
  }
  const updateContact = (id, patch) => setContacts(cs => cs.map(c => {
    if (c.id !== id) return c
    if (patch.groupIds === undefined && patch.groupId === undefined) return { ...c, ...patch }
    const ids = Array.isArray(patch.groupIds) ? patch.groupIds : (patch.groupId ? [patch.groupId] : [])
    return normalizeContact({ ...c, ...patch, groupIds: [...new Set(ids.filter(Boolean))] })
  }))
  const toggleStar = id => setContacts(cs => cs.map(c => c.id === id ? { ...c, starred: !c.starred } : c))
  const markContacted = id => {
    setContacts(cs => cs.map(c => c.id === id ? { ...c, lastContact: todayISO() } : c))
    setSnoozes(s => { const n = { ...s }; delete n[id]; return n })
    const c = contactById[id]
    if (c) { logActivity(`Logged contact with ${c.name}`, id); logAudit('user', 'Logged contact', c.name, 'Via follow-up tracker'); fireWebhook('touch', { name: c.name, channel: 'manual' }) }
    toast(`Marked ${c?.name?.split(' ')[0] || 'contact'} as contacted — nice!`)
  }

  /* delete a contact: tasks/events/notes are kept but unlinked, nothing cascades */
  const deleteContact = id => {
    const c = contactById[id]
    if (!c) return false
    setContacts(cs => cs.filter(x => x.id !== id))
    setTasks(ts => ts.map(t => t.contactId === id ? { ...t, contactId: null } : t))
    setEvents(es => es.map(e => e.contactId === id ? { ...e, contactId: null } : e))
    setNotes(ns => ns.map(n => (n.contactIds || []).includes(id) ? { ...n, contactIds: n.contactIds.filter(x => x !== id) } : n))
    setSnoozes(s => { const n = { ...s }; delete n[id]; return n })
    logAudit('user', 'Deleted contact', c.name, 'Tasks & events kept but unlinked', 'warn')
    logActivity(`Deleted contact ${c.name}`)
    toast(`Deleted ${c.name}`, 'warn')
    return true
  }
  const bulkDeleteContacts = ids => {
    const set = new Set(ids)
    const names = contacts.filter(c => set.has(c.id)).map(c => c.name)
    if (!names.length) return 0
    setContacts(cs => cs.filter(c => !set.has(c.id)))
    setTasks(ts => ts.map(t => set.has(t.contactId) ? { ...t, contactId: null } : t))
    setEvents(es => es.map(e => set.has(e.contactId) ? { ...e, contactId: null } : e))
    setNotes(ns => ns.map(n => ({ ...n, contactIds: (n.contactIds || []).filter(x => !set.has(x)) })))
    setSnoozes(s => { const n = { ...s }; ids.forEach(i => delete n[i]); return n })
    logAudit('user', 'Bulk-deleted contacts', `${names.length} contact(s)`, names.slice(0, 6).join(', ') + (names.length > 6 ? '…' : ''), 'warn')
    logActivity(`Deleted ${names.length} contact${names.length === 1 ? '' : 's'}`)
    toast(`Deleted ${names.length} contact${names.length === 1 ? '' : 's'}`, 'warn')
    return names.length
  }
  /* mode: 'add' | 'remove' | 'set' (set replaces the whole group list) */
  const bulkSetGroups = (contactIds, groupIds, mode = 'add') => {
    const set = new Set(contactIds)
    const names = groupIds.map(id => groupById[id]?.name).filter(Boolean)
    setContacts(cs => cs.map(c => {
      if (!set.has(c.id)) return c
      const cur = contactGroupIds(c)
      const next = mode === 'add' ? [...new Set([...cur, ...groupIds])]
        : mode === 'remove' ? cur.filter(x => !groupIds.includes(x))
        : [...new Set(groupIds.filter(Boolean))]
      return normalizeContact({ ...c, groupIds: next })
    }))
    logAudit('user', mode === 'add' ? 'Bulk added to groups' : mode === 'remove' ? 'Bulk removed from groups' : 'Bulk set groups',
      names.join(', ') || '—', `${contactIds.length} contact(s)`)
    toast(mode === 'add' ? `Added ${contactIds.length} contact(s) to ${names.join(', ')}`
      : mode === 'remove' ? `Removed ${contactIds.length} contact(s) from ${names.join(', ')}`
      : `Group set for ${contactIds.length} contact(s)`)
  }

  /* ── notes ── */
  const addNote = data => {
    const n = { id: uid(), pinned: false, updated: new Date().toISOString(), ...data }
    setNotes(ns => [n, ...ns])
    logActivity(`Added note: "${data.title}"`, data.contactIds?.[0] || null)
    return n
  }
  const updateNote = (id, patch) =>
    setNotes(ns => ns.map(n => n.id === id ? { ...n, ...patch, updated: new Date().toISOString() } : n))
  const deleteNote = id => {
    const n = notes.find(x => x.id === id)
    setNotes(ns => ns.filter(x => x.id !== id))
    if (n) logAudit('user', 'Deleted note', n.title || 'Untitled')
  }

  /* ── tasks ── */
  const addTask = data => {
    const t = { id: uid(), column: 'todo', priority: 'med', due: null, contactId: null, tags: [], ...data }
    setTasks(ts => [...ts, t])
    logAudit('user', 'Created task', t.title, `Column: ${t.column}${t.due ? ` · due ${t.due}` : ''}`)
    return t
  }
  const moveTask = (id, column) => {    const t = tasks.find(x => x.id === id)
    setTasks(ts => ts.map(x => x.id === id ? { ...x, column } : x))
    if (t && t.column !== column) logAudit('user', 'Moved task', t.title, `${t.column} → ${column}`)
  }
  const updateTask = (id, patch) => {
    const t = tasks.find(x => x.id === id)
    setTasks(ts => ts.map(x => x.id === id ? { ...x, ...patch } : x))
    if (t && patch.column === 'done' && t.column !== 'done') { logActivity(`Task completed: ${t.title}`); fireWebhook('task_done', { title: t.title, contactId: t.contactId, due: t.due }) }
  }
  const deleteTask = id => {
    const t = tasks.find(x => x.id === id)
    setTasks(ts => ts.filter(x => x.id !== id))
    if (t) { logAudit('user', 'Deleted task', t.title, `Column: ${t.column}`); toast('Task deleted', 'warn') }
  }
  const duplicateTask = id => {
    const t = tasks.find(x => x.id === id)
    if (!t) return
    const copy = { ...t, id: uid(), title: `${t.title} (copy)`, column: 'todo',
      subtasks: (t.subtasks || []).map((s, i) => ({ ...s, id: uid() + i, done: false })) }
    setTasks(ts => [...ts, copy])
    logAudit('user', 'Duplicated task', t.title, 'New copy in To do')
    toast('Task duplicated to To do')
    return copy
  }
  const createFollowUpTask = cid => {
    const c = contactById[cid]
    if (!c) return
    addTask({ title: `Reconnect with ${c.name}`, column: 'todo', priority: 'med', due: todayISO(), contactId: cid })
    logActivity(`Created follow-up task for ${c.name}`, cid)
    toast(`Task created: reconnect with ${c.name.split(' ')[0]}`)
  }

  /* ── events ── */
  const addEvent = data => {
    const e = { id: uid(), time: '10:00', endTime: '10:30', type: 'meeting', contactId: null, gcal: gcal.connected ? 'synced' : 'local', location: '', ...data }
    setEvents(es => [...es, e])
    logAudit('user', 'Created event', e.title, `${e.date} ${e.time}`)
    return e
  }
  const moveEvent = (id, newDate) => {
    setEvents(es => es.map(e => e.id === id ? { ...e, date: newDate } : e))
    const e = events.find(x => x.id === id)
    if (e) { logAudit('user', 'Rescheduled event', e.title, `Moved to ${newDate}`); toast(`Rescheduled to ${newDate}`) }
  }
  const deleteEvent = id => {
    const e = events.find(x => x.id === id)
    setEvents(es => es.filter(x => x.id !== id))
    if (e) logAudit('user', 'Deleted event', e.title, e.date)
  }

  /* ── tags ── */
  const addTag = data => {
    const t = { id: uid(), name: 'New tag', color: seed.TAG_COLORS[tags.length % seed.TAG_COLORS.length], icon: '🏷️', ...data }
    setTags(ts => [...ts, t])
    logAudit('user', 'Created tag', t.name)
    return t
  }
  const updateTag = (id, patch) => setTags(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t))
  const deleteTag = id => {
    const t = tagById[id]
    setTags(ts => ts.filter(x => x.id !== id))
    setContacts(cs => cs.map(c => c.tags.includes(id) ? { ...c, tags: c.tags.filter(x => x !== id) } : c))
    if (t) logAudit('user', 'Deleted tag', t.name, 'Removed from all contacts')
  }
  const mergeTags = (fromId, toId) => {
    const from = tagById[fromId], to = tagById[toId]
    setContacts(cs => cs.map(c => {
      if (!c.tags.includes(fromId)) return c
      const merged = c.tags.filter(x => x !== fromId)
      if (!merged.includes(toId)) merged.push(toId)
      return { ...c, tags: merged }
    }))
    setTags(ts => ts.filter(x => x.id !== fromId))
    if (from && to) logAudit('user', 'Merged tags', `${from.name} → ${to.name}`, 'Contacts retagged')
    toast(`Merged "${from?.name}" into "${to?.name}"`)
  }
  const bulkTag = (contactIds, tagId, mode) => {
    const t = tagById[tagId]
    setContacts(cs => cs.map(c => {
      if (!contactIds.includes(c.id)) return c
      const has = c.tags.includes(tagId)
      if (mode === 'add' && !has) return { ...c, tags: [...c.tags, tagId] }
      if (mode === 'remove' && has) return { ...c, tags: c.tags.filter(x => x !== tagId) }
      return c
    }))
    logAudit('user', mode === 'add' ? 'Bulk-tagged contacts' : 'Bulk-untagged contacts', t?.name || tagId, `${contactIds.length} contact(s)`)
    toast(`${mode === 'add' ? 'Added' : 'Removed'} tag on ${contactIds.length} contact(s)`)
  }

  /* ── groups ── */
  const addGroup = data => {
    const g = { id: uid(), color: '#38bdf8', desc: '', ...data }
    setGroups(gs => [...gs, g])
    logAudit('user', 'Created group', g.name)
    return g
  }
  const updateGroup = (id, patch) => {
    const g = groupById[id]
    setGroups(gs => gs.map(x => x.id === id ? { ...x, ...patch } : x))
    if (g) logAudit('user', 'Updated group', g.name, Object.keys(patch).join(', '))
  }
  /* deleting a group only detaches it — contacts themselves are never deleted */
  const deleteGroup = id => {
    const g = groupById[id]
    if (!g) return 0
    const affected = contacts.filter(c => contactGroupIds(c).includes(id)).length
    setGroups(gs => gs.filter(x => x.id !== id))
    setContacts(cs => cs.map(c => contactGroupIds(c).includes(id)
      ? normalizeContact({ ...c, groupIds: contactGroupIds(c).filter(x => x !== id) }) : c))
    setRules(rs => rs.map(r => ({ ...r, scopeGroups: (r.scopeGroups || []).filter(x => x !== id) })))
    logAudit('user', 'Deleted group', g.name, `Detached from ${affected} contact(s)`, 'warn')
    toast(`Group "${g.name}" deleted — ${affected} contact(s) kept`, 'warn')
    return affected
  }

  /* ── sync rules ── */
  const addRule = data => {
    const r = { id: uid(), enabled: true, scope: 'all', scopeGroups: [], scopeTags: [], lastRun: null, ...data }
    setRules(rs => [...rs, r])
    logAudit('user', 'Created sync rule', r.name, `${r.source} · ${r.direction} · ${r.frequency} · conflict: ${r.conflict}`)
    return r
  }
  const updateRule = (id, patch) => setRules(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))
  const toggleRule = id => {
    const r = rules.find(x => x.id === id)
    setRules(rs => rs.map(x => x.id === id ? { ...x, enabled: !x.enabled } : x))
    if (r) logAudit('user', r.enabled ? 'Paused sync rule' : 'Resumed sync rule', r.name)
  }
  const deleteRule = id => {
    const r = rules.find(x => x.id === id)
    setRules(rs => rs.filter(x => x.id !== id))
    if (r) logAudit('user', 'Deleted sync rule', r.name)
  }
  /* A rule only runs when this build can genuinely do the work. Google calls
   * need your own Client ID; ICS feeds are always real; and anything we cannot
   * reach from a browser (CardDAV, Outlook) is refused out loud — never faked. */
  const runRuleNow = async id => {
    const r = rules.find(x => x.id === id)
    if (!r) return false
    const src = String(r.source || '')
    const stamp = ok => setRules(rs => rs.map(x => x.id === id ? { ...x, lastRun: new Date().toISOString(), lastResult: ok ? 'ok' : 'skipped' } : x))
    const needsClientId = () => { toast(`${r.name}: add your Google Client ID first — Settings → Google hub`, 'warn'); logAudit('rule', 'Rule skipped', r.name, 'No Google Client ID — local mode'); return false }
    try {
      if (/^google contacts/i.test(src)) {
        if (googleMode !== 'live') return needsClientId()
        await syncGoogleContacts()
        stamp(true); logAudit('rule', 'Rule run', r.name, 'Google People import'); return true
      }
      if (/^google calendar/i.test(src)) {
        if (googleMode !== 'live') return needsClientId()
        const done = await syncGoogleCalendar()
        stamp(!!done); logAudit('rule', 'Rule run', r.name, done ? 'Google Calendar sync' : 'Google Calendar sync failed'); return !!done
      }
      if (/^ics feed|^ics\b|^subscribed/i.test(src)) {
        if (!icsFeeds.length) {
          toast(`${r.name}: no calendar feeds subscribed yet — add one in Integrations`, 'warn')
          logAudit('rule', 'Rule skipped', r.name, 'No ICS feeds subscribed'); return false
        }
        let added = 0
        for (const f of icsFeeds) { const res = await syncIcsFeed(f.id); if (typeof res === 'number') added += res; else if (res) added += 1 }
        stamp(true)
        toast(`📆 ${r.name}: ${icsFeeds.length} feed${icsFeeds.length > 1 ? 's' : ''} refreshed · ${added} new event${added === 1 ? '' : 's'}`)
        logAudit('rule', 'Rule run', r.name, `${icsFeeds.length} feeds · ${added} new events`); return true
      }
      if (/^vcard|^\.vcf|vcard file/i.test(src)) {
        toast(`${r.name}: vCard import is a file you pick — use Integrations → Import vCard`, 'warn')
        logAudit('rule', 'Rule skipped', r.name, 'vCard needs a file, not a schedule'); return false
      }
      toast(`${r.name}: ${r.source || 'this source'} cannot be reached from a browser app — no server sits in the middle, so this build will not pretend to sync it`, 'warn')
      logAudit('rule', 'Rule not supported', r.name, r.source || 'unknown source')
      return false
    } catch (e) {
      stamp(false)
      toast(`${r.name} failed: ${e.message}`, 'warn')
      logAudit('rule', 'Rule failed', r.name, e.message)
      return false
    }
  }

  /* ── connections ── */
  const connectGcal = async () => {
    if (googleMode !== 'live') { toast('Live-only: paste your Google Client ID in Settings → Google hub (guide included)', 'warn'); return false }
    return connectGoogleLive()
  }
  const disconnectGcal = () => {
    setGcal({ connected: false, email: null, lastSync: null })
    logAudit('user', 'Disconnected Google Calendar', 'Integrations')
  }

  /* ── import ── */
  /* ── google workspace: live OAuth only (no simulators) — needs your Client ID ── */
  const saveGoogleClientId = id => { setGoogleClientId(id.trim()); toast(id.trim() ? 'Google Client ID saved — live mode enabled' : 'Client ID cleared — live mode off', 'ok') }
  const googleMode = googleClientId ? 'live' : 'local'

  const ensureToken = async () => {
    if (gtoken && gtoken.exp > Date.now() + 60e3) return gtoken.t
    if (goog.isNative()) {
      const { t, exp } = await goog.requestNativeToken(googleClientId)
      setGtoken({ t, exp })
      return t
    }
    const t = await goog.requestToken(googleClientId)
    setGtoken({ t, exp: Date.now() + 3500e3 })
    return t
  }

  const connectGoogleLive = async () => {
    try {
      await ensureToken()
      setGcal(g => ({ ...g, connected: true, email: 'Google account', mode: 'live', lastSync: g.lastSync }))
      logAudit('system', 'Google connected (live)', 'OAuth token client', 'Scopes: calendar.readonly · contacts.readonly · drive.file')
      toast('✅ Google connected — live mode')
      return true
    } catch (e) { toast(`Google sign-in failed: ${goog.friendlyGoogleError(e)}`, 'warn'); return false }
  }

  const syncGoogleCalendar = async () => {
    try {
      if (googleMode !== 'live') { toast('Paste your Google Client ID in Settings → Google hub to sync the real calendar', 'warn'); return false }
      const token = await ensureToken()
      const items = await goog.fetchCalendarEvents(token)
      let added = 0
      const newEvents = []
      items.forEach(ev => {
        if (events.some(x => x.date === ev.date && x.title === ev.title)) return
        const match = contacts.find(c => c.name.split(' ').length > 1 && ev.title.toLowerCase().includes(c.name.toLowerCase()))
        newEvents.push({ id: uid(), title: ev.title, date: ev.date, time: ev.time, endTime: ev.endTime || ev.time, type: 'meeting', contactId: match?.id || null, gcal: 'synced', location: ev.location || '' })
        added++
      })
      if (newEvents.length) setEvents(es => [...es, ...newEvents].sort((a, b) => a.date.localeCompare(b.date)))
      setGcal(g => ({ ...g, connected: true, mode: 'live', lastSync: new Date().toISOString() }))
      logAudit('system', 'Synced Google Calendar', `${items.length} remote events`, `${added} new imported`)
      logActivity(`Synced Google Calendar — ${added} new event${added === 1 ? '' : 's'}`)
      toast(`📅 ${added ? `${added} event${added > 1 ? 's' : ''} imported from Google` : 'Google Calendar already up to date'}`)
    } catch (e) {
      toast(`Google Calendar sync failed: ${goog.friendlyGoogleError(e)}`, 'warn')
      return false
    }
  }

  const syncGoogleContacts = async () => {
    if (googleMode === 'live') {
      try {
        const token = await ensureToken()
        const rows = await goog.fetchPeople(token)
        const batch = commitImport(rows, 'google-contacts')
        setDriveState(ds => ({ ...ds, lastContactsSync: new Date().toISOString() }))
        toast(`👥 Google People: ${batch.added} added · ${batch.updated} updated · ${batch.skipped} unchanged`)
        return
      } catch (e) { toast(`People API failed: ${e.message}`, 'warn'); return }
    }
    toast('Paste your Google Client ID in Settings → Google hub to import real People contacts', 'warn')
    return false
  }

  /* ── knowledge base ── */
  const upsertKbArticle = a => {
    const id = a.id || uid()
    setKbArticles(list => {
      const i = list.findIndex(x => x.id === id)
      if (i < 0) return [{ ...a, id, mine: true, updated: todayISO() }, ...list]
      const next = [...list]
      next[i] = { ...next[i], ...a, id, mine: true, updated: todayISO() }
      return next
    })
    return id
  }
  const deleteKbArticle = id => setKbArticles(list => list.filter(a => a.id !== id))
  const patchHelpPrefs = patch => setHelpPrefs(p => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) }))
  const toggleBookmark = id => setHelpPrefs(p => ({
    ...p, bookmarks: (p.bookmarks || []).includes(id) ? p.bookmarks.filter(b => b !== id) : [id, ...(p.bookmarks || [])],
  }))
  const voteArticle = (id, v) => setHelpPrefs(p => ({ ...p, votes: { ...(p.votes || {}), [id]: v } }))

  const buildBackupObject = () => ({
    app: 'personal-crm', version: 2, exportedAt: new Date().toISOString(),
    data: { contacts, tasks, events, notes, tags, groups, rules, relFreq, audit, activity, imports, snoozes, notifState, notifPrefs, widgetPrefs, mailboxes, emails, profile, kbArticles, helpPrefs },
  })
  const buildBackup = () => JSON.stringify(buildBackupObject(), null, 2)

  const driveBackupNow = async () => {
    const json = buildBackup()
    if (googleMode === 'live') {
      try {
        const token = await ensureToken()
        const existing = driveState.fileId || (await goog.findBackupFile(token))?.id || null
        const res = await goog.uploadBackup(token, json, existing)
        setDriveState(ds => ({ ...ds, fileId: res.id || existing, lastBackup: new Date().toISOString() }))
        logAudit('system', 'Backed up to Google Drive', 'personal-crm-backup.json', `${Math.round(json.length / 1024)} KB`)
        toast('☁️ Backup saved to Google Drive')
        return
      } catch (e) { toast(`Drive backup failed: ${e.message}`, 'warn'); return }
    }
    /* local file download — a real backup, just not on Drive */
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    a.download = 'personal-crm-backup.json'
    document.body.appendChild(a); a.click(); a.remove()
    setDriveState(ds => ({ ...ds, lastBackup: new Date().toISOString(), fileId: null }))
    logAudit('system', 'Backup downloaded (local file)', 'personal-crm-backup.json', `${Math.round(json.length / 1024)} KB · add a Client ID to push to Drive`)
    toast('☁️ Real backup downloaded as JSON — add a Client ID to push it to Drive')
  }

  const restoreAll = parsed => {
    const d = parsed?.data || parsed
    if (!d || !Array.isArray(d.contacts)) { toast('That file is not a Personal CRM backup', 'warn'); return false }
    setContacts(d.contacts.map(normalizeContact)); setTasks(d.tasks || []); setEvents(d.events || []); setNotes(d.notes || [])
    setTags(d.tags || []); setGroups(d.groups || []); setRules(d.rules || [])
    if (d.relFreq) setRelFreq(d.relFreq); if (d.audit) setAudit(d.audit); if (d.activity) setActivity(d.activity)
    if (d.imports) setImports(d.imports); if (d.snoozes) setSnoozes(d.snoozes)
    if (d.notifState) setNotifState(d.notifState); if (d.notifPrefs) setNotifPrefs(d.notifPrefs)
    if (d.widgetPrefs) setWidgetPrefs(d.widgetPrefs)
    if (d.mailboxes) setMailboxes(d.mailboxes); if (d.emails) setEmails(d.emails)
    if (Array.isArray(d.kbArticles)) setKbArticles(d.kbArticles)
    if (d.helpPrefs) setHelpPrefs(p => ({ ...p, ...d.helpPrefs }))
    logAudit('user', 'Restored backup', parsed?.exportedAt || 'unknown date', `${d.contacts.length} contacts · ${d.tasks?.length || 0} tasks`, 'ok')
    logActivity(`Restored a backup (${d.contacts.length} contacts)`)
    toast('♻️ Backup restored')
    return true
  }

  const driveRestoreNow = async () => {
    if (googleMode !== 'live') { toast('Drive restore is live-only — use “Restore from file” below for the local copy', 'warn'); return }
    try {
      const token = await ensureToken()
      const f = driveState.fileId || (await goog.findBackupFile(token))?.id
      if (!f) { toast('No personal-crm-backup.json found in your Drive', 'warn'); return }
      const parsed = await goog.downloadBackup(token, f)
      if (restoreAll(parsed)) setDriveState(ds => ({ ...ds, fileId: f, lastRestore: new Date().toISOString() }))
    } catch (e) { toast(`Drive restore failed: ${e.message}`, 'warn') }
  }

  const disconnectGoogle = () => {
    goog.nativeSignOut()
    setGtoken(null)
    setGcal(g => ({ ...g, connected: false, mode: null }))
    logAudit('user', 'Google disconnected', 'Token discarded')
    toast('Google disconnected', 'warn')
  }

  /* ── user profile: registration + verification ──────────────────────────────
   * Registration is device-local (no account, no server). The only things that
   * can leave the device are an optional registration notification and an
   * optional verification request to the app owner — both explicit, both fail
   * silently, and registration works fine with the channel switched off. */
  const isRegistered = !!profile && !profile.skipped

  const registerProfile = async ({ name, email, mobile = '', notify = true }) => {
    const p = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      mobile: mobile.trim(),
      verified: { email: false, mobile: false },
      createdAt: new Date().toISOString(),
      notified: notify ? null : 'declined',
    }
    setProfile(p)
    logAudit('user', 'Registered profile', p.name, p.email)
    logActivity(`Registered as ${p.name}`)
    if (notify) {
      const res = await notifyOwner({ type: 'registration', name: p.name, email: p.email, mobile: p.mobile })
      const status = res.ok ? 'sent' : res.reason
      setProfile(x => (x && x.email === p.email ? { ...x, notified: status } : x))
    }
    toast(`Welcome, ${p.name.split(' ')[0]} 👋`)
    return p
  }

  const updateProfile = patch => {
    setProfile(p => (p ? { ...p, ...patch } : p))
    if (patch.name || patch.email) logAudit('user', 'Updated profile', patch.name || profile?.name, patch.email || profile?.email)
  }

  const skipRegistration = () => setProfile({ skipped: true, at: new Date().toISOString() })

  /* sign out: drops the local profile, KEEPS all CRM data */
  const signOutProfile = () => {
    setProfile({ skipped: true, at: new Date().toISOString() })
    setSessionUnlocked(false)
    logAudit('user', 'Signed out', profile?.name || 'Profile', 'Profile cleared, data kept')
    toast('Signed out — your contacts and data are untouched', 'warn')
  }

  /* Verification without our own server: the app generates a 6-digit code and
   * stores only its salted hash; the code itself is sent to the app owner, who
   * forwards it to the real email/phone. Entering it proves control of that
   * address or number. Nothing is faked — if the notification channel is off,
   * no code is issued at all. */
  const requestVerificationCode = async kind => {
    if (!isRegistered) return { ok: false, reason: 'no-profile' }
    const value = kind === 'email' ? profile.email : profile.mobile
    if (!value) return { ok: false, reason: 'missing-' + kind }
    if (!notifyConfigured()) return { ok: false, reason: 'not-configured' }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const salt = uid()
    const hash = await hashPin(code, salt)
    setProfile(x => (x ? { ...x, pendingCode: { kind, hash, salt, ts: new Date().toISOString() } } : x))

    const res = await notifyOwner({
      type: 'verification',
      subject: `[Personal CRM] Verify ${kind} for ${profile.name}`,
      name: profile.name, email: profile.email, mobile: profile.mobile, kind, code,
      message: `Send this 6-digit code to the user's ${kind} (${value}) to verify it: ${code}`,
    })
    if (!res.ok) {
      setProfile(x => { if (!x) return x; const n = { ...x }; delete n.pendingCode; return n })
      return { ok: false, reason: res.reason }
    }
    logAudit('user', 'Requested verification code', kind, value)
    return { ok: true }
  }

  const confirmVerificationCode = async (kind, code) => {
    const pc = profile?.pendingCode
    if (!pc || pc.kind !== kind) return false
    if (Date.now() - new Date(pc.ts).getTime() > 24 * 3600e3) return false
    if ((await hashPin(String(code).trim(), pc.salt)) !== pc.hash) return false
    setProfile(x => {
      if (!x) return x
      const n = { ...x, verified: { ...(x.verified || {}), [kind]: new Date().toISOString() } }
      delete n.pendingCode
      return n
    })
    const value = kind === 'email' ? profile.email : profile.mobile
    logAudit('user', `Verified ${kind}`, value, 'Code confirmed')
    toast(kind === 'email' ? '✅ Email verified' : '✅ Mobile verified')
    return true
  }

  /* ── app lock: per-device pincode + session unlock ──
   * PIN is hashed (SHA-256 + salt via WebCrypto; FNV fallback outside secure
   * contexts) — never stored in plaintext, never leaves the device. Honest
   * scope: this locks the app screen; device-level encryption is the OS's job. */
  const hashPin = async (pin, salt) => {
    const raw = `${salt}|${pin}`
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
    } catch {
      let h = 2166136261
      for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619) }
      return 'fnv:' + (h >>> 0).toString(16)
    }
  }
  const verifyPin = async pin => !!(lock?.hash && (await hashPin(pin, lock.salt)) === lock.hash)

  /* ── pincode brute-force throttle ────────────────────────────────────────
   * A 4-digit pincode is only 10,000 combinations and the hash lives on this
   * device, so an unthrottled check is brute-forceable by anyone who can run
   * script on it. Every failure raises the price of the next guess. */
  const PIN_LADDER = [0, 0, 0, 0, 30e3, 60e3, 120e3, 300e3, 900e3]  // index = failures-1
  const PIN_FREE_ATTEMPTS = 4
  const pinLockedUntil = () => (lock?.lockedUntil && lock.lockedUntil > Date.now() ? lock.lockedUntil : 0)
  const pinStatus = () => {
    const until = pinLockedUntil()
    const fails = lock?.fails || 0
    return {
      fails, until,
      locked: until > 0,
      msLeft: until ? until - Date.now() : 0,
      attemptsLeft: Math.max(0, PIN_FREE_ATTEMPTS - fails),
    }
  }
  const pinFail = () => {
    const fails = (lock?.fails || 0) + 1
    const ms = PIN_LADDER[Math.min(fails - 1, PIN_LADDER.length - 1)]
    const lockedUntil = ms ? Date.now() + ms : 0
    setLock(l => ({ ...(l || {}), fails, lockedUntil, lastFailAt: new Date().toISOString() }))
    logAudit('system', 'Failed pincode attempt', 'App lock',
      `${fails} consecutive${ms ? ` · locked for ${Math.round(ms / 1000)}s` : ''}`, 'warn')
    return { fails, lockedUntil, ms }
  }
  const pinOk = () => setLock(l => (l ? { ...l, fails: 0, lockedUntil: 0, lastFailAt: null } : l))

  const setupPin = async pin => {
    const salt = uid()
    const hash = await hashPin(pin, salt)
    setLock({ salt, hash, setAt: new Date().toISOString() })
    setSessionUnlocked(true)
    logAudit('user', 'App lock enabled', 'Pincode set')
    toast('🔒 App lock enabled — pincode is required at every start on this device')
    return true
  }
  const skipPinSetup = () => {
    setLock({ hash: null, skipped: true })
    toast('Pincode setup skipped — you can set it anytime in Settings → App lock', 'warn')
  }
  const unlockWithPin = async pin => {
    if (pinLockedUntil()) return false
    if (await verifyPin(pin)) { pinOk(); setSessionUnlocked(true); return true }
    pinFail()
    return false
  }
  const lockNow = () => setSessionUnlocked(false)
  const changePin = async (oldPin, newPin) => {
    if (pinLockedUntil()) return false
    if (!(await verifyPin(oldPin))) { pinFail(); return false }
    pinOk()
    const salt = uid()
    const hash = await hashPin(newPin, salt)
    setLock({ salt, hash, setAt: new Date().toISOString() })
    logAudit('user', 'Pincode changed', 'App lock')
    toast('🔒 Pincode changed')
    return true
  }
  const removePin = async pin => {
    if (pinLockedUntil()) return false
    if (!(await verifyPin(pin))) { pinFail(); return false }
    pinOk()
    setLock({ hash: null, skipped: true })
    logAudit('user', 'App lock removed', 'App lock')
    toast('App lock removed', 'warn')
    return true
  }

  /* ── rolling local snapshots (the safety net under every destructive action) ── */
  const [snapshots, setSnapshots] = useState(() => snap.listSnapshots())
  const refreshSnapshots = () => setSnapshots(snap.listSnapshots())
  const takeSnapshotNow = (label = 'manual') => {
    const rec = snap.takeSnapshot(buildBackupObject(), label, { force: true })
    refreshSnapshots()
    if (rec) logAudit('user', 'Snapshot saved', label, `${Math.round(rec.bytes / 1024)} KB`)
    return rec
  }
  const restoreSnapshotById = id => {
    const obj = snap.readSnapshot(id)
    if (!obj) { toast('That snapshot could not be read', 'warn'); return false }
    const ok = restoreAll(obj)
    if (ok) { logAudit('user', 'Restored a snapshot', obj.exportedAt || id, 'Rolled back to an earlier copy', 'warn'); refreshSnapshots() }
    return ok
  }
  const downloadSnapshot = id => {
    const obj = snap.readSnapshot(id)
    if (!obj) { toast('That snapshot could not be read', 'warn'); return false }
    const el = document.createElement('a')
    el.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }))
    el.download = `personal-crm-snapshot-${String(obj.exportedAt || id).slice(0, 10)}.json`
    document.body.appendChild(el); el.click(); el.remove()
    toast('⬇️ Snapshot downloaded')
    return true
  }
  const deleteSnapshotById = id => { snap.deleteSnapshot(id); refreshSnapshots(); toast('Snapshot deleted', 'warn') }

  /* factory reset to a BLANK crm — PIN-confirmed; wipes everything incl. pincode */
  const blankState = () => ({
    contacts: [], tasks: [], events: [], notes: [], tags: [], groups: [], rules: [], audit: [],
    activity: [], imports: [], relFreq: {}, snoozes: {},
    gcal: { connected: false, email: null, lastSync: null },
    notifState: {}, notifPrefs, widgetPrefs,
    mailboxes: {
      gmail: { connected: false, address: '', lastSync: null },
      outlook: { connected: false, address: '', lastSync: null },
    },
    emails: [], googleClientId: '', gist: { token: '', gistId: null },
    icsFeeds: [], driveState: { fileId: null, lastBackup: null, lastRestore: null, lastContactsSync: null },
    syncState: null, lock: null, profile: null, kbArticles: [],
    helpPrefs: { tips: true, tourDone: false, tourStep: 0, tourStarted: false, onboardDone: false, bookmarks: [], votes: {}, seenVersion: '' },
    __blank: true,
  })
  const factoryReset = async pin => {
    if (pinLockedUntil()) return false
    if (lock?.hash && !(await verifyPin(pin))) { pinFail(); return false }
    /* no pinOk() here: the whole lock — counter included — goes with the wipe,
       and its state update would re-save the old data before the reload lands */
    try {
      wiping.current = true
      await storage.setItem(KEY, JSON.stringify(blankState()))
      await storage.removeItem('pcrm-theme')
      secrets.clearSecrets()
      await storage.flush()
    } catch {}
    location.reload()
    return true
  }
  /* auto-relock after 15 min hidden */
  useEffect(() => {
    if (!lock?.hash) return
    let hiddenAt = null
    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return }
      if (hiddenAt && Date.now() - hiddenAt > 15 * 60e3) setSessionUnlocked(false)
      hiddenAt = null
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [lock?.hash])

  /* ── multi-device sync: single personal-crm-sync.json in the user's Drive ── */
  const snapshotCore = () => ({
    contacts, tasks, events, notes, tags, groups, rules, relFreq, emails,
  })
  /* auto: one after every burst of edits (the ring de-dupes and rate-limits) */
  const coreFingerprint = useMemo(() => JSON.stringify(snapshotCore()), [contacts, tasks, events, notes, tags, groups, rules, relFreq, emails])
  useEffect(() => {
    const t = setTimeout(() => { if (snap.takeSnapshot(buildBackupObject(), 'auto')) refreshSnapshots() }, 9000)
    return () => clearTimeout(t)
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coreFingerprint])

  /* auto: once on start-up, but only if the newest copy is getting stale */
  useEffect(() => {
    const newest = snapshots[0]?.at ? new Date(snapshots[0].at).getTime() : 0
    if (Date.now() - newest > 6 * 3600e3) {
      if (snap.takeSnapshot(buildBackupObject(), 'startup', { force: true })) refreshSnapshots()
    }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applySyncSnapshot = d => {
    if (Array.isArray(d.contacts)) setContacts(d.contacts.map(normalizeContact))
    if (Array.isArray(d.tasks)) setTasks(d.tasks)
    if (Array.isArray(d.events)) setEvents(d.events)
    if (Array.isArray(d.notes)) setNotes(d.notes)
    if (Array.isArray(d.tags)) setTags(d.tags)
    if (Array.isArray(d.groups)) setGroups(d.groups)
    if (Array.isArray(d.rules)) setRules(d.rules)
    if (d.relFreq) setRelFreq(d.relFreq)
    if (Array.isArray(d.emails)) setEmails(d.emails)
  }
  const deviceName = () => {
    try {
      return (goog.isNative() ? 'Android app' : (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches ? 'PWA' : 'Web')) +
        ' · ' + (syncState.deviceId || '').slice(-4)
    } catch { return 'this device' }
  }

  /* which backend serves sync right now? GitHub Gist wins (simpler for most) */
  const syncProvider = () => (gist.token && gist.token.length > 20 ? 'gist' : (googleMode === 'live' ? 'drive' : 'none'))

  const saveGistToken = async token => {
    const t = token.trim()
    if (!t) { setGist({ token: '', gistId: null }); toast('GitHub token cleared — sync falls back to Drive (if live)', 'warn'); return true }
    try {
      await gs.testToken(t)
      setGist(g => ({ ...g, token: t }))
      toast('✅ GitHub connected — Gist sync enabled')
      return true
    } catch (e) { toast(e.message, 'warn'); return false }
  }

  const syncNow = async (opts = {}) => {
    const prov = syncProvider()
    if (prov === 'none') { if (opts.manual) toast('Choose a sync backend first — Settings → GitHub Gist (easiest) or Google hub', 'warn'); return false }
    if (!syncState.enabled) { if (opts.manual) toast('Multi-device sync is off — enable it in Settings', 'warn'); return false }
    if (syncBusy.current) return false
    syncBusy.current = true; setSyncing(true)
    try {
      let fileId, remote
      if (prov === 'gist') {
        fileId = gist.gistId || (await gs.findSyncGist(gist.token))?.id || null
        if (fileId && fileId !== gist.gistId) setGist(g => ({ ...g, gistId: fileId }))
        remote = fileId ? await gs.readSync(gist.token, fileId).catch(() => null) : null
      } else {
        const token = await ensureToken()
        fileId = driveState.syncFileId || (await ds.findSyncFile(token))?.id || null
        remote = fileId ? await ds.readSync(token, fileId) : null
      }
      const local = snapshotCore()
      const localHash = ds.hashOf(local)
      const baseData = syncState.baselineData, baseHash = syncState.baselineHash
      const rev = syncState.lastRev
      let newRev = rev
      let report = null

      if (remote && remote.rev > rev) {
        /* remote moved (another device synced since we did) → three-way merge */
        const { merged, stats } = ds.mergeSnapshot(baseData || {}, local, remote.data || {})
        const mergedHash = ds.hashOf(merged)
        if (mergedHash !== localHash) applySyncSnapshot(merged)
        if (mergedHash !== ds.hashOf(remote.data || {})) {
          newRev = remote.rev + 1
          const payload = { __pcrmSync: 3, rev: newRev, deviceId: syncState.deviceId, device: deviceName(), updatedAt: new Date().toISOString(), data: merged }
          let res
          try { res = prov === 'gist' ? await gs.writeSync(gist.token, payload, fileId) : await ds.writeSync(await ensureToken(), payload, fileId) }
          catch (e) { if (e.gistGone) { setGist(g => ({ ...g, gistId: null })); res = await gs.writeSync(gist.token, payload, null) } else throw e }
          if (!fileId) {
            fileId = res.id
            if (prov === 'gist') setGist(g => ({ ...g, gistId: res.id })); else setDriveState(s => ({ ...s, syncFileId: res.id }))
          }
          report = { conflicts: stats.conflicts, fromRemote: stats.fromRemote, rev: newRev, dir: 'pushed+merged' }
        } else {
          newRev = remote.rev
          report = { conflicts: stats.conflicts, fromRemote: stats.fromRemote, rev: newRev, dir: 'pulled' }
        }
        setSyncState(s => ({ ...s, lastRev: newRev, baselineData: merged, baselineHash: mergedHash, lastSyncAt: new Date().toISOString() }))
        if (stats.conflicts || stats.fromRemote) {
          logAudit('system', 'Sync pulled changes', deviceName(), `${stats.fromRemote} adopted from ${remote.device || 'another device'} · ${stats.conflicts} conflict${stats.conflicts === 1 ? '' : 's'} resolved (rev ${newRev})`)
          toast(`☁️ Synced: ${stats.fromRemote} change${stats.fromRemote === 1 ? '' : 's'} from ${remote.device || 'another device'}${stats.conflicts ? ` · ${stats.conflicts} conflict${stats.conflicts > 1 ? 's' : ''} resolved` : ''}`)
        } else if (opts.manual) toast('☁️ Already in sync')
      } else if (!remote || localHash !== baseHash || rev === 0) {
        newRev = (remote?.rev || rev) + 1
        const payload = { __pcrmSync: 3, rev: newRev, deviceId: syncState.deviceId, device: deviceName(), updatedAt: new Date().toISOString(), data: local }
        let res
        try { res = prov === 'gist' ? await gs.writeSync(gist.token, payload, fileId) : await ds.writeSync(await ensureToken(), payload, fileId) }
        catch (e) { if (e.gistGone) { setGist(g => ({ ...g, gistId: null })); res = await gs.writeSync(gist.token, payload, null) } else throw e }
        if (!fileId) {
          fileId = res.id
          if (prov === 'gist') setGist(g => ({ ...g, gistId: res.id })); else setDriveState(s => ({ ...s, syncFileId: res.id }))
        }
        setSyncState(s => ({ ...s, lastRev: newRev, baselineData: local, baselineHash: localHash, lastSyncAt: new Date().toISOString() }))
        logAudit('system', 'Sync pushed', `rev ${newRev} · ${prov === 'gist' ? 'GitHub Gist' : 'Drive'}`, `${local.contacts.length} contacts · ${local.tasks.length} tasks · ${local.events.length} events · ${local.notes.length} notes`)
        if (opts.manual) toast(`☁️ Synced to ${prov === 'gist' ? 'GitHub Gist' : 'Drive'} (rev ${newRev})`)
        report = { conflicts: 0, fromRemote: 0, rev: newRev, dir: 'pushed' }
      } else {
        setSyncState(s => ({ ...s, lastSyncAt: new Date().toISOString() }))
        if (opts.manual) toast('☁️ Already in sync')
      }
      setSyncReport(report)
      return true
    } catch (e) {
      if (opts.manual) toast(`Sync failed: ${goog.friendlyGoogleError(e)}`, 'warn')
      return false
    } finally {
      syncBusy.current = false; setSyncing(false)
    }
  }

  const setSyncEnabled = on => {
    setSyncState(s => ({ ...s, enabled: !!on }))
    if (on) setTimeout(() => syncNow({ manual: true }), 50)
  }

  /* auto-sync: every minute + when the app regains focus + when back online */
  const syncRef = useRef(null)
  syncRef.current = syncNow
  useEffect(() => {
    if (!syncState.enabled || syncProvider() === 'none') return
    const tick = () => { if (navigator.onLine !== false) syncRef.current?.({}) }
    const iv = setInterval(tick, 60e3)
    const onVis = () => { if (document.visibilityState === 'visible') tick() }
    const onOnline = () => tick()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', onOnline)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('online', onOnline) }
  }, [syncState.enabled, googleMode, gist.token])

  /* ── read-only calendar feed subscriptions (real calendars, no OAuth) ── */
  const addIcsFeed = (url, opts = {}) => {
    const feed = { id: uid(), url: url.trim(), viaProxy: !!opts.viaProxy, lastSync: null, lastCount: 0, error: null, lastVia: null }
    setIcsFeeds(fs => [...fs, feed])
    logAudit('user', 'Subscribed to calendar feed', feed.url, feed.viaProxy ? 'relay allowed' : 'direct only')
    return feed
  }
  const removeIcsFeed = id => {
    const feed = icsFeeds.find(f => f.id === id)
    setIcsFeeds(fs => fs.filter(f => f.id !== id))
    setEvents(es => es.filter(e => e.feedId !== id))
    if (feed) logAudit('user', 'Removed calendar feed', feed.url)
  }
  const syncIcsFeed = async idOrFeed => {
    const feed = typeof idOrFeed === 'object' ? idOrFeed : icsFeeds.find(f => f.id === idOrFeed)
    if (!feed) return false
    try {
      const { text, via } = await icslib.fetchICS(feed.url, { allowProxy: feed.viaProxy })
      const rows = icslib.parseICS(text)
      let added = 0
      const newEvents = []
      rows.forEach(r => {
        if (events.some(x => x.title === r.title && x.date === r.date && x.time === r.time)) return
        newEvents.push({ id: uid(), title: r.title, date: r.date, time: r.time, endTime: r.endTime || r.time, type: 'meeting', contactId: null, gcal: 'ics', location: r.location || '', feedId: feed.id })
        added++
      })
      if (newEvents.length) setEvents(es => [...es, ...newEvents].sort((a, b) => a.date.localeCompare(b.date)))
      setIcsFeeds(fs => fs.map(f => f.id === feed.id ? { ...f, lastSync: new Date().toISOString(), lastCount: rows.length, error: null, lastVia: via } : f))
      logAudit('system', 'Synced calendar feed', `${rows.length} feed events`, `${added} new imported${via === 'relay' ? ' · via relay' : ''}`)
      logActivity(`Synced calendar feed — ${added} new event${added === 1 ? '' : 's'}`)
      toast(`🗓️ ${added ? `${added} new event${added > 1 ? 's' : ''} from feed` : 'Feed already up to date'}${via === 'relay' ? ' (via relay)' : ''}`)
      return true
    } catch (e) {
      setIcsFeeds(fs => fs.map(f => f.id === feed.id ? { ...f, error: e.message || 'failed', lastSync: new Date().toISOString() } : f))
      toast(`Feed sync failed: ${e.message}${e.needsProxy ? ' — tick “route via relay” and retry' : ''}`, 'warn')
      return false
    }
  }

  /* ── outbound webhooks (Zapier / Make / n8n bridge) ── */
  const saveWebhooks = patch => setWebhooks(w => ({ ...w, ...patch, on: { ...w.on, ...(patch.on || {}) } }))

  // Webhooks are sent as CORS "simple requests" (text/plain → no preflight).
  // Simple POSTs always reach the server; only reading the RESPONSE can be blocked.
  // So: readable response → real HTTP status; blocked response → payload still delivered, status unknown.
  const postToHook = async (url, payload) => {
    const body = JSON.stringify(payload)
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body })
      return { ok: r.ok, status: r.status }
    } catch {
      return { ok: true, status: 'delivered (unverified)' }
    }
  }

  const pushDelivery = (type, res) =>
    setWebhooks(w => ({ ...w, log: [{ ts: new Date().toISOString(), type, ok: res.ok, status: res.status }, ...w.log].slice(0, 20) }))

  const fireWebhook = (type, data) => {
    if (!webhooks.url || !webhooks.on[type]) return
    const payload = { source: 'personal-crm', event: type, ts: new Date().toISOString(), data }
    postToHook(webhooks.url, payload).then(res => pushDelivery(type, res))
  }

  const testWebhook = async () => {
    if (!webhooks.url) { toast('Paste a webhook URL first', 'warn'); return false }
    const payload = { source: 'personal-crm', event: 'ping', ts: new Date().toISOString(), data: { hello: 'from your CRM 👋' } }
    const res = await postToHook(webhooks.url, payload)
    pushDelivery('ping', res)
    if (res.ok && typeof res.status === 'number') toast(`✅ Webhook delivered (HTTP ${res.status})`)
    else if (res.ok) toast('✅ Sent — hook received it (response hidden by its CORS policy)')
    else toast('Webhook failed — check the URL is live', 'warn')
    return res.ok
  }

  /* ── email integration (8b — mock Gmail/Outlook connector) ── */
  const connectMailbox = async provider => {
    if (provider === 'outlook') { toast('Outlook connector needs Microsoft OAuth — not available yet', 'warn'); return false }
    if (!googleClientId) { toast('Live Gmail needs your Google Client ID — Settings → Google hub (guide included)', 'warn'); return false }
    if (provider === 'gmail') {
      try {
        const token = await ensureToken()
        const [msgs, profile] = await Promise.all([
          goog.fetchGmailMessages(token, 20),
          goog.fetchGmailProfile(token).catch(() => null),
        ])
        const incoming = msgs.map(m => ({
          ...m, provider: 'gmail', status: 'pending',
          matchedContactId: contacts.find(c => c.email && c.email.toLowerCase() === m.email.toLowerCase())?.id || null,
        }))
        setMailboxes(mb => ({ ...mb, gmail: { connected: true, address: profile?.emailAddress || 'Gmail (live)', lastSync: new Date().toISOString(), mode: 'live' } }))
        setEmails(es => [...es.filter(x => x.provider !== 'gmail'), ...incoming])
        logAudit('system', 'Connected Gmail (live)', profile?.emailAddress || 'Gmail', `${incoming.length} messages scanned`)
        logActivity(`Connected live Gmail (${incoming.length} messages scanned)`)
        toast(`📬 Gmail live — ${incoming.length} recent messages scanned`)
        return true
      } catch (e) {
        toast(`Gmail live failed: ${goog.friendlyGoogleError(e)} — also confirm the Gmail API is enabled`, 'warn')
        return false
      }
    }
    return false
  }

  const disconnectMailbox = provider => {
    setMailboxes(mb => ({ ...mb, [provider]: { connected: false, address: '', lastSync: null } }))
    setEmails(es => es.filter(e => e.provider !== provider))
    logAudit('user', `Disconnected ${provider}`, mailboxes[provider].address || '', 'Mailbox removed from sync')
    toast(`${provider === 'gmail' ? 'Gmail' : 'Outlook'} disconnected`, 'warn')
  }

  const syncMailbox = async provider => {
    if (mailboxes[provider]?.mode === 'live') return connectMailbox(provider)
    toast(provider === 'outlook' ? 'Outlook connector needs Microsoft OAuth — not available yet' : 'Connect Gmail live first (Settings → Google hub)', 'warn')
    return false
  }

  const logEmailTouch = id => {
    const e = emails.find(x => x.id === id)
    if (!e) return
    setEmails(es => es.map(x => x.id === id ? { ...x, status: 'logged' } : x))
    const who = e.matchedContactId ? contactById[e.matchedContactId] : null
    if (who) setContacts(cs => cs.map(c => c.id === who.id ? { ...c, lastContact: todayISO() } : c))
    logActivity(`Email ${e.dir === 'in' ? 'from' : 'to'} ${e.name}: “${e.subject}”`, who?.id || null)
    logAudit('user', 'Logged email touchpoint', e.subject, who ? `Contact: ${who.name}` : 'Unmatched sender')
    toast(`Touchpoint logged${who ? ` for ${who.name.split(' ')[0]}` : ''}`)
  }

  const triageEmailAsLead = id => {
    const e = emails.find(x => x.id === id)
    if (!e) return
    const c = addContact({ name: e.name, email: e.email, phone: '', company: '', groupId: 'g_leads', rel: 'lead' })
    setEmails(es => es.map(x => x.id === id ? { ...x, status: 'triaged', matchedContactId: c.id } : x))
    logActivity(`Captured lead from email: ${c.name}`, c.id)
    toast(`⚡ Lead created from ${e.name}'s email`)
  }

  const ignoreEmail = id => setEmails(es => es.map(x => x.id === id ? { ...x, status: 'ignored' } : x))

  const commitImport = (rows, source = 'pasted.vcf') => {
    let added = 0, updated = 0, skipped = 0
    const details = []
    rows.forEach(r => {
      const existing = contacts.find(c => c.name.trim().toLowerCase() === r.name.trim().toLowerCase())
      if (existing) {
        const patch = {}
        if (r.phone && r.phone !== existing.phone) patch.phone = r.phone
        if (r.email && r.email !== existing.email) patch.email = r.email
        if (r.org && r.org !== existing.company) patch.company = r.org
        if (r.bday && r.bday !== existing.birthday) patch.birthday = r.bday
        const changes = Object.entries(patch).map(([field, to]) => ({ field, from: existing[field] || '', to }))
        if (changes.length) {
          updateContact(existing.id, patch); updated++
          details.push({ contactId: existing.id, name: existing.name, status: 'updated', changes })
        } else {
          skipped++
          details.push({ contactId: existing.id, name: existing.name, status: 'skipped', changes: [] })
        }
      } else {
        const c = addContact({ name: r.name, phone: r.phone || '', email: r.email || '', company: r.org || '', birthday: r.bday || null, groupId: 'g_leads', rel: 'lead' })
        added++
        details.push({ contactId: c.id, name: c.name, status: 'added', changes: [{ field: 'record', from: '', to: 'new contact' }] })
      }
    })
    const batch = { id: uid(), ts: new Date().toISOString(), source, added, updated, skipped, details, rolledBack: false }
    setImports(is => [batch, ...is])
    logAudit('system', 'Imported vCard', source, `${added} added · ${updated} updated · ${skipped} skipped`)
    logActivity(`Imported ${added + updated} contacts from ${source}`)
    return batch
  }

  const rollbackImport = bid => {
    const batch = imports.find(i => i.id === bid)
    if (!batch || batch.rolledBack || !batch.details) return
    const dels = []
    const restores = []
    batch.details.forEach(d => {
      if (d.status === 'added') dels.push(d.contactId)
      if (d.status === 'updated') {
        const patch = {}
        d.changes.forEach(ch => { patch[ch.field] = ch.from || (ch.field === 'birthday' ? null : '') })
        restores.push([d.contactId, patch])
      }
    })
    setContacts(cs => cs
      .filter(c => !dels.includes(c.id))
      .map(c => { const r = restores.find(x => x[0] === c.id); return r ? { ...c, ...r[1] } : c }))
    setImports(is => is.map(i => i.id === bid ? { ...i, rolledBack: true } : i))
    logAudit('user', 'Rolled back import', batch.source, `${dels.length} added removed · ${restores.length} update(s) reverted`)
    logActivity(`Rolled back import ${batch.source}`)
    toast(`Rolled back: ${dels.length} removed, ${restores.length} reverted`)
  }

  const resolveAuditConflict = (id, choice) => {
    const e = audit.find(x => x.id === id)
    setAudit(a => a.map(x => x.id === id ? { ...x, status: 'ok', detail: x.detail + ` — resolved: kept ${choice}` } : x))
    if (e) logAudit('user', 'Conflict resolved', e.entity, `Kept ${choice}`)
    toast(`Conflict resolved — kept ${choice}`)
  }

  /* ── follow-ups ── */
  const updateFrequency = (key, days) => {
    setRelFreq(rf => ({ ...rf, [key]: { ...rf[key], everyDays: Number(days) || 1 } }))
    logAudit('user', 'Updated follow-up frequency', relFreq[key]?.label || key, `Every ${days} days`)
  }
  const snoozeFollowUp = (cid, days = 7) => { setSnoozes(s => ({ ...s, [cid]: daysAheadISO(days) })); toast('Snoozed for 7 days') }
  const unsnooze = cid => setSnoozes(s => { const n = { ...s }; delete n[cid]; return n })

  const followUpStatus = c => {
    const every = relFreq[c.rel]?.everyDays ?? 30
    const since = diffDays(c.lastContact, todayISO())
    if (snoozes[c.id] && snoozes[c.id] >= todayISO()) return { state: 'snoozed', since, every, until: snoozes[c.id] }
    const overdueBy = since - every
    if (overdueBy > 0)  return { state: 'overdue', overdueBy, since, every }
    if (overdueBy >= -3) return { state: 'due-soon', dueIn: -overdueBy, since, every }
    return { state: 'ok', since, every }
  }

  const resetAll = async () => {
    try {
      wiping.current = true
      await storage.removeItem(KEY)
      secrets.clearSecrets()
      await storage.flush()
    } catch {}
    location.reload()
  }

  /* ── notifications (derived feed + dismiss/snooze/read state) ── */
  const dismissNotif = (key, on = true) => setNotifState(s => ({ ...s, [key]: { ...(s[key] || {}), dismissed: on } }))
  const snoozeNotif = (key, days) => { setNotifState(s => ({ ...s, [key]: { ...(s[key] || {}), snoozedUntil: daysAheadISO(days) } })); toast(`Snoozed for ${days} day${days > 1 ? 's' : ''}`) }
  const unsnoozeNotif = key => setNotifState(s => ({ ...s, [key]: { ...(s[key] || {}), snoozedUntil: null } }))
  const markNotifRead = key => setNotifState(s => ({ ...s, [key]: { ...(s[key] || {}), read: true } }))
  const markAllNotifsRead = keys => setNotifState(s => { const n = { ...s }; keys.forEach(k => { n[k] = { ...(n[k] || {}), read: true } }); return n })
  const toggleNotifPref = (type, on) => setNotifPrefs(p => ({ ...p, [type]: on }))

  /* ── dashboard widgets ── */
  const toggleWidget = id => setWidgetPrefs(p => ({ ...p, hidden: p.hidden.includes(id) ? p.hidden.filter(x => x !== id) : [...p.hidden, id] }))
  const moveWidget = (id, dir) => setWidgetPrefs(p => {
    const o = [...p.order]
    const i = o.indexOf(id), j = i + dir
    if (i < 0 || j < 0 || j >= o.length) return p
    ;[o[i], o[j]] = [o[j], o[i]]
    return { ...p, order: o }
  })
  const resetWidgets = () => setWidgetPrefs({ order: DEFAULT_WIDGET_ORDER, hidden: [] })

  const buildNotifications = () => {
    const today = todayISO()
    const year = new Date().getFullYear()
    const list = []
    tasks.forEach(t => {
      if (t.column === 'done' || !t.due) return
      const d = daysUntil(t.due)
      if (d > 1) return
      list.push({ key: `task-${t.id}`, type: 'task', title: t.title, body: d < 0 ? `Overdue by ${-d} day${-d > 1 ? 's' : ''}` : d === 0 ? 'Due today' : 'Due tomorrow', priority: d < 0 ? 'high' : d === 0 ? 'med' : 'low', taskId: t.id, contactId: t.contactId, ts: t.due })
    })
    contacts.forEach(c => {
      const s = followUpStatus(c)
      if (s.state === 'overdue') list.push({ key: `fu-${c.id}`, type: 'follow-up', title: `Reconnect with ${c.name}`, body: `${s.since}d since contact · ${s.overdueBy}d overdue`, priority: s.overdueBy > 7 ? 'high' : 'med', contactId: c.id, ts: c.lastContact })
      else if (s.state === 'due-soon') list.push({ key: `fu-${c.id}`, type: 'follow-up', title: `${c.name} — reach out soon`, body: `${relFreq[c.rel]?.label || 'Relationship'} rhythm: due in ${s.dueIn}d`, priority: 'low', contactId: c.id, ts: c.lastContact })
    })
    contacts.forEach(c => {
      if (!c.birthday) return
      let occ = `${year}-${c.birthday.slice(5)}`
      if (occ < today) occ = `${year + 1}-${c.birthday.slice(5)}`
      const d = daysUntil(occ)
      if (d <= 7) list.push({ key: `bday-${c.id}`, type: 'birthday', title: `${c.name}'s birthday 🎂`, body: d === 0 ? 'Today! Time to reach out' : `In ${d} day${d > 1 ? 's' : ''} (${occ.slice(5)})`, priority: d === 0 ? 'high' : d <= 2 ? 'med' : 'low', contactId: c.id, ts: occ })
    })
    events.forEach(e => {
      const d = daysUntil(e.date)
      if (d === 0 || d === 1) list.push({ key: `evt-${e.id}`, type: 'event', title: e.title, body: `${d === 0 ? 'Today' : 'Tomorrow'} at ${e.time}${e.location ? ` · ${e.location}` : ''}`, priority: 'med', eventId: e.id, contactId: e.contactId, ts: e.date })
    })
    audit.forEach(a => { if (a.status === 'warn') list.push({ key: `sync-${a.id}`, type: 'system', title: a.action, body: `${a.entity}${a.detail ? ` — ${a.detail}` : ''}`, priority: 'med', auditId: a.id, ts: a.ts }) })

    const PRIO = { high: 0, med: 1, low: 2 }
    return list.map(n => {
      const st = notifState[n.key] || {}
      const enabled = notifPrefs[n.type] !== false
      const snoozedUntil = st.snoozedUntil && st.snoozedUntil >= today ? st.snoozedUntil : null
      const dismissed = !!st.dismissed
      return { ...n, enabled, dismissed, snoozedUntil, read: !!st.read, active: enabled && !dismissed && !snoozedUntil }
    }).sort((a, b) => PRIO[a.priority] - PRIO[b.priority] || (b.ts || '').localeCompare(a.ts || ''))
  }

  const value = {
    contacts, tasks, events, notes, tags, groups, rules, audit, activity, imports, relFreq, snoozes, gcal, toasts,
    contactById, groupById, tagById, toast, followUpStatus, logActivity, logAudit,
    addContact, updateContact, toggleStar, markContacted, deleteContact, bulkDeleteContacts, bulkSetGroups, contactGroupIds, addNote, updateNote, deleteNote,
    addTask, moveTask, updateTask, deleteTask, duplicateTask, createFollowUpTask,
    addEvent, moveEvent, deleteEvent,
    addTag, updateTag, deleteTag, mergeTags, bulkTag,
    addGroup, updateGroup, deleteGroup, addRule, updateRule, toggleRule, deleteRule, runRuleNow,
    profile, isRegistered, registerProfile, updateProfile, skipRegistration, signOutProfile, requestVerificationCode, confirmVerificationCode,
    connectGcal, disconnectGcal,
    mailboxes, emails, connectMailbox, disconnectMailbox, syncMailbox, logEmailTouch, triageEmailAsLead, ignoreEmail,
    googleClientId, googleMode, saveGoogleClientId, connectGoogleLive, syncGoogleCalendar, syncGoogleContacts,
    driveState, driveBackupNow, driveRestoreNow, restoreAll, disconnectGoogle,
    webhooks, saveWebhooks, testWebhook, icsFeeds, addIcsFeed, syncIcsFeed, removeIcsFeed, syncing, syncState, syncReport, syncNow, setSyncEnabled, gist, saveGistToken, syncProvider, lock, sessionUnlocked, setupPin, skipPinSetup, unlockWithPin, lockNow, changePin, removePin, verifyPin, factoryReset, buildBackup,
    commitImport, rollbackImport, resolveAuditConflict, updateFrequency, snoozeFollowUp, unsnooze, resetAll,
    notifState, notifPrefs, buildNotifications, dismissNotif, snoozeNotif, unsnoozeNotif, markNotifRead, markAllNotifsRead, toggleNotifPref,
    widgetPrefs, toggleWidget, moveWidget, resetWidgets, DEFAULT_WIDGET_ORDER,
    theme, toggleTheme,
    kbArticles, upsertKbArticle, deleteKbArticle,
    snapshots, takeSnapshotNow, restoreSnapshotById, deleteSnapshotById, downloadSnapshot, refreshSnapshots,
    pinStatus, PIN_FREE_ATTEMPTS,
    helpPrefs, patchHelpPrefs, toggleBookmark, voteArticle,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function ToastHost() {
  const { toasts } = useCrm()
  const TONES = {
    ok:   'border-emerald-400/30 text-emerald-300',
    warn: 'border-amber-400/30 text-amber-300',
    err:  'border-rose-400/30 text-rose-300',
  }
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end">
      {toasts.map(t => (
        <div key={t.id} className={`panel fadein px-4 py-2.5 text-[13px] font-medium ${TONES[t.tone] || TONES.ok}`}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}
