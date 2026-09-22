import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as seed from './data/seed'
import { uid, todayISO, daysAheadISO, diffDays, daysUntil } from './lib'
import * as goog from './lib/google'
import * as icslib from './lib/ics'
import * as ds from './lib/drivesync'

const KEY = 'pcrm-v1'
const load = () => { try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) } catch {} return null }

const DEFAULT_WIDGET_ORDER = ['stats','growth','taskCols','upcoming','stayInTouch','syncHealth','birthdays','topTags','overdueCountdown','taskHeatmap','activityFeed']
const Ctx = createContext(null)
export const useCrm = () => useContext(Ctx)

export function CrmProvider({ children }) {
  const init = load()
  const [contacts, setContacts]   = useState(init?.contacts  || seed.CONTACTS)
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
  const [carddav, setCarddav]     = useState(init?.carddav   || seed.CARDDAV)
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
  const syncBusy = useRef(false)
  const [syncReport, setSyncReport] = useState(null)     // { conflicts, fromRemote, rev }
  const [webhooks, setWebhooks]   = useState(init?.webhooks || {
    url: '', on: { lead: true, contact: false, task_done: true, touch: false }, log: [],
  })

  const [theme, setTheme]         = useState(() => { try { return localStorage.getItem('pcrm-theme') || 'dark' } catch { return 'dark' } })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('pcrm-theme', theme) } catch {}
  }, [theme])
  const toggleTheme = () => { setTheme(t => t === 'dark' ? 'light' : 'dark') }

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        contacts, tasks, events, notes, tags, groups, rules, audit,
        activity, imports, relFreq, snoozes, carddav, gcal, notifState, notifPrefs, widgetPrefs, mailboxes, emails, googleClientId, driveState, webhooks, icsFeeds, syncState,
      }))
    } catch {}
  }, [contacts, tasks, events, notes, tags, groups, rules, audit, activity, imports, relFreq, snoozes, carddav, gcal, notifState, notifPrefs, widgetPrefs, mailboxes, emails, googleClientId, driveState, webhooks, icsFeeds, syncState])

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
    const c = { id: uid(), role: '', company: '', phone: '', email: '', birthday: null, tags: [], rel: 'acquaintance', starred: false, introducedBy: null, interests: [], socials: {}, lastContact: todayISO(), createdAt: todayISO(), ...data }
    setContacts(cs => [c, ...cs])
    logAudit('user', 'Added contact', c.name, c.company || 'No company')
    fireWebhook('contact', { name: c.name, email: c.email, phone: c.phone, group: data.groupId })
    if (c.rel === 'lead') fireWebhook('lead', { name: c.name, email: c.email, phone: c.phone, source: data.source || 'crm' })
    return c
  }
  const updateContact = (id, patch) => setContacts(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c))
  const toggleStar = id => setContacts(cs => cs.map(c => c.id === id ? { ...c, starred: !c.starred } : c))
  const markContacted = id => {
    setContacts(cs => cs.map(c => c.id === id ? { ...c, lastContact: todayISO() } : c))
    setSnoozes(s => { const n = { ...s }; delete n[id]; return n })
    const c = contactById[id]
    if (c) { logActivity(`Logged contact with ${c.name}`, id); logAudit('user', 'Logged contact', c.name, 'Via follow-up tracker'); fireWebhook('touch', { name: c.name, channel: 'manual' }) }
    toast(`Marked ${c?.name?.split(' ')[0] || 'contact'} as contacted — nice!`)
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
  const runRuleNow = id => {
    const r = rules.find(x => x.id === id)
    setRules(rs => rs.map(x => x.id === id ? { ...x, lastRun: new Date().toISOString() } : x))
    if (r) { logAudit('rule', 'Sync run completed', r.name, `Mock run · ${r.direction} · no conflicts`); toast(`Sync run finished: ${r.name}`) }
  }

  /* ── connections ── */
  const saveCarddav = cfg => { setCarddav(cfg); logAudit('user', 'Saved CardDAV credentials', cfg.server, `User: ${cfg.username}`) }
  const testConnection = async () => {
    if (!carddav?.server) return false
    try {
      await fetch(carddav.server, { method: 'OPTIONS', mode: 'no-cors' })
      logAudit('system', 'CardDAV server reachable', carddav.server, 'Browser reachability probe (no-cors)')
      toast('Server is reachable — full CardDAV apply needs the server to allow your origin')
      return true
    } catch {
      toast('Server not reachable from this browser — check the URL/network', 'warn')
      return false
    }
  }
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

  const buildBackup = () => JSON.stringify({
    app: 'personal-crm', version: 2, exportedAt: new Date().toISOString(),
    data: { contacts, tasks, events, notes, tags, groups, rules, relFreq, audit, activity, imports, snoozes, notifState, notifPrefs, widgetPrefs, mailboxes, emails },
  }, null, 2)

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
    setContacts(d.contacts); setTasks(d.tasks || []); setEvents(d.events || []); setNotes(d.notes || [])
    setTags(d.tags || []); setGroups(d.groups || []); setRules(d.rules || [])
    if (d.relFreq) setRelFreq(d.relFreq); if (d.audit) setAudit(d.audit); if (d.activity) setActivity(d.activity)
    if (d.imports) setImports(d.imports); if (d.snoozes) setSnoozes(d.snoozes)
    if (d.notifState) setNotifState(d.notifState); if (d.notifPrefs) setNotifPrefs(d.notifPrefs)
    if (d.widgetPrefs) setWidgetPrefs(d.widgetPrefs)
    if (d.mailboxes) setMailboxes(d.mailboxes); if (d.emails) setEmails(d.emails)
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

  /* ── multi-device sync: single personal-crm-sync.json in the user's Drive ── */
  const snapshotCore = () => ({
    contacts, tasks, events, notes, tags, groups, rules, relFreq, emails,
  })
  const applySyncSnapshot = d => {
    if (Array.isArray(d.contacts)) setContacts(d.contacts)
    if (Array.isArray(d.tasks)) setTasks(d.tasks)
    if (Array.isArray(d.events)) setEvents(d.events)
    if (Array.isArray(d.notes)) setNotes(d.notes)
    if (Array.isArray(d.tags)) setTags(d.tags)
    if (Array.isArray(d.groups)) setGroups(d.groups)
    if (Array.isArray(d.rules)) setRules(d.rules)
    if (d.relFreq) setRelFreq(d.relFreq)
    if (Array.isArray(d.emails)) setEmails(d.emails)
  }
  const deviceName = () =>
    (goog.isNative() ? 'Android app' : (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches ? 'PWA' : 'Web')) +
    ' · ' + (syncState.deviceId || '').slice(-4)

  const syncNow = async (opts = {}) => {
    if (googleMode !== 'live') { if (opts.manual) toast('Sync needs your Google Client ID first — Settings → Google hub', 'warn'); return false }
    if (!syncState.enabled) { if (opts.manual) toast('Multi-device sync is off — enable it in Settings → Google hub', 'warn'); return false }
    if (syncBusy.current) return false
    syncBusy.current = true; setSyncing(true)
    try {
      const token = await ensureToken()
      let fileId = driveState.syncFileId || (await ds.findSyncFile(token))?.id || null
      const remote = fileId ? await ds.readSync(token, fileId) : null
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
          const res = await ds.writeSync(token, { __pcrmSync: 3, rev: newRev, deviceId: syncState.deviceId, device: deviceName(), updatedAt: new Date().toISOString(), data: merged }, fileId)
          if (!fileId) { fileId = res.id; setDriveState(s => ({ ...s, syncFileId: res.id })) }
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
        /* nothing newer remotely — our changes need pushing (or the first run) */
        newRev = (remote?.rev || rev) + 1
        const res = await ds.writeSync(token, { __pcrmSync: 3, rev: newRev, deviceId: syncState.deviceId, device: deviceName(), updatedAt: new Date().toISOString(), data: local }, fileId)
        if (!fileId) { fileId = res.id; setDriveState(s => ({ ...s, syncFileId: res.id })) }
        setSyncState(s => ({ ...s, lastRev: newRev, baselineData: local, baselineHash: localHash, lastSyncAt: new Date().toISOString() }))
        logAudit('system', 'Sync pushed', `rev ${newRev}`, `${local.contacts.length} contacts · ${local.tasks.length} tasks · ${local.events.length} events · ${local.notes.length} notes`)
        if (opts.manual) toast(`☁️ Synced to Drive (rev ${newRev})`)
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
    if (!syncState.enabled || googleMode !== 'live') return
    const tick = () => { if (navigator.onLine !== false) syncRef.current?.({}) }
    const iv = setInterval(tick, 60e3)
    const onVis = () => { if (document.visibilityState === 'visible') tick() }
    const onOnline = () => tick()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', onOnline)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('online', onOnline) }
  }, [syncState.enabled, googleMode])

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

  const resetAll = () => { try { localStorage.removeItem(KEY) } catch {} location.reload() }

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
    contacts, tasks, events, notes, tags, groups, rules, audit, activity, imports, relFreq, snoozes, carddav, gcal, toasts,
    contactById, groupById, tagById, toast, followUpStatus, logActivity, logAudit,
    addContact, updateContact, toggleStar, markContacted, addNote, updateNote, deleteNote,
    addTask, moveTask, updateTask, deleteTask, duplicateTask, createFollowUpTask,
    addEvent, moveEvent, deleteEvent,
    addTag, updateTag, deleteTag, mergeTags, bulkTag,
    addGroup, addRule, updateRule, toggleRule, deleteRule, runRuleNow,
    saveCarddav, testConnection, connectGcal, disconnectGcal,
    mailboxes, emails, connectMailbox, disconnectMailbox, syncMailbox, logEmailTouch, triageEmailAsLead, ignoreEmail,
    googleClientId, googleMode, saveGoogleClientId, connectGoogleLive, syncGoogleCalendar, syncGoogleContacts,
    driveState, driveBackupNow, driveRestoreNow, restoreAll, disconnectGoogle,
    webhooks, saveWebhooks, testWebhook, icsFeeds, addIcsFeed, syncIcsFeed, removeIcsFeed, syncing, syncState, syncReport, syncNow, setSyncEnabled,
    commitImport, rollbackImport, resolveAuditConflict, updateFrequency, snoozeFollowUp, unsnooze, resetAll,
    notifState, notifPrefs, buildNotifications, dismissNotif, snoozeNotif, unsnoozeNotif, markNotifRead, markAllNotifsRead, toggleNotifPref,
    widgetPrefs, toggleWidget, moveWidget, resetWidgets, DEFAULT_WIDGET_ORDER,
    theme, toggleTheme,
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
