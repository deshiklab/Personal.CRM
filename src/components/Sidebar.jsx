import { NavLink } from 'react-router-dom'
import {LayoutDashboard, Users, CheckSquare, Calendar, HeartHandshake, UsersRound, Tag, FileUp, Settings2, StickyNote, Network, History, Bell, Gift, BarChart3, Mail, Plug, Info } from 'lucide-react'
import { useCrm } from '../store'
import { BRAND, COPYRIGHT } from '../brand'
import { daysUntil, tsRel } from '../lib'

export default function Sidebar() {
  const { contacts, tasks, rules, gcal, followUpStatus, buildNotifications } = useCrm()

  const dueToday = tasks.filter(t => t.column !== 'done' && t.due && daysUntil(t.due) <= 0).length
  const overdue = contacts.filter(c => followUpStatus(c).state === 'overdue').length
  const enabledRules = rules.filter(r => r.enabled).length
  const unread = buildNotifications().filter(n => n.active && !n.read).length

  const NAV = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/contacts', label: 'Contacts', icon: Users },
    { to: '/tasks', label: 'Tasks', icon: CheckSquare, badge: dueToday, tone: '#fbbf24' },
    { to: '/notes', label: 'Notes', icon: StickyNote },
    { to: '/email', label: 'Email', icon: Mail },
    { to: '/calendar', label: 'Calendar', icon: Calendar },
    { to: '/birthdays', label: 'Birthdays', icon: Gift },
    { to: '/follow-ups', label: 'Follow-Ups', icon: HeartHandshake, badge: overdue, tone: '#fb7185' },
    { to: '/notifications', label: 'Inbox', icon: Bell, badge: unread, tone: '#f472b6' },
    { to: '/groups', label: 'Groups', icon: UsersRound },
    { to: '/graph', label: 'Network', icon: Network },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/tags', label: 'Tags', icon: Tag },
    { to: '/import', label: 'Import', icon: FileUp },
    { to: '/history', label: 'History', icon: History },
    { to: '/integrations', label: 'Integrations', icon: Plug },
    { to: '/settings', label: 'Settings', icon: Settings2 },
    { to: '/about', label: 'About', icon: Info },
  ]

  return (
    <aside className="w-[62px] lg:w-60 flex-none h-screen flex flex-col border-r" style={{ borderColor: 'var(--border)', background: 'var(--sidebg)' }}>
      <div className="h-16 flex items-center gap-3 px-3 lg:px-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="w-8 h-8 rounded-xl grid place-items-center text-[15px] font-black flex-none"
          style={{ background: 'linear-gradient(120deg,#818cf8,#38bdf8 55%,#34d399)', color: '#0a0c11', boxShadow: '0 4px 18px rgba(129,140,248,.35)' }}>⚡</div>
        <div className="hidden lg:block leading-tight">
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
            <n.icon size={17} className="flex-none mx-auto lg:mx-0" />
            <span className="hidden lg:inline flex-1">{n.label}</span>
            {n.badge > 0 && (
              <span className="hidden lg:inline text-[10.5px] font-extrabold rounded-full px-2 py-0.5"
                style={{ background: n.tone + '22', color: n.tone }}>{n.badge}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 hidden lg:block">
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
        <div className="mt-2.5 text-center leading-tight">
          <NavLink to="/about" className="block" style={{ textDecoration: 'none' }}>
            <div className="text-[10.5px] font-bold" style={{ color: 'var(--muted)' }}>
              {BRAND.app} · v{BRAND.version}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--faint)' }}>{COPYRIGHT}</div>
          </NavLink>
        </div>
      </div>
    </aside>
  )
}
