import { useState, useEffect } from 'react'
import { BookOpen } from 'lucide-react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import GlobalSearch from './components/GlobalSearch'
import QuickCapture from './components/QuickCapture'
import { ToastHost, useCrm } from './store'
import LockScreen from './components/LockScreen'
import RegistrationScreen from './components/RegistrationScreen'
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
import About from './pages/About'
import Pro from './pages/Pro'
import IntegrationsPage from './pages/IntegrationsPage'
import FollowUps from './pages/FollowUps'
import Notifications from './pages/Notifications'
import KnowledgeBase from './pages/KnowledgeBase'
import TooltipHost from './components/Tooltip'
import ShortcutsOverlay from './components/ShortcutsOverlay'
import Tour from './components/Tour'
import { useNavigate } from 'react-router-dom'

/* Support diagnostic — add ?simulate-crash anywhere in the URL and this throws
 * during render, so we can prove the crash screen still catches a fault instead
 * of leaving a white page. Nothing else reads it. */
const CrashProbe = () => {
  if (typeof location !== 'undefined' && location.hash.includes('simulate-crash')) {
    throw new Error('Simulated crash — this is the diagnostic crash screen.')
  }
  return null
}

export default function App() {
  const { lock, sessionUnlocked, profile } = useCrm()
  const { pathname } = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const navigate = useNavigate()
  const { helpPrefs } = useCrm() || {}
  /* never leave the mobile drawer hanging across a route change */
  useEffect(() => { setNavOpen(false) }, [pathname])

  /* ── go-mode: press g then a letter to jump to a screen ── */
  useEffect(() => {
    let armed = false
    let timer = null
    const GO = {
      d: '/', c: '/contacts', t: '/tasks', n: '/notes', e: '/calendar', b: '/birthdays',
      f: '/follow-ups', i: '/notifications', g: '/groups', r: '/graph', a: '/analytics',
      k: '/knowledge', s: '/settings', h: '/history', m: '/import', p: '/pro',
    }
    const onKey = e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (armed) {
        const to = GO[e.key.toLowerCase()]
        clearTimeout(timer); armed = false
        if (to) { e.preventDefault(); navigate(to) }
        return
      }
      if (e.key === 'g') { armed = true; timer = setTimeout(() => { armed = false }, 1600) }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(timer) }
  }, [navigate])
  /* gate order: register (first launch, skippable) → pincode setup → unlock.
     Registration comes first so the owner notification carries a real name. */
  if (!profile) return <RegistrationScreen />
  /* pincode gate: setup is offered on FIRST launch (skippable), unlock is
     required every start (in-memory session, auto-relocks when idle) */
  if (!lock) return <LockScreen mode="setup" />
  if (lock.hash && !sessionUnlocked) return <LockScreen mode="unlock" />
  return (
    <div className="flex h-screen overflow-hidden">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <CrashProbe />
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenu={() => setNavOpen(true)} />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6" tabIndex={-1} role="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/notes" element={<Notes />} />
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
            <Route path="/about" element={<About />} />
            <Route path="/pro" element={<Pro />} />
            <Route path="/knowledge" element={<KnowledgeBase />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <GlobalSearch />
      <QuickCapture />
      <ToastHost />
      {/* help layer: tooltips read data-tip off any element, ? opens shortcuts,
          and the tour spotlights one control at a time */}
      <TooltipHost enabled={helpPrefs?.tips !== false} />
      <ShortcutsOverlay />
      <Tour autoStart={pathname === '/'} />
      <HelpFab />
    </div>
  )
}


/* Floating help button — one tap to the manual, no matter where you are. */
function HelpFab() {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/knowledge')}
      data-tip-with-title="Knowledge base"
      data-tip-title="Knowledge base"
      data-tip-body="The manual, the glossary and your own articles — searchable offline."
      data-tip-learn="notes.kb"
      className="fixed z-[55] w-9 h-9 rounded-full grid place-items-center safe-bottom hidden md:grid"
      aria-label="Open knowledge base"
      style={{
        left: 14, bottom: 14,
        background: 'var(--panel)', border: '1px solid var(--border2)',
        color: 'var(--muted)', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,.4)',
      }}
    >
      <BookOpen size={15} />
    </button>
  )
}
