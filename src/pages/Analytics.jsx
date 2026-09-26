import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, UserPlus, Activity as ActivityIcon, CheckCircle2, Clock3, PieChart as PieIcon,
  BarChart3, Flame, Lightbulb, AlertTriangle, Trophy, Cake, TrendingUp, CalendarDays,
  HeartHandshake, Gauge
} from 'lucide-react'
import { useCrm } from '../store'
import { contactGroupIds as crmGroupIds } from '../store'
import { Card, SectionHead, Stat, MiniBars, Avatar, CsvButton } from '../components/ui'
import { daysSince } from '../lib'
import { toneVar } from '../components/ui'

/* ── helpers ─────────────────────────────────────────────── */
const ym = iso => (iso || '').slice(0, 7)
const monthBuckets = n => {
  const now = new Date(); const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('en', { month: 'short' }) })
  }
  return out
}
const daysBetweenISO = (a, b) => Math.abs(daysSince(b) - daysSince(a))
const PALETTE = ['#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#22d3ee', '#fb7185', '#f97316', '#94a3b8']

function Donut({ slices, size = 190 }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1
  let acc = 25
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 42 42" style={{ width: size, height: size }} className="flex-none">
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--hairline)" strokeWidth="5.5" />
        {slices.map((s, i) => {
          const pct = (s.value / total) * 100
          const el = (
            <circle key={i} cx="21" cy="21" r="15.9155" fill="none" stroke={s.color} strokeWidth="5.5"
              strokeDasharray={`${Math.max(pct - 0.6, 0)} ${100 - Math.max(pct - 0.6, 0)}`} strokeDashoffset={-acc + 25}
              strokeLinecap="butt"><title>{s.label}: {s.value}</title></circle>
          )
          acc += pct
          return el
        })}
        <text x="21" y="20" textAnchor="middle" fill="var(--text)" fontSize="6.2" fontWeight="800">{total}</text>
        <text x="21" y="25.6" textAnchor="middle" fill="var(--faint)" fontSize="2.6" fontWeight="700">TAG USES</text>
      </svg>
      <div className="flex flex-col gap-1.5 min-w-0 flex-1 max-h-56 overflow-y-auto pr-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px]">
            <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: s.color }} />
            <span className="truncate font-semibold" style={{ color: 'var(--text)' }}>{s.icon} {s.label}</span>
            <span className="ml-auto flex-none" style={{ color: 'var(--muted)' }}>{s.value} · {Math.round(s.value / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HBars({ items, onClick }) {
  const max = Math.max(...items.map(i => i.value), 1)
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((it, i) => (
        <div key={i} className={`flex items-center gap-3 ${onClick ? 'cursor-pointer group' : ''}`} onClick={() => onClick?.(it)}>
          {it.avatar && <Avatar name={it.avatar} size={28} />}
          <span className="text-[12.5px] font-semibold w-32 truncate flex-none  transition-colors" style={{ color: 'var(--text)' }}>{it.label}</span>
          <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--chipbg)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(it.value / max) * 100}%`, background: `linear-gradient(90deg, ${it.color}, ${it.color}77)` }} />
          </div>
          <span className="text-[12px] font-bold w-8 text-right flex-none" style={{ color: toneVar(it.color) }}>{it.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════ */
export default function Analytics() {
  const { contacts, tasks, activity, activityVisible, audit, auditVisible, tags, groups, events, imports, followUpStatus, can, isPro, FREE_LIMITS, historyCutoffIso } = useCrm()
  const nav = useNavigate()
  const advanced = can?.('advanced_analytics')
  const [win, setWin] = useState(() => (typeof can === 'function' && can('advanced_analytics') ? 12 : 3))
  // free tier is locked to the 3-month window
  useEffect(() => { if (!advanced && win !== 3) setWin(3) }, [advanced, win])


  const actSrc = activityVisible || activity
  const auditSrc = auditVisible || audit
  const d = useMemo(() => {
    const buckets = monthBuckets(win)
    const bucketKeys = new Set(buckets.map(b => b.key))
    const inWindow = iso => bucketKeys.has(ym(iso))

    /* contacts added per month */
    const addedPerMonth = buckets.map(b => ({ ...b, n: contacts.filter(c => ym(c.createdAt) === b.key).length }))
    const addedTotal = addedPerMonth.reduce((s, b) => s + b.n, 0)

    /* touchpoints (activity) per month */
    const actPerMonth = buckets.map(b => ({ ...b, n: actSrc.filter(a => ym(a.ts) === b.key).length }))
    const actTotal = actPerMonth.reduce((s, b) => s + b.n, 0)

    /* task completion */
    const done = tasks.filter(t => t.column === 'done')
    const rate = tasks.length ? Math.round(done.length / tasks.length * 100) : 0
    const donePerMonth = buckets.map(b => ({
      ...b,
      n: actSrc.filter(a => ym(a.ts) === b.key && /^Task completed:/.test(a.text)).length
        + auditSrc.filter(a => ym(a.ts) === b.key && /complete|done/i.test(a.action || '')).length,
    }))

    /* average task turnaround: pair audit "Created task" with activity "Task completed: <title>" */
    const created = auditSrc.filter(a => a.action === 'Created task').map(a => ({ t: a.entity || '', ts: a.ts }))
    const completed = actSrc.filter(a => /^Task completed:/.test(a.text)).map(a => ({ t: a.text.replace(/^Task completed:\s*/, ''), ts: a.ts }))
    const gaps = []
    completed.forEach(c => {
      const src = created.find(x => x.t && c.t.trim().toLowerCase().includes(x.t.trim().toLowerCase().slice(0, 18)))
      if (src) gaps.push(daysBetweenISO(src.ts, c.ts))
    })
    let turnaround = null
    if (gaps.length) turnaround = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length * 10) / 10
    else {
      /* fallback: mean gap between contact-linked touchpoints */
      const perContact = {}
      actSrc.filter(a => a.contactId).forEach(a => (perContact[a.contactId] = perContact[a.contactId] || []).push(a.ts))
      const allGaps = Object.values(perContact).flatMap(list => {
        const s = list.slice().sort()
        return s.slice(1).map((t, i) => daysBetweenISO(s[i], t))
      })
      if (allGaps.length) turnaround = { fallback: true, v: Math.round(allGaps.reduce((s, g) => s + g, 0) / allGaps.length) }
    }

    /* most-contacted people */
    const touchCount = {}
    actSrc.forEach(a => {
      if (a.contactId) touchCount[a.contactId] = (touchCount[a.contactId] || 0) + 1
      const m = a.text.match(/Logged contact with (.+)$/)
      if (m) { const c = contacts.find(x => x.name === m[1]); if (c) touchCount[c.id] = (touchCount[c.id] || 0) + 1 }
    })
    const mostContacted = Object.entries(touchCount)
      .map(([id, n]) => ({ id, n, c: contacts.find(x => x.id === id) }))
      .filter(x => x.c).sort((a, b) => b.n - a.n).slice(0, 6)

    /* tag distribution */
    const tagUse = tags.map((t, i) => ({ label: t.name, icon: t.icon, value: contacts.filter(c => c.tags.includes(t.id)).length, color: t.color || PALETTE[i % PALETTE.length] }))
      .filter(t => t.value > 0).sort((a, b) => b.value - a.value)

    /* groups */
    const groupDist = groups.map(g => ({ label: g.name, value: contacts.filter(c => crmGroupIds(c).includes(g.id)).length, color: g.color }))

    /* day of week */
    const dow = [0, 0, 0, 0, 0, 0, 0]
    actSrc.forEach(a => dow[new Date(a.ts).getDay()]++)
    auditSrc.forEach(a => dow[new Date(a.ts).getDay()]++)
    const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const bestDow = dow.indexOf(Math.max(...dow))

    /* relationship health */
    const states = contacts.map(c => followUpStatus(c).state)
    const overdueN = states.filter(s => s === 'overdue').length
    const dueSoonN = states.filter(s => s === 'due-soon').length
    const onTrackPct = contacts.length ? Math.round((contacts.length - overdueN) / contacts.length * 100) : 100

    /* growth: this period vs previous equal period */
    const now = Date.now(); const winMs = win * 30.4 * 864e5
    const thisPer = contacts.filter(c => now - new Date(c.createdAt).getTime() < winMs).length
    const prevPer = contacts.filter(c => { const t = now - new Date(c.createdAt).getTime(); return t >= winMs && t < winMs * 2 }).length
    const growth = prevPer ? Math.round((thisPer - prevPer) / prevPer * 100) : (thisPer ? 100 : 0)

    /* busiest single day */
    const byDay = {}
    actSrc.forEach(a => { const k = a.ts.slice(0, 10); byDay[k] = (byDay[k] || 0) + 1 })
    const [busyDay, busyN] = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0] || [null, 0]

    /* cold VIPs + birthdays */
    const coldVips = contacts.filter(c => c.tags.includes('t_vip') && daysSince(c.lastContact) > 30)
    const thisMonth = new Date().getMonth() + 1
    const bdays = contacts.filter(c => c.birthday && +c.birthday.slice(5, 7) === thisMonth).length

    const stale = contacts.filter(c => daysSince(c.lastContact) > 90).length

    /* insights deck */
    const insights = [
      growth !== 0 && { icon: TrendingUp, tone: growth > 0 ? '#34d399' : '#fb7185', title: `${growth > 0 ? '+' : ''}${growth}% network growth`, body: `${thisPer} added this period vs ${prevPer} in the previous one.` },
      mostContacted[0] && { icon: Trophy, tone: '#fbbf24', title: `Most contacted: ${mostContacted[0].c.name.split(' ')[0]}`, body: `${mostContacted[0].n} logged touchpoints — your hottest relationship.` },
      { icon: Flame, tone: '#f97316', title: `${dowLabels[bestDow]} is your power day`, body: `Most touchpoints happen on ${dowLabels[bestDow]}s — schedule outreach then.` },
      rate < 45 ? { icon: AlertTriangle, tone: '#fb7185', title: `Only ${rate}% of tasks done`, body: `${tasks.filter(t => t.column !== 'done').length} open tasks are piling up — time for a sweep.` }
        : { icon: CheckCircle2, tone: '#34d399', title: `${rate}% task completion`, body: `Strong execution — ${done.length} of ${tasks.length} tasks closed.` },
      coldVips.length > 0 && { icon: AlertTriangle, tone: '#fb7185', title: `${coldVips.length} VIP${coldVips.length > 1 ? 's' : ''} going cold`, body: `${coldVips.map(c => c.name.split(' ')[0]).slice(0, 3).join(', ')} — no contact in 30+ days.` },
      bdays > 0 && { icon: Cake, tone: '#f472b6', title: `${bdays} birthday${bdays > 1 ? 's' : ''} this month`, body: `Don't miss them — check the Birthdays dashboard for gift ideas.` },
      busyDay && { icon: CalendarDays, tone: '#38bdf8', title: `Busiest day: ${busyDay}`, body: `${busyN} touchpoints logged — a personal record.` },
      stale > 0 && { icon: HeartHandshake, tone: '#a78bfa', title: `${stale} contacts idle 90+ days`, body: `Consider a re-engagement wave — snooze or prune low-value ones.` },
    ].filter(Boolean).slice(0, 4)

    return { addedPerMonth, addedTotal, actPerMonth, actTotal, done, rate, donePerMonth, turnaround, mostContacted, tagUse, groupDist, dow, dowLabels, overdueN, dueSoonN, onTrackPct, growth, thisPer, prevPer, insights, doneCount: done.length, eventsInWin: events.filter(e => inWindow(e.date)).length, importsTotal: imports.reduce((s, i) => s + (i.added || 0), 0) }
  }, [contacts, tasks, actSrc, auditSrc, tags, groups, events, imports, win]) // eslint-disable-line

  return (
    <div className="flex flex-col gap-5">
      <SectionHead kicker="YOUR CRM AT A GLANCE" title="Analytics & Insights"
        sub={`Rolling ${win}-month window across every contact, task and touchpoint`}
        right={
          <div className="flex gap-1.5 items-center">
            <CsvButton filename="analytics-summary.csv" rows={[
              { m: 'Network size', v: contacts.length }, { m: `Contacts added (${win}mo)`, v: d.addedTotal },
              { m: `Touchpoints (${win}mo)`, v: d.actTotal }, { m: 'Relationships on track', v: d.onTrackPct + '%' },
              { m: 'Task completion rate', v: d.rate + '%' }, { m: 'Overdue relationships', v: d.overdueN },
              { m: 'Growth vs previous period', v: (d.growth > 0 ? '+' : '') + d.growth + '%' },
              { m: 'Events in window', v: d.eventsInWin }, { m: 'Tags in use', v: d.tagUse.length },
            ]} headers={[{ label: 'Metric', get: r => r.m }, { label: 'Value', get: r => r.v }]} />
            {[3, 6, 12].map(n => {
              const locked = !advanced && n > 3
              return (
                <button key={n} type="button"
                  onClick={() => locked ? null : setWin(n)}
                  title={locked ? 'Pro unlocks 6M and 12M windows' : `${n}-month window`}
                  disabled={locked}
                  className={`chip chip-btn ${win === n ? 'on' : ''}`}
                  style={{ padding: '6px 13px', fontSize: 12, opacity: locked ? .45 : 1 }}>
                  {n}M{locked ? ' · Pro' : ''}
                </button>
              )
            })}
            {!advanced && (
              <a href="#/pro" className="chip chip-btn" style={{ padding: '6px 10px', fontSize: 11, textDecoration: 'none' }}>
                Longer windows on Pro
              </a>
            )}
          </div>
        } />

      {!advanced && (
        <div className="card p-3 mb-1 flex items-center gap-3 flex-wrap" data-testid="history-free-banner"
          style={{ borderColor: 'rgba(129,140,248,.35)' }}>
          <span className="text-[12.5px] flex-1" style={{ color: 'var(--muted)' }}>
            Free analytics uses the last {FREE_LIMITS?.historyDays || 90} days of activity · 3-month window.
            Pro unlocks 6M / 12M windows and full history.
          </span>
          <a href="#/pro" className="btn btn-ghost btn-sm">Unlock Pro</a>
        </div>
      )}

      {/* hero stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat icon={Users} tone="#818cf8" label="Network size" value={contacts.length}
          delta={`${d.growth > 0 ? '+' : ''}${d.growth}% vs prev.`} />
        <Stat icon={UserPlus} tone="#38bdf8" label={`Added · ${win}mo`} value={d.addedTotal}
          delta={`${d.prevPer} previous period`} />
        <Stat icon={ActivityIcon} tone="#34d399" label={`Touchpoints · ${win}mo`} value={d.actTotal}
          delta={`${d.eventsInWin} events scheduled`} />
        <Stat icon={HeartHandshake} tone="#f472b6" label="Relationships on track" value={`${d.onTrackPct}%`}
          delta={`${d.overdueN} overdue · ${d.dueSoonN} due soon`} />
      </div>

      {/* growth + execution */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={15} style={{ color: 'var(--t-sky)' }} />
            <h3 className="text-[14px] font-extrabold">Contacts added per month</h3>
          </div>
          <p className="text-[11.5px] mb-4" style={{ color: 'var(--faint)' }}>New records entering your CRM · {d.addedTotal} this period (+{d.importsTotal} via imports all-time)</p>
          <MiniBars height={150} items={d.addedPerMonth.map((b, i) => ({ label: b.label, value: b.n, color: i === d.addedPerMonth.length - 1 ? '#818cf8' : '#38bdf8' }))} />
        </Card>

        <Card className="p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Gauge size={15} style={{ color: 'var(--t-green)' }} />
            <h3 className="text-[14px] font-extrabold">Execution pulse</h3>
          </div>
          <p className="text-[11.5px] mb-4" style={{ color: 'var(--faint)' }}>Task completion rate & average turn-around</p>
          <div className="flex items-center gap-5">
            <div className="relative flex-none" style={{ width: 120, height: 120 }}>
              <svg viewBox="0 0 42 42" style={{ width: 120, height: 120 }}>
                <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--hairline)" strokeWidth="5" />
                <circle cx="21" cy="21" r="15.9155" fill="none" stroke={d.rate >= 60 ? '#34d399' : d.rate >= 40 ? '#fbbf24' : '#fb7185'}
                  strokeWidth="5" strokeLinecap="round" strokeDasharray={`${d.rate} ${100 - d.rate}`} strokeDashoffset="25" />
                <text x="21" y="23.5" textAnchor="middle" fill="var(--text)" fontSize="7" fontWeight="800">{d.rate}%</text>
              </svg>
            </div>
            <div className="flex flex-col gap-2 text-[12px]">
              <div className="font-semibold" style={{ color: 'var(--text)' }}>{d.doneCount} of {tasks.length} tasks done</div>
              <div style={{ color: 'var(--muted)' }}>{tasks.filter(t => t.column === 'todo').length} to-do · {tasks.filter(t => t.column === 'progress').length} in progress</div>
              <div className="chip mt-1" style={{ alignSelf: 'flex-start' }}>
                <Clock3 size={11} /> avg {d.turnaround == null ? '—' : d.turnaround?.fallback ? `${d.turnaround.v}d between touches` : `${d.turnaround}d turnaround`}
              </div>
            </div>
          </div>
          <div className="mt-auto pt-4">
            <MiniBars height={86} items={d.donePerMonth.map(b => ({ label: b.label, value: b.n, color: 'var(--t-green)' }))} />
            <div className="text-[10.5px] text-center mt-1" style={{ color: 'var(--faint)' }}>completions logged per month</div>
          </div>
        </Card>
      </div>

      {/* people + tags */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={15} style={{ color: 'var(--t-amber)' }} />
            <h3 className="text-[14px] font-extrabold">Most-contacted people</h3>
          </div>
          <p className="text-[11.5px] mb-4" style={{ color: 'var(--faint)' }}>Ranked by logged touchpoints · click a row to open their sheet</p>
          {d.mostContacted.length ? (
            <HBars onClick={it => nav('/contacts')} items={d.mostContacted.map((x, i) => ({
              label: x.c.name, avatar: x.c.name, value: x.n, color: PALETTE[i % PALETTE.length],
            }))} />
          ) : <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>Log a few interactions and this board comes alive.</p>}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <PieIcon size={15} style={{ color: 'var(--t-violet)' }} />
            <h3 className="text-[14px] font-extrabold">Tag distribution</h3>
          </div>
          <p className="text-[11.5px] mb-4" style={{ color: 'var(--faint)' }}>How your network is labelled across {tags.length} tags</p>
          <Donut slices={d.tagUse} />
        </Card>
      </div>

      {/* rhythm + shape of the network */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Flame size={15} style={{ color: '#f97316' }} />
            <h3 className="text-[14px] font-extrabold">Weekly rhythm</h3>
          </div>
          <MiniBars height={110} items={d.dow.map((n, i) => ({ label: d.dowLabels[i], value: n, color: i === d.dow.indexOf(Math.max(...d.dow)) ? '#f97316' : '#94a3b8' }))} />
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={15} style={{ color: 'var(--t-green)' }} />
            <h3 className="text-[14px] font-extrabold">Network composition</h3>
          </div>
          <HBars items={d.groupDist} />
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <ActivityIcon size={15} style={{ color: 'var(--t-sky)' }} />
            <h3 className="text-[14px] font-extrabold">Touchpoints per month</h3>
          </div>
          <MiniBars height={110} items={d.actPerMonth.map(b => ({ label: b.label, value: b.n, color: 'var(--t-sky)' }))} />
        </Card>
      </div>

      {/* insight deck */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb size={15} style={{ color: 'var(--t-amber)' }} />
          <h3 className="text-[14px] font-extrabold">Auto-generated insights</h3>
          <span className="text-[10.5px] font-semibold" style={{ color: 'var(--faint)' }}>computed live from your data — no AI in the loop</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {d.insights.map((x, i) => (
            <Card key={i} className="p-4 hoverable">
              <div className="w-9 h-9 rounded-xl grid place-items-center mb-3" style={{ background: x.tone + '1c', color: x.tone }}>
                <x.icon size={17} />
              </div>
              <div className="text-[13.5px] font-extrabold tracking-tight">{x.title}</div>
              <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>{x.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
