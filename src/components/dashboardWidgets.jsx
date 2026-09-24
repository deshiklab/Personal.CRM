import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, CheckSquare, CalendarClock, HeartHandshake, ArrowRight, RefreshCw, Activity, Clock, Cake, Tag, Timer, Flame, TrendingUp, BarChart3 } from 'lucide-react'
import { useCrm } from '../store'
import { Card, Stat, Avatar, Pill, Sparkline, MiniBars, Empty, EVENT_COLORS } from './ui'
import { todayISO, daysUntil, parseISO, MONTHS_S, tsRel, isoDate, addDays } from '../lib'
import { toneVar } from './ui'

export const WIDGET_META = {
  stats:            { title: 'Key stats',          icon: Users,          span: 3 },
  growth:           { title: 'Contact growth',     icon: TrendingUp,     span: 2 },
  taskCols:         { title: 'Tasks by column',    icon: BarChart3,      span: 1 },
  upcoming:         { title: 'Upcoming events',    icon: CalendarClock,  span: 1 },
  stayInTouch:      { title: 'Stay in touch',      icon: HeartHandshake, span: 1 },
  syncHealth:       { title: 'Sync health',        icon: RefreshCw,      span: 1 },
  birthdays:        { title: 'Upcoming birthdays', icon: Cake,           span: 1 },
  topTags:          { title: 'Top tags',           icon: Tag,            span: 1 },
  overdueCountdown: { title: 'Overdue countdown',  icon: Timer,          span: 1 },
  taskHeatmap:      { title: 'Task heatmap',       icon: Flame,          span: 2 },
  activityFeed:     { title: 'Recent activity',    icon: Activity,       span: 2 },
}

const Head = ({ title, to, linkLabel = 'Open' }) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="font-bold text-[14.5px]">{title}</h3>
    {to && <Link to={to} className="text-[12px] font-semibold inline-flex items-center gap-1" style={{ color: 'var(--t-sky)' }}>{linkLabel} <ArrowRight size={12} /></Link>}
  </div>
)

function StatsRow() {
  const { contacts, tasks, events, followUpStatus } = useCrm()
  const today = todayISO()
  const dueThisWeek = tasks.filter(t => t.column !== 'done' && t.due && daysUntil(t.due) <= 7).length
  const overdue = contacts.filter(c => followUpStatus(c).state === 'overdue').length
  const thisMonth = contacts.filter(c => c.birthday && +c.birthday.slice(5, 7) === new Date().getMonth() + 1).length
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Stat icon={Users} label="Contacts" value={contacts.length} delta="in your network" tone="#818cf8" />
      <Stat icon={CheckSquare} label="Tasks due ≤ 7d" value={dueThisWeek} delta={`${tasks.filter(t => t.column === 'done').length} done`} tone="#38bdf8" />
      <Stat icon={CalendarClock} label="Upcoming events" value={events.filter(e => e.date >= today).length} delta={`${thisMonth} 🎂 this month`} tone="#a78bfa" />
      <Stat icon={HeartHandshake} label="Overdue follow-ups" value={overdue} delta="relationship rules" tone="#fb7185" />
    </div>
  )
}

function Growth() {
  const { contacts } = useCrm()
  const growth = useMemo(() => {
    const now = new Date()
    const buckets = new Array(12).fill(0)
    contacts.forEach(c => {
      const d = parseISO(c.createdAt)
      const mAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
      if (mAgo >= 0 && mAgo < 12) buckets[11 - mAgo]++
    })
    return buckets
  }, [contacts])
  return (
    <Card className="p-5">
      <Head title="Contact growth" linkLabel="last 12 months" />
      <Sparkline data={growth} height={120} />
      <div className="flex justify-between text-[10px] font-semibold mt-1" style={{ color: 'var(--faint)' }}>
        {Array.from({ length: 12 }, (_, i) => <span key={i}>{MONTHS_S[(new Date().getMonth() - 11 + i + 24) % 12]}</span>)}
      </div>
    </Card>
  )
}

function TaskCols() {
  const { tasks } = useCrm()
  const cols = [['todo', 'To do', '#94a3b8'], ['progress', 'In progress', '#38bdf8'], ['waiting', 'Waiting', '#fbbf24'], ['done', 'Done', '#34d399']]
  return (
    <Card className="p-5">
      <Head title="Tasks by column" to="/tasks" />
      <MiniBars items={cols.map(([k, label, color]) => ({ label, value: tasks.filter(t => t.column === k).length, color }))} />
    </Card>
  )
}

function Upcoming() {
  const { events, contactById } = useCrm()
  const today = todayISO()
  const upcoming = events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).slice(0, 5)
  return (
    <Card className="p-5">
      <Head title="Upcoming events" to="/calendar" linkLabel="Calendar" />
      {upcoming.length === 0 && <Empty icon={CalendarClock} title="Nothing scheduled" />}
      {upcoming.map(e => {
        const contact = e.contactId && contactById[e.contactId]
        return (
          <div key={e.id} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: 'var(--hairline)' }}>
            <span className="dot" style={{ background: EVENT_COLORS[e.type] || '#94a3b8' }} />
            <span className="font-mono text-[11.5px] w-[74px] flex-none" style={{ color: 'var(--muted)' }}>{e.date.slice(5)} · {e.time}</span>
            <span className="text-[13px] font-medium truncate flex-1">{e.title}</span>
            {contact && <Avatar name={contact.name} photo={contact.photo} size={22} />}
          </div>
        )
      })}
    </Card>
  )
}

function StayInTouch() {
  const { contacts, followUpStatus } = useCrm()
  const navigate = useNavigate()
  const overdue = contacts.map(c => ({ c, s: followUpStatus(c) })).filter(x => x.s.state === 'overdue')
    .sort((a, b) => b.s.overdueBy - a.s.overdueBy).slice(0, 3)
  const bdays = contacts.filter(c => c.birthday && +c.birthday.slice(5, 7) === new Date().getMonth() + 1).length
  return (
    <Card className="p-5">
      <Head title="Stay in touch" to="/follow-ups" linkLabel="All follow-ups" />
      {overdue.length === 0 && <Empty icon={HeartHandshake} title="All caught up ✨" />}
      <div className="flex flex-col gap-2">
        {overdue.map(({ c, s }) => (
          <button key={c.id} onClick={() => navigate('/follow-ups')} className="card hoverable p-3 flex items-center gap-3 text-left w-full">
            <Avatar name={c.name} photo={c.photo} size={34} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold truncate">{c.name}</div>
              <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{s.since}d since contact</div>
            </div>
            <Pill color="#fb7185">+{s.overdueBy}d</Pill>
          </button>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t flex items-center gap-2 text-[11.5px]" style={{ borderColor: 'var(--hairline)', color: 'var(--faint)' }}>
        <Cake size={13} /> {bdays} birthday{bdays === 1 ? '' : 's'} this month
      </div>
    </Card>
  )
}

function SyncHealth() {
  const { rules, gcal, runRuleNow } = useCrm()
  return (
    <Card className="p-5">
      <Head title="Sync health" to="/settings" linkLabel="Configure" />
      <div className="flex items-center gap-2 mb-3 text-[12.5px] font-semibold" style={{ color: gcal.connected ? 'var(--t-green)' : 'var(--t-amber)' }}>
        <span className="dot" style={{ background: gcal.connected ? '#34d399' : '#fbbf24' }} />
        {gcal.connected ? `Google Calendar · synced ${tsRel(gcal.lastSync)}` : 'Google Calendar · not connected'}
      </div>
      {rules.map(r => (
        <div key={r.id} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: 'var(--hairline)' }}>
          <span className="dot" style={{ background: r.enabled ? '#34d399' : '#6b7382' }} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold truncate">{r.name}</div>
            <div className="text-[11px]" style={{ color: 'var(--faint)' }}>{r.frequency} · {r.lastRun ? `ran ${tsRel(r.lastRun)}` : 'never run'}</div>
          </div>
          <button className="icon-btn" style={{ width: 26, height: 26 }} title="Run now" onClick={() => runRuleNow(r.id)}><RefreshCw size={12} /></button>
        </div>
      ))}
    </Card>
  )
}

function Birthdays() {
  const { contacts } = useCrm()
  const year = new Date().getFullYear()
  const list = contacts.filter(c => c.birthday).map(c => {
    let occ = `${year}-${c.birthday.slice(5)}`
    if (occ < todayISO()) occ = `${year + 1}-${c.birthday.slice(5)}`
    return { c, occ, d: daysUntil(occ), turning: +occ.slice(0, 4) - +c.birthday.slice(0, 4) }
  }).sort((a, b) => a.d - b.d).slice(0, 5)
  return (
    <Card className="p-5">
      <Head title="Upcoming birthdays" to="/calendar" linkLabel="Calendar" />
      {list.length === 0 && <Empty icon={Cake} title="No birthdays on file" />}
      {list.map(({ c, occ, d, turning }) => (
        <div key={c.id} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: 'var(--hairline)' }}>
          <Avatar name={c.name} photo={c.photo} size={30} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold truncate">{c.name}</div>
            <div className="text-[11px]" style={{ color: 'var(--faint)' }}>{MONTHS_S[+occ.slice(5, 7) - 1]} {+occ.slice(8)} · turns {turning}</div>
          </div>
          <Pill color={d === 0 ? '#fb7185' : d <= 7 ? '#fbbf24' : '#94a3b8'}>{d === 0 ? 'Today!' : `${d}d`}</Pill>
        </div>
      ))}
    </Card>
  )
}

function TopTags() {
  const { contacts, tags } = useCrm()
  const navigate = useNavigate()
  const top = tags.map(t => ({ t, n: contacts.filter(c => c.tags.includes(t.id)).length }))
    .sort((a, b) => b.n - a.n).slice(0, 6)
  const max = Math.max(1, ...top.map(x => x.n))
  return (
    <Card className="p-5">
      <Head title="Top tags" to="/tags" linkLabel="Manage" />
      {top.map(({ t, n }) => (
        <button key={t.id} onClick={() => navigate(`/tags?tag=${t.id}`)} className="w-full flex items-center gap-2.5 py-1.5 text-left group">
          <span className="text-[13px] w-4 text-center flex-none">{t.icon}</span>
          <span className="text-[12.5px] font-medium w-24 truncate flex-none ">{t.name}</span>
          <span className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--chipbg)' }}>
            <span className="block h-full rounded-full transition-all" style={{ width: `${(n / max) * 100}%`, background: t.color }} />
          </span>
          <span className="text-[11px] font-bold w-6 text-right flex-none" style={{ color: toneVar(t.color) }}>{n}</span>
        </button>
      ))}
    </Card>
  )
}

function OverdueCountdown() {
  const { tasks } = useCrm()
  const today = todayISO()
  const overdue = tasks.filter(t => t.column !== 'done' && t.due && t.due < today)
    .sort((a, b) => a.due.localeCompare(b.due))
  const dueToday = tasks.filter(t => t.column !== 'done' && t.due === today).length
  const oldest = overdue[0]
  return (
    <Card className="p-5">
      <Head title="Overdue countdown" to="/tasks" linkLabel="Open tasks" />
      <div className="flex items-end gap-3 mb-3">
        <div className="text-[42px] font-extrabold leading-none tracking-tight" style={{ color: overdue.length ? 'var(--t-rose)' : 'var(--t-green)' }}>
          {overdue.length}
        </div>
        <div className="text-[11.5px] pb-1.5" style={{ color: 'var(--muted)' }}>
          overdue task{overdue.length === 1 ? '' : 's'}<br />{dueToday} due today
        </div>
      </div>
      {oldest ? (
        <div className="card p-3">
          <div className="text-[10.5px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--faint)' }}>Oldest offender</div>
          <div className="text-[12.5px] font-semibold leading-snug">{oldest.title}</div>
          <div className="text-[11.5px] mt-1 font-semibold" style={{ color: 'var(--t-rose)' }}>{daysUntil(oldest.due) * -1}d past due</div>
        </div>
      ) : <Empty icon={Timer} title="Zero overdue 🎉" />}
    </Card>
  )
}

function TaskHeatmap() {
  const { activity, audit } = useCrm()
  const { days, max } = useMemo(() => {
    const counts = {}
    const bump = ts => { const d = String(ts).slice(0, 10); counts[d] = (counts[d] || 0) + 1 }
    activity.forEach(a => /task/i.test(a.text) && bump(a.ts))
    audit.forEach(a => /task/i.test(a.action + ' ' + a.entity + ' ' + (a.detail || '')) && bump(a.ts))
    const today = new Date()
    const days = []
    for (let i = 83; i >= 0; i--) { const d = addDays(today, -i); days.push({ key: isoDate(d), n: counts[isoDate(d)] || 0, dow: d.getDay() }) }
    return { days, max: Math.max(1, ...days.map(x => x.n)) }
  }, [activity, audit])
  const shade = n => {
    if (n === 0) return 'var(--hairline)'
    const lvl = Math.min(4, Math.ceil((n / max) * 4))
    return ['var(--hairline)', '#818cf840', '#818cf878', '#818cf8b3', '#818cf8'][lvl]
  }
  const leadPad = days[0]?.dow || 0
  return (
    <Card className="p-5">
      <Head title="Task heatmap" linkLabel="last 12 weeks" />
      <div className="grid grid-rows-7 grid-flow-col gap-[3px]" style={{ justifyContent: 'space-between' }}>
        {Array.from({ length: leadPad }).map((_, i) => <span key={`p${i}`} />)}
        {days.map(d => (
          <span key={d.key} title={`${d.key} — ${d.n} task action${d.n === 1 ? '' : 's'}`}
            className="rounded-[3px] transition-transform hover:scale-125"
            style={{ width: 12, height: 12, background: shade(d.n) }} />
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-[10px] font-semibold" style={{ color: 'var(--faint)' }}>
        Less
        {[0, 1, 2, 3, 4].map(l => <span key={l} className="rounded-[3px]" style={{ width: 10, height: 10, background: ['var(--hairline)', '#818cf840', '#818cf878', '#818cf8b3', '#818cf8'][l] }} />)}
        More · {days.reduce((s, d) => s + d.n, 0)} task actions in 12 weeks
      </div>
    </Card>
  )
}

function ActivityFeed() {
  const { activity } = useCrm()
  return (
    <Card className="p-5">
      <Head title="Recent activity" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        {activity.slice(0, 8).map(a => (
          <div key={a.id} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: 'var(--hairline)' }}>
            <Clock size={13} className="flex-none" style={{ color: 'var(--faint)' }} />
            <span className="text-[13px] truncate flex-1">{a.text}</span>
            <span className="text-[11px] flex-none" style={{ color: 'var(--faint)' }}>{tsRel(a.ts)}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export const WIDGET_COMPONENTS = {
  stats: StatsRow, growth: Growth, taskCols: TaskCols, upcoming: Upcoming,
  stayInTouch: StayInTouch, syncHealth: SyncHealth, birthdays: Birthdays,
  topTags: TopTags, overdueCountdown: OverdueCountdown, taskHeatmap: TaskHeatmap,
  activityFeed: ActivityFeed,
}
