import { useEffect, useState } from 'react'
import { backupNudgeText } from './lib/backup-nudge'
import { parseQuickLink } from './lib/quicklinks'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { StickyNote, CheckSquare, Copy, X, Share2 } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import GlobalSearch from './components/GlobalSearch'
import QuickCapture from './components/QuickCapture'
import { ToastHost, useCrm } from './store'
import LockScreen from './components/LockScreen'
import Dashboard from './pages/Dashboard'
import Contacts from './pages/Contacts'
import Tasks from './pages/Tasks'
import Notes from './pages/Notes'
import Groups from './pages/Groups'
import GraphPage from './pages/GraphPage'
import Analytics from './pages/Analytics'
import EmailPage from './pages/EmailPage'
import ImportPage from './pages/ImportPage'
import HistoryPage from './pages/HistoryPage'
import TagsManager from './pages/TagsManager'
import CalendarPage from './pages/CalendarPage'
import Birthdays from './pages/Birthdays'
import SettingsSync from './pages/SettingsSync'
import IntegrationsPage from './pages/IntegrationsPage'
import FollowUps from './pages/FollowUps'
import Notifications from './pages/Notifications'
import FilesPage from './pages/FilesPage'
import KnowledgeBase from './pages/KnowledgeBase'
import ArticleEditor from './pages/ArticleEditor'
import ReminderHost from './components/ReminderHost'
import { BottomTabBar, Sheet } from './components/Mobile'

export default function App() {
  const { lock, sessionUnlocked } = useCrm()
  const [moreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { setMoreOpen(false) }, [pathname])
  /* pincode gate: setup is offered on FIRST launch (skippable), unlock is
     required every start (in-memory session, auto-relocks when idle) */
  if (!lock) return <LockScreen mode="setup" />
  if (lock.hash && !sessionUnlocked) return <LockScreen mode="unlock" />
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 pb-28 lg:pb-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/kb" element={<KnowledgeBase />} />
            <Route path="/kb/:id" element={<ArticleEditor />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/birthdays" element={<Birthdays />} />
            <Route path="/follow-ups" element={<FollowUps />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/graph" element={<GraphPage />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/email" element={<EmailPage />} />
            <Route path="/tags" element={<TagsManager />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/settings" element={<SettingsSync />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <BottomTabBar moreOpen={moreOpen} onMore={() => setMoreOpen(o => !o)} />
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="All sections">
        <Sidebar sheet />
      </Sheet>
      <GlobalSearch />
      <QuickCapture />
      <ReminderHost />
      <ShareTargetHandler />
      <BackupNudge />
      <QuickLinkHandler />
      <ToastHost />
    </div>
  )
}

/* X7 — home-screen shortcuts / deep links (pcrm://quick/…) */
function QuickLinkHandler() {
  useEffect(() => {
    let sub = null
    const go = url => {
      const link = parseQuickLink(url)
      if (link) window.location.hash = link.hash
    }
    /* dynamic: the plugin only exists inside the Android app */
    import('@capacitor/app').then(({ App }) => {
      App.getLaunchUrl().then(r => { if (r?.url) go(r.url) }).catch(() => {})
      App.addListener('appUrlOpen', e => go(e.url)).then(h => { sub = h }).catch(() => {})
    }).catch(() => { /* web: nothing to listen to */ })
    return () => { try { sub?.remove?.() } catch { /* detached */ } }
  }, [])
  return null
}

/* X5 — auto-backup nudge: one passive toast per app start when backups are stale */
function BackupNudge() {
  const { driveState, toast } = useCrm()
  useEffect(() => {
    const txt = backupNudgeText(driveState?.lastBackup)
    if (!txt) return
    const t = setTimeout(() => toast(txt, 'warn'), 2500)
    return () => clearTimeout(t)
  }, [])
  return null
}

/* ── PWA share target: "Share to Personal CRM" from WhatsApp & friends ──
 * The manifest routes shared text/links to ./?title=&text=&url= — we stash
 * them, clean the URL, and offer the three things people actually want. */
function ShareTargetHandler() {
  const crm = useCrm()
  const [shared, setShared] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      const title = p.get('title') || ''
      const text = p.get('text') || ''
      const url = p.get('url') || ''
      if (title || text || url) {
        setShared({ title, text, url })
        window.history.replaceState({}, '', window.location.pathname + window.location.hash)
      }
    } catch { /* no-op */ }
  }, [])

  if (!shared) return null
  const body = [shared.text, shared.url].filter(Boolean).join('\n')
  const fallbackTitle = (shared.title || shared.text || shared.url || 'Shared item').slice(0, 60).split('\n')[0]
  const done = msg => { setShared(null); setCopied(false); if (msg) crm.toast(msg) }

  return (
    <div className="modal-wrap fixed inset-0 z-[95] overflow-y-auto p-4 sm:p-8 flex items-start justify-center"
      style={{ background: 'rgba(6,8,12,.7)', backdropFilter: 'blur(6px)' }} onClick={() => done()}>
      <div className="modal-panel fadein w-full max-w-md p-6 my-auto" data-testid="share-target-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl grid place-items-center flex-none" style={{ background: 'rgba(129,140,248,.16)', color: '#818cf8' }}>
            <Share2 size={16} />
          </div>
          <h3 className="text-[16.5px] font-bold tracking-tight flex-1">Shared with you</h3>
          <button className="icon-btn" title="Dismiss" onClick={() => done()}><X size={16} /></button>
        </div>
        <div className="card p-3.5 text-[12.5px] leading-relaxed max-h-[36vh] overflow-y-auto" style={{ color: 'var(--muted)' }}>
          {shared.title && <div className="font-semibold text-[13px] mb-1" style={{ color: 'var(--text)' }}>{shared.title}</div>}
          {body || <span style={{ color: 'var(--faint)' }}>(empty share)</span>}
        </div>
        <div className="flex flex-col gap-2 mt-4">
          <button className="btn btn-primary justify-center" data-testid="share-as-note"
            onClick={() => { crm.addNote({ title: fallbackTitle, body }); done('📝 Saved to Notes') }}>
            <StickyNote size={15} /> Save as note
          </button>
          <button className="btn btn-ghost justify-center" data-testid="share-as-task"
            onClick={() => { crm.addTask({ title: fallbackTitle, column: 'todo', priority: 'med', description: body }); done('✅ Task created') }}>
            <CheckSquare size={15} /> Create task
          </button>
          <button className="btn btn-ghost justify-center" data-testid="share-copy"
            onClick={async () => {
              const { copyText } = await import('./lib/share')
              const ok = await copyText(body)
              setCopied(ok)
              if (ok) done('📋 Copied to clipboard')
            }}>
            <Copy size={15} /> {copied ? 'Copied!' : 'Copy text'}
          </button>
        </div>
      </div>
    </div>
  )
}
