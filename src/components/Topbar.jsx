import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { UserPlus, CalendarPlus, PlusSquare, Search, Sun, Moon, Download, Cloud, Loader2, CloudOff } from 'lucide-react'
import { useCrm } from '../store'
import { MONTHS, tsRel } from '../lib'

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
  '/about': 'About',
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
