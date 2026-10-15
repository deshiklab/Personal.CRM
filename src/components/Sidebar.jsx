import { NavLink } from 'react-router-dom'
import { BookOpen, LayoutDashboard, Users, CheckSquare, Calendar, HeartHandshake, UsersRound, Tag, FileUp, Settings2, StickyNote, Network, History, Bell, Gift, BarChart3, Mail, Plug, FolderOpen } from 'lucide-react'
import { useCrm } from '../store'
import { daysUntil, tsRel } from '../lib'
import { t, useLang } from '../lib/i18n'

export default function Sidebar({ sheet = false }) {
  useLang()
  const { contacts, tasks, rules, gcal, followUpStatus, buildNotifications } = useCrm()

  const dueToday = tasks.filter(t => t.column !== 'done' && t.due && daysUntil(t.due) <= 0).length
  const overdue = contacts.filter(c => followUpStatus(c).state === 'overdue').length
  const enabledRules = rules.filter(r => r.enabled).length
  const unread = buildNotifications().filter(n => n.active && !n.read).length

  const NAV = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/contacts', label: t('nav.contacts'), icon: Users },
    { to: '/tasks', label: t('nav.tasks'), icon: CheckSquare, badge: dueToday, tone: '#fbbf24' },
    { to: '/notes', label: t('nav.notes'), icon: StickyNote },
    { to: '/files', label: t('nav.files'), icon: FolderOpen },
    { to: '/kb', label: t('nav.kb'), icon: BookOpen },
    { to: '/email', label: t('nav.email'), icon: Mail },
    { to: '/calendar', label: t('nav.calendar'), icon: Calendar },
    { to: '/birthdays', label: t('nav.birthdays'), icon: Gift },
    { to: '/follow-ups', label: t('nav.followups'), icon: HeartHandshake, badge: overdue, tone: '#fb7185' },
    { to: '/notifications', label: t('nav.inbox'), icon: Bell, badge: unread, tone: '#f472b6' },
    { to: '/groups', label: t('nav.groups'), icon: UsersRound },
    { to: '/graph', label: t('nav.network'), icon: Network },
    { to: '/analytics', label: t('nav.analytics'), icon: BarChart3 },
    { to: '/tags', label: t('nav.tags'), icon: Tag },
    { to: '/import', label: t('nav.import'), icon: FileUp },
    { to: '/history', label: t('nav.history'), icon: History },
    { to: '/integrations', label: t('nav.integrations'), icon: Plug },
    { to: '/settings', label: t('nav.settings'), icon: Settings2 },
  ]

  return (
    <aside className={sheet ? 'w-full h-full flex flex-col border-r' : 'hidden lg:flex w-60 flex-none h-screen flex-col border-r'} style={{ borderColor: 'var(--border)', background: 'var(--sidebg)' }}>
      <div className="h-16 flex items-center gap-3 px-3 lg:px-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="w-8 h-8 rounded-xl grid place-items-center text-[15px] font-black flex-none"
          style={{ background: 'linear-gradient(120deg,#818cf8,#38bdf8 55%,#34d399)', color: '#0a0c11', boxShadow: '0 4px 18px rgba(129,140,248,.35)' }}>⚡</div>
        <div className={sheet ? 'leading-tight' : 'hidden lg:block leading-tight'}>
          <div className="text-[14px] font-extrabold tracking-tight">Personal CRM</div>
          <div className="text-[10.5px] font-semibold" style={{ color: 'var(--faint)' }}>BiTsCol workspace</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-colors`}
            style={({ isActive }) => isActive
              ? { background: 'rgba(129,140,248,.16)', color: 'var(--text)' }
              : { color: 'var(--muted)' }}>
            <n.icon size={17} className={sheet ? 'flex-none' : 'flex-none mx-auto lg:mx-0'} />
            <span className={sheet ? 'flex-1' : 'hidden lg:inline flex-1'}>{n.label}</span>
            {n.badge > 0 && (
              <span className={sheet ? 'text-[10.5px] font-extrabold rounded-full px-2 py-0.5' : 'hidden lg:inline text-[10.5px] font-extrabold rounded-full px-2 py-0.5'}
                style={{ background: n.tone + '22', color: n.tone }}>{n.badge}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={sheet ? 'p-3' : 'p-3 hidden lg:block'}>
        <div className="card p-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[.08em] mb-2" style={{ color: 'var(--faint)' }}>Sync status</div>
          <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: gcal.connected ? '#34d399' : '#fbbf24' }}>
            <span className="dot" style={{ background: gcal.connected ? '#34d399' : '#fbbf24' }} />
            {gcal.connected ? `Google · ${tsRel(gcal.lastSync)}` : 'Google not connected'}
          </div>
          <div className="flex items-center gap-2 text-[12px] mt-1.5" style={{ color: 'var(--muted)' }}>
            <span className="dot" style={{ background: enabledRules ? '#34d399' : '#6b7382' }} />
            {enabledRules}/{rules.length} rules active
          </div>
        </div>
      </div>
    </aside>
  )
}
