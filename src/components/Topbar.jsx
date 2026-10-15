import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { UserPlus, CalendarPlus, PlusSquare, Search, Sun, Moon, Download, Cloud, Loader2, CloudOff, BellRing, Check, Bell } from 'lucide-react'
import { useCrm } from '../store'
import { MONTHS, tsRel } from '../lib'
import { dueSoonLabel } from '../lib/reminders'

const TITLES = {
  '/': 'Dashboard',
  '/contacts': 'Contacts',
  '/tasks': 'Tasks',
  '/notes': 'Notes',
  '/email': 'Email Integration',
  '/calendar': 'Calendar',
  '/birthdays': 'Birthdays & Occasions',
  '/follow-ups': 'Follow-Up Tracker',
  '/notifications': 'Notification Center',
  '/groups': 'Groups',
  '/graph': 'Relationship Map',
  '/analytics': 'Analytics & Insights',
  '/tags': 'Tags Manager',
  '/import': 'Import & Export',
  '/history': 'Import & Sync History',
  '/integrations': 'Integrations & Bridges',
  '/settings': 'Settings & Sync',
}

export default function Topbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme, syncing, syncState, syncNow, googleMode, syncProvider } = useCrm()
  const now = new Date()
  const dateStr = `${now.toLocaleDateString('en-US', { weekday: 'short' })}, ${MONTHS[now.getMonth()].slice(0, 3)} ${now.getDate()}`

  /* PWA install: capture the browser's install prompt */
  const [installEvt, setInstallEvt] = useState(null)
  useEffect(() => {
    const onPrompt = e => { e.preventDefault(); setInstallEvt(e) }
    const onDone = () => setInstallEvt(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onDone)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onDone) }
  }, [])
  const install = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice.catch(() => {}); setInstallEvt(null) }

  return (
    <header className="h-16 flex-none border-b flex items-center gap-3 px-4 md:px-6"
      style={{ borderColor: 'var(--border)', background: 'var(--topbg)', backdropFilter: 'blur(10px)' }}>
      <div className="min-w-0">
        <h1 className="text-[16px] font-bold tracking-tight truncate">{TITLES[pathname] || 'Personal CRM'}</h1>
        <div className="text-[11.5px] font-medium hidden sm:block" style={{ color: 'var(--faint)' }}>{dateStr}</div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <BellMenu />
        {installEvt && (
          <button className="btn btn-ghost btn-sm" onClick={install} title="Install as an app (works offline)" style={{ color: 'var(--i2)' }}>
            <Download size={14} /><span className="hidden md:inline">Install</span>
          </button>
        )}
        <button
          className="btn btn-ghost btn-sm"
          style={syncProvider() !== 'none' ? { color: '#34d399' } : { color: 'var(--faint)' }}
          title={
            syncProvider() === 'none' ? 'Multi-device sync — set up GitHub Gist or Google in Settings' :
            syncing ? `Syncing via ${syncProvider() === 'gist' ? 'GitHub Gist' : 'Google Drive'}…` :
            `Multi-device sync · ${syncState.lastSyncAt ? 'synced ' + tsRel(syncState.lastSyncAt) : 'never synced yet'} · via ${syncProvider()} · click to sync now`
          }
          onClick={() => {
            if (syncProvider() === 'none') return navigate('/settings')
            syncNow({ manual: true })
          }}>
          {syncing ? <Loader2 size={14} className="animate-spin" /> :
           syncProvider() !== 'none' ? <Cloud size={14} /> : <CloudOff size={14} />}
          <span className="hidden lg:inline">
            {syncProvider() === 'none' ? 'Sync: setup' :
             syncing ? 'Syncing…' :
             syncState.lastSyncAt ? tsRel(syncState.lastSyncAt) : 'Sync now'}
          </span>
        </button>
        <button className="icon-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => window.dispatchEvent(new Event('crm:search'))} title="Global search (⌘K)">
          <Search size={14} /><span className="hidden md:inline">Search</span>
          <kbd className="chip hidden md:inline-flex" style={{ fontSize: 10, padding: '1px 7px' }}>⌘K</kbd>
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/contacts?new=1')} title="Add contact">
          <UserPlus size={14} /><span className="hidden sm:inline">Contact</span>
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tasks?new=1')} title="New task">
          <PlusSquare size={14} /><span className="hidden sm:inline">Task</span>
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/calendar?new=1')} title="New event">
          <CalendarPlus size={14} /><span className="hidden sm:inline">Event</span>
        </button>
      </div>
    </header>
  )
}

/* live reminders dropdown — next 5 up, quick-done, deep link to the center */
function BellMenu() {
  const crm = useCrm()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  const upcoming = crm.reminders
    .filter(r => r.status !== 'done' && r.at)
    .sort((a, b) => (a.at || '').localeCompare(b.at || ''))
    .slice(0, 5)
  const active = crm.reminders.filter(r => r.status !== 'done' && r.at).length

  useEffect(() => {
    const onDoc = e => { if (open && box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative" ref={box}>
      <button className="icon-btn" title="Upcoming reminders" onClick={() => setOpen(o => !o)}>
        <BellRing size={15} style={active ? { color: '#fbbf24' } : undefined} />
        {active > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-black grid place-items-center"
            style={{ background: '#fbbf24', color: '#0a0c11' }}>{active}</span>
        )}
      </button>
      {open && (
        <div className="panel absolute right-0 mt-2 w-[290px] p-2 z-50 fadein">
          <div className="text-[10px] font-bold uppercase tracking-[.09em] px-2 py-1.5" style={{ color: 'var(--faint)' }}>Upcoming reminders</div>
          {upcoming.length === 0 && (
            <div className="text-[12px] px-2 py-3 text-center" style={{ color: 'var(--faint)' }}>
              Nothing scheduled. Set reminders from tasks, events, notes or the inbox.
            </div>
          )}
          {upcoming.map(r => (
            <div key={r.id} className="flex items-start gap-2 rounded-xl px-2 py-2 hover:bg-white/[.05]">
              <Bell size={12} className="flex-none mt-0.5" style={{ color: '#fbbf24' }} />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold truncate">{r.title || 'Reminder'}</div>
                <div className="text-[10px]" style={{ color: 'var(--faint)' }}>{String(r.at).replace('T', ' ')} · {dueSoonLabel(r.at)}{r.repeat !== 'none' ? ` ↻` : ''}</div>
              </div>
              <button className="icon-btn !w-6 !h-6" title="Mark done" onClick={() => crm.completeReminder(r.id)}><Check size={11} /></button>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm w-full mt-1" onClick={() => { setOpen(false); navigate('/notifications') }}>
            All reminders & inbox
          </button>
        </div>
      )}
    </div>
  )
}
