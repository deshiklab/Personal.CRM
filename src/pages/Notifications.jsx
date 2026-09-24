import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckSquare, HeartHandshake, Cake, Calendar, ShieldAlert, Check, Clock, X, RotateCcw, PlusSquare, BellRing, History } from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Card, Stat, Avatar, Pill, Toggle, Empty, CsvButton } from '../components/ui'
import { todayISO, daysAheadISO } from '../lib'

const TYPES = {
  task:       { label: 'Tasks',     icon: CheckSquare,     color: 'var(--t-sky)' },
  'follow-up':{ label: 'Follow-ups',icon: HeartHandshake,  color: 'var(--t-rose)' },
  birthday:   { label: 'Birthdays', icon: Cake,            color: 'var(--t-pink)' },
  event:      { label: 'Events',    icon: Calendar,        color: 'var(--t-violet)' },
  system:     { label: 'System',    icon: ShieldAlert,     color: 'var(--t-amber)' },
}
const PRIO_COLOR = { high: '#fb7185', med: '#fbbf24', low: '#94a3b8' }

export default function Notifications() {
  const crm = useCrm()
  const { buildNotifications, markAllNotifsRead, notifPrefs } = crm
  const [filter, setFilter] = useState('all')

  const all = useMemo(() => buildNotifications(), [crm.contacts, crm.tasks, crm.events, crm.audit, crm.notifState, crm.notifPrefs])
  const active = all.filter(n => n.active)
  const unread = active.filter(n => !n.read)
  const snoozed = all.filter(n => n.enabled && n.snoozedUntil && !n.dismissed)
  const dismissed = all.filter(n => n.enabled && n.dismissed)
  const mutedTypes = Object.entries(notifPrefs).filter(([, v]) => !v).map(([k]) => k)

  let list = active
  if (filter === 'unread') list = unread
  else if (TYPES[filter]) list = active.filter(n => n.type === filter)

  return (
    <div className="max-w-[1100px] mx-auto">
      <SectionHead kicker="Beyond the core · 2" title="Notification Center"
        sub="One inbox for task due-dates, follow-up nudges, birthdays, events and sync conflicts — resolve items at the source and they clear themselves."
        right={<div className="flex items-center gap-2">
          <CsvButton filename="notifications.csv" rows={crm.buildNotifications()} headers={[
            { label: 'Type', get: r => r.type }, { label: 'Priority', get: r => r.priority },
            { label: 'Title', get: r => r.title }, { label: 'Detail', get: r => r.body },
            { label: 'Reference date', get: r => r.ts },
          ]} />
          {unread.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => { markAllNotifsRead(unread.map(n => n.key)); crm.toast('All marked as read') }}><Check size={13} /> Mark all read</button>}
        </div>} />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat icon={BellRing} label="Unread" value={unread.length} tone="#fb7185" />
        <Stat icon={Bell} label="In inbox" value={active.length} tone="#818cf8" />
        <Stat icon={Clock} label="Snoozed" value={snoozed.length} tone="#fbbf24" />
        <Stat icon={X} label="Muted categories" value={mutedTypes.length} tone="#94a3b8" />
      </div>

      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {[['all', 'All'], ['unread', `Unread · ${unread.length}`], ...Object.entries(TYPES).map(([k, t]) => [k, t.label])].map(([id, l]) => (
          <button key={id} className={`chip chip-btn ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>{l}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 items-start">
        <div className="flex flex-col gap-2">
          {list.length === 0 && <Card><Empty icon={Bell} title="All clear ✨">Nothing {filter === 'all' ? 'needs your attention' : 'in this bucket'} right now.</Empty></Card>}
          {list.map(n => <NotifCard key={n.key} n={n} />)}

          {snoozed.length > 0 && filter === 'all' && (
            <>
              <div className="text-[11px] font-bold uppercase tracking-[.09em] mt-4 mb-1 px-1" style={{ color: 'var(--faint)' }}>Snoozed</div>
              {snoozed.map(n => <NotifCard key={n.key} n={n} snoozed />)}
            </>
          )}
          {dismissed.length > 0 && filter === 'all' && (
            <>
              <div className="text-[11px] font-bold uppercase tracking-[.09em] mt-4 mb-1 px-1" style={{ color: 'var(--faint)' }}>Dismissed</div>
              {dismissed.map(n => <NotifCard key={n.key} n={n} dismissedCard />)}
            </>
          )}
        </div>

        <PrefsCard mutedTypes={mutedTypes} />
      </div>
    </div>
  )
}

function NotifCard({ n, snoozed, dismissedCard }) {
  const crm = useCrm()
  const navigate = useNavigate()
  const t = TYPES[n.type]
  const contact = n.contactId && crm.contactById[n.contactId]

  const touch = () => crm.markNotifRead(n.key)
  const openEntity = () => {
    touch()
    if (n.type === 'task') navigate(`/tasks?focus=${n.taskId}`)
    else if (n.type === 'event') navigate(`/calendar?event=${n.eventId}`)
    else if (n.type === 'system') navigate('/history?tab=sync')
    else if (contact) navigate(`/contacts?open=${contact.id}`)
  }

  return (
    <Card className="p-3.5 flex items-start gap-3" style={{ opacity: dismissedCard ? .55 : 1 }}>
      <span className="w-9 h-9 rounded-xl grid place-items-center flex-none mt-0.5" style={{ background: t.color + '1c', color: t.color }}>
        <t.icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[13.5px]">{n.title}</span>
          <span className="dot" style={{ background: PRIO_COLOR[n.priority] }} title={`${n.priority} priority`} />
          {!n.read && !snoozed && !dismissedCard && <span className="chip" style={{ fontSize: 9.5, background: '#818cf81c', color: '#c7d2fe', borderColor: '#818cf840' }}>UNREAD</span>}
          {snoozed && <Pill color="#fbbf24"><Clock size={10} /> until {n.snoozedUntil.slice(5)}</Pill>}
        </div>
        <div className="text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>{n.body}</div>

        {!dismissedCard && (
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            {n.type === 'task' && (
              <>
                <button className="btn btn-primary btn-sm" onClick={() => { touch(); crm.updateTask(n.taskId, { column: 'done' }); crm.toast('Task marked done') }}><Check size={12} /> Mark done</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { touch(); crm.updateTask(n.taskId, { due: daysAheadISO(1) }); crm.toast('Due date pushed to tomorrow') }}>Push +1d</button>
                <button className="btn btn-ghost btn-sm" onClick={openEntity}>Open</button>
              </>
            )}
            {n.type === 'follow-up' && (
              <>
                <button className="btn btn-primary btn-sm" onClick={() => { touch(); crm.markContacted(n.contactId) }}><Check size={12} /> Log contact</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { touch(); crm.createFollowUpTask(n.contactId); crm.dismissNotif(n.key) }}><PlusSquare size={12} /> To task</button>
                <button className="btn btn-ghost btn-sm" onClick={openEntity}>Profile</button>
              </>
            )}
            {n.type === 'birthday' && (
              <>
                <button className="btn btn-primary btn-sm" onClick={() => {
                  touch()
                  const first = contact?.name.split(' ')[0] || 'them'
                  crm.addTask({ title: `Wish ${first} a happy birthday 🎂`, column: 'todo', priority: 'med', due: n.ts || todayISO(), contactId: n.contactId })
                  crm.dismissNotif(n.key); crm.toast('Birthday wish task created')
                }}><Cake size={12} /> Wish task</button>
                <button className="btn btn-ghost btn-sm" onClick={openEntity}>Profile</button>
              </>
            )}
            {n.type === 'event' && <button className="btn btn-primary btn-sm" onClick={openEntity}><Calendar size={12} /> Open in calendar</button>}
            {n.type === 'system' && (
              <button className="btn btn-primary btn-sm" onClick={openEntity}><History size={12} /> Review conflict</button>
            )}
            <span className="flex-1" />
            {!snoozed && (
              <>
                <button className="btn btn-ghost btn-sm" title="Snooze 1 day" onClick={() => { touch(); crm.snoozeNotif(n.key, 1) }}><Clock size={12} /> 1d</button>
                <button className="btn btn-ghost btn-sm" title="Snooze 3 days" onClick={() => { touch(); crm.snoozeNotif(n.key, 3) }}>3d</button>
                <button className="btn btn-ghost btn-sm" title="Dismiss" onClick={() => { touch(); crm.dismissNotif(n.key) }}><X size={12} /></button>
              </>
            )}
            {snoozed && <button className="btn btn-ghost btn-sm" onClick={() => crm.unsnoozeNotif(n.key)}><RotateCcw size={12} /> Unsnooze</button>}
          </div>
        )}
        {dismissedCard && (
          <div className="mt-2">
            <button className="btn btn-ghost btn-sm" onClick={() => crm.dismissNotif(n.key, false)}><RotateCcw size={12} /> Restore to inbox</button>
          </div>
        )}
      </div>
      {contact && <Avatar name={contact.name} photo={contact.photo} size={30} className="flex-none mt-0.5" />}
    </Card>
  )
}

function PrefsCard({ mutedTypes }) {
  const {
    notifPrefs, toggleNotifPref, toast, can, isPro,
    reminderPrefs, patchReminderPrefs, requestReminderPermission,
    sendTestReminder, resyncReminders,
  } = useCrm()
  const proReminders = can?.('reminders')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null)

  const enableOs = async () => {
    setBusy(true)
    try {
      if (!proReminders) {
        toast('Local OS reminders are a Pro feature — unlock on the Pro screen', 'warn')
        return
      }
      const p = await requestReminderPermission()
      if (p !== 'granted') {
        toast(p === 'denied' ? 'Permission denied — enable notifications in system settings' : 'Permission not granted', 'warn')
        return
      }
      patchReminderPrefs({ enabled: true, permission: p })
      const r = await resyncReminders()
      setPending(r?.scheduled ?? 0)
      toast(r?.ok ? `Reminders armed · ${r.scheduled || 0} scheduled` : 'Could not schedule reminders', r?.ok ? 'ok' : 'warn')
    } finally { setBusy(false) }
  }

  const testPush = async () => {
    setBusy(true)
    try { await sendTestReminder() } finally { setBusy(false) }
  }

  const perm = reminderPrefs?.permission || 'unknown'

  return (
    <Card className="p-4">
      <h3 className="font-bold text-[13.5px] mb-1">Inbox categories</h3>
      <p className="text-[11.5px] mb-3" style={{ color: 'var(--faint)' }}>Muted categories are hidden from the inbox and the sidebar badge.</p>
      <div className="flex flex-col gap-2.5">
        {Object.entries(TYPES).map(([k, t]) => (
          <div key={k} className="flex items-center gap-2.5">
            <t.icon size={14} style={{ color: notifPrefs[k] !== false ? t.color : 'var(--faint)' }} />
            <span className="text-[12.5px] font-medium flex-1">{t.label}</span>
            <Toggle on={notifPrefs[k] !== false} onChange={v => toggleNotifPref(k, v)} />
          </div>
        ))}
      </div>
      {mutedTypes.length > 0 && (
        <p className="text-[11.5px] mt-3" style={{ color: 'var(--faint)' }}>Currently muted: {mutedTypes.map(k => TYPES[k].label).join(', ')}</p>
      )}

      <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-[13.5px] flex-1">Device reminders</h3>
          {!proReminders && <span className="chip" style={{ fontSize: 10 }}>PRO</span>}
        </div>
        <p className="text-[11.5px] mb-3 leading-snug" style={{ color: 'var(--faint)' }}>
          Local OS nudges for due tasks, follow-ups and birthdays. Nothing leaves this device.
          {!proReminders && ' Unlock Pro to arm them.'}
        </p>
        <div className="flex items-center gap-2.5 mb-3">
          <span className="text-[12.5px] font-medium flex-1">Arm reminders</span>
          <Toggle
            on={!!proReminders && reminderPrefs?.enabled !== false && perm === 'granted'}
            disabled={!proReminders || busy}
            onChange={async v => {
              if (!proReminders) return toast('Pro required', 'warn')
              if (v) return enableOs()
              patchReminderPrefs({ enabled: false })
              await resyncReminders()
              toast('Device reminders off')
            }}
          />
        </div>
        <div className="text-[11.5px] mb-3 space-y-1" style={{ color: 'var(--faint)' }}>
          <div>Permission · <b style={{ color: 'var(--text)' }}>{perm}</b></div>
          {reminderPrefs?.lastSyncAt && <div>Last sync · {new Date(reminderPrefs.lastSyncAt).toLocaleString()}</div>}
          {pending != null && <div>Scheduled · {pending}</div>}
        </div>

        {/* Quiet hours + lead times — Pro only, disabled when free */}
        <div className={`mb-3 ${!proReminders ? 'opacity-50 pointer-events-none' : ''}`} aria-disabled={!proReminders}>
          <div className="text-[11px] font-bold uppercase tracking-[.09em] mb-2" style={{ color: 'var(--faint)' }}>Quiet hours</div>
          <p className="text-[11px] mb-2 leading-snug" style={{ color: 'var(--faint)' }}>
            Nudges that would fire in this window slide to the end hour (local time).
          </p>
          <div className="flex items-center gap-2 mb-3">
            <label className="flex-1 text-[12px]">
              <span className="sr-only">Quiet hours start</span>
              <select className="input" style={{ padding: '6px 8px', fontSize: 12 }}
                disabled={!proReminders || busy}
                value={reminderPrefs?.quietHours?.start ?? 22}
                onChange={e => {
                  const start = +e.target.value
                  patchReminderPrefs({ quietHours: { ...(reminderPrefs.quietHours || {}), start, end: reminderPrefs?.quietHours?.end ?? 7 } })
                }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
            </label>
            <span className="text-[11px]" style={{ color: 'var(--faint)' }}>→</span>
            <label className="flex-1 text-[12px]">
              <span className="sr-only">Quiet hours end</span>
              <select className="input" style={{ padding: '6px 8px', fontSize: 12 }}
                disabled={!proReminders || busy}
                value={reminderPrefs?.quietHours?.end ?? 7}
                onChange={e => {
                  const end = +e.target.value
                  patchReminderPrefs({ quietHours: { ...(reminderPrefs.quietHours || {}), end, start: reminderPrefs?.quietHours?.start ?? 22 } })
                }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
            </label>
          </div>

          <div className="text-[11px] font-bold uppercase tracking-[.09em] mb-2" style={{ color: 'var(--faint)' }}>Lead times</div>
          <p className="text-[11px] mb-2 leading-snug" style={{ color: 'var(--faint)' }}>
            When to nudge on the day (or minutes before an event with a time).
          </p>
          <div className="flex flex-col gap-2">
            {[
              { id: 'task', label: 'Tasks', options: [
                { v: 8 * 60, l: '08:00' }, { v: 9 * 60, l: '09:00' }, { v: 10 * 60, l: '10:00' },
                { v: 12 * 60, l: '12:00' }, { v: 17 * 60, l: '17:00' }, { v: 18 * 60, l: '18:00' },
              ]},
              { id: 'follow-up', label: 'Follow-ups', options: [
                { v: 9 * 60, l: '09:00' }, { v: 10 * 60, l: '10:00' }, { v: 11 * 60, l: '11:00' },
                { v: 14 * 60, l: '14:00' }, { v: 16 * 60, l: '16:00' },
              ]},
              { id: 'birthday', label: 'Birthdays', options: [
                { v: 8 * 60, l: '08:00' }, { v: 9 * 60, l: '09:00' }, { v: 10 * 60, l: '10:00' },
                { v: 12 * 60, l: '12:00' },
              ]},
              { id: 'event', label: 'Events', options: [
                { v: 15, l: '15 min before' }, { v: 30, l: '30 min before' },
                { v: 60, l: '1 hour before' }, { v: 120, l: '2 hours before' },
                { v: 9 * 60, l: '09:00 if no time' },
              ]},
            ].map(row => (
              <div key={row.id} className="flex items-center gap-2">
                <span className="text-[12px] font-medium w-[88px] flex-none">{row.label}</span>
                <select className="input flex-1" style={{ padding: '6px 8px', fontSize: 12 }}
                  disabled={!proReminders || busy}
                  value={reminderPrefs?.leadMinutes?.[row.id] ?? row.options[0].v}
                  onChange={e => {
                    const leadMinutes = { ...(reminderPrefs.leadMinutes || {}), [row.id]: +e.target.value }
                    patchReminderPrefs({ leadMinutes })
                  }}>
                  {row.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm w-full mt-2"
            disabled={!proReminders || busy || perm !== 'granted'}
            onClick={async () => {
              setBusy(true)
              try {
                const r = await resyncReminders()
                setPending(r?.scheduled ?? 0)
                toast(r?.ok ? `Schedule updated · ${r.scheduled || 0} armed` : 'Could not resync', r?.ok ? 'ok' : 'warn')
              } finally { setBusy(false) }
            }}>
            Apply schedule
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <button type="button" className="btn btn-primary btn-sm w-full" disabled={busy || !proReminders}
            onClick={enableOs}>
            <BellRing size={13} /> {perm === 'granted' ? 'Resync schedule' : 'Enable device reminders'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm w-full" disabled={busy || !proReminders} onClick={testPush}>
            <Bell size={13} /> Send test notification
          </button>
          {!proReminders && (
            <a href="#/pro" className="btn btn-ghost btn-sm w-full" style={{ textDecoration: 'none' }}>
              Unlock Pro for reminders
            </a>
          )}
        </div>
      </div>
    </Card>
  )
}
