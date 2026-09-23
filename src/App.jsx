import { Routes, Route, Navigate } from 'react-router-dom'
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
import About from './pages/About'
import IntegrationsPage from './pages/IntegrationsPage'
import FollowUps from './pages/FollowUps'
import Notifications from './pages/Notifications'

export default function App() {
  const { lock, sessionUnlocked } = useCrm()
  /* pincode gate: setup is offered on FIRST launch (skippable), unlock is
     required every start (in-memory session, auto-relocks when idle) */
  if (!lock) return <LockScreen mode="setup" />
  if (lock.hash && !sessionUnlocked) return <LockScreen mode="unlock" />
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <GlobalSearch />
      <QuickCapture />
      <ToastHost />
    </div>
  )
}
