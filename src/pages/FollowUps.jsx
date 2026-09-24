import { useMemo, useState } from 'react'
import { HeartHandshake, CheckCircle2, BellOff, PlusSquare, Flame, Sparkles, RotateCcw } from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Card, Stat, Avatar, Pill, Empty, CsvButton } from '../components/ui'
import { relDay } from '../lib'

const ST_TONE = { overdue: '#fb7185', 'due-soon': '#fbbf24', ok: '#34d399', snoozed: '#94a3b8' }
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'due-soon', label: 'Due soon' },
  { id: 'snoozed', label: 'Snoozed' },
  { id: 'ok', label: 'In touch' },
]

export default function FollowUps() {
  const { contacts, relFreq, followUpStatus, markContacted, createFollowUpTask, snoozeFollowUp, unsnooze, updateFrequency } = useCrm()
  const [filter, setFilter] = useState('all')

  const rows = useMemo(() => {
    const xs = contacts.map(c => ({ c, s: followUpStatus(c) }))
    const rank = { overdue: 0, 'due-soon': 1, snoozed: 2, ok: 3 }
    xs.sort((a, b) => rank[a.s.state] - rank[b.s.state] || (b.s.overdueBy || 0) - (a.s.overdueBy || 0))
    return filter === 'all' ? xs : xs.filter(x => x.s.state === filter)
  }, [contacts, followUpStatus, filter])

  const by = st => contacts.filter(c => followUpStatus(c).state === st).length
  const loggedToday = contacts.filter(c => relDay(c.lastContact) === 'Today').length

  return (
    <div className="max-w-[1100px] mx-auto">
      <SectionHead kicker="Roadmap #3" title="Follow-Up Tracker"
        sub="“It’s been a while…” — relationship frequency rules flag who needs a nudge. One click logs a contact or spawns a task."
        right={<CsvButton filename="follow-ups.csv" rows={contacts} headers={[
          { label: 'Name', get: r => r.name },
          { label: 'Relationship', get: r => relFreq[r.rel]?.label || r.rel },
          { label: 'Cadence (days)', get: r => followUpStatus(r).every },
          { label: 'Last contact', get: r => r.lastContact },
          { label: 'Days since contact', get: r => followUpStatus(r).since },
          { label: 'Status', get: r => followUpStatus(r).state },
          { label: 'Snoozed until', get: r => followUpStatus(r).until || '' },
        ]} />} />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat icon={Flame} label="Overdue" value={by('overdue')} tone="#fb7185" />
        <Stat icon={HeartHandshake} label="Due soon (3d)" value={by('due-soon')} tone="#fbbf24" />
        <Stat icon={CheckCircle2} label="Contacted today" value={loggedToday} tone="#34d399" />
        <Stat icon={BellOff} label="Snoozed" value={by('snoozed')} tone="#94a3b8" />
      </div>

      <Card className="p-5 mb-4">
        <h3 className="font-bold text-[14.5px] mb-1">Relationship frequency rules</h3>
        <p className="text-[12.5px] mb-4" style={{ color: 'var(--muted)' }}>How often should you hear from each kind of person? Editing a number re-evaluates everyone instantly.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(relFreq).map(([key, r]) => {
            const count = contacts.filter(c => c.rel === key).length
            return (
              <div key={key} className="card p-3 text-center">
                <div className="text-[12px] font-bold truncate">{r.label}</div>
                <div className="flex items-center justify-center gap-1.5 my-2">
                  <span className="text-[11px]" style={{ color: 'var(--faint)' }}>every</span>
                  <input className="input text-center font-bold" style={{ width: 58, padding: '4px 6px' }} type="number" min={1}
                    defaultValue={r.everyDays} key={r.everyDays}
                    onBlur={e => +e.target.value !== r.everyDays && e.target.value && updateFrequency(key, +e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.target.blur()} />
                  <span className="text-[11px]" style={{ color: 'var(--faint)' }}>days</span>
                </div>
                <span className="chip">{count} contact{count === 1 ? '' : 's'}</span>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.id} className={`chip chip-btn ${filter === f.id ? 'on' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label}{f.id !== 'all' && ` · ${by(f.id)}`}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {rows.map(({ c, s }) => {
          const rel = relFreq[c.rel]
          return (
            <Card key={c.id} className="p-3.5 flex items-center gap-3 flex-wrap">
              <Avatar name={c.name} size={40} />
              <div className="min-w-0 flex-1 basis-52">
                <div className="font-semibold text-[14px] truncate">{c.name}</div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {rel && <Pill color="#a78bfa">{rel.label} · every {rel.everyDays}d</Pill>}
                  <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>last contact {relDay(c.lastContact).toLowerCase()}</span>
                </div>
              </div>
              <div className="basis-40">
                {s.state === 'overdue' && <Pill color={ST_TONE.overdue}>+{s.overdueBy}d overdue</Pill>}
                {s.state === 'due-soon' && <Pill color={ST_TONE['due-soon']}>due in {s.dueIn}d</Pill>}
                {s.state === 'ok' && <Pill color={ST_TONE.ok}><Sparkles size={11} /> in touch</Pill>}
                {s.state === 'snoozed' && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Pill color={ST_TONE.snoozed}>snoozed until {s.until.slice(5)}</Pill>
                    <button className="btn btn-ghost btn-sm" onClick={() => unsnooze(c.id)}><RotateCcw size={11} /> Unsnooze</button>
                  </div>
                )}
              </div>
              {s.state === 'overdue' && (
                <div className="text-[12px] italic basis-full lg:basis-auto lg:flex-1" style={{ color: 'var(--muted)' }}>
                  “It’s been {s.since} days since you reached out — time to reconnect?”
                </div>
              )}
              <div className="flex gap-2 ml-auto">
                <button className="btn btn-primary btn-sm" onClick={() => markContacted(c.id)}><CheckCircle2 size={13} /> Log contact</button>
                <button className="btn btn-ghost btn-sm" onClick={() => createFollowUpTask(c.id)}><PlusSquare size={13} /> Task</button>
                {s.state !== 'snoozed' && <button className="btn btn-ghost btn-sm" onClick={() => snoozeFollowUp(c.id, 7)}><BellOff size={13} /> 7d</button>}
              </div>
            </Card>
          )
        })}
        {rows.length === 0 && <Card><Empty icon={HeartHandshake} title="All caught up 🎉"
          steps={contacts.length === 0 ? [
            'Add a few contacts first — follow-ups only appear for people you track.',
            'On each contact, set a relationship cadence (weekly, monthly…).',
            'Come back here when someone is due; one tap logs the touch.',
          ] : [
            'Nobody is overdue on the cadence you set. That is the point.',
            'Switch the filter above if you want to peek at upcoming or snoozed.',
            'A touch from the contact page resets their clock automatically.',
          ]}
          guide="rhythm.followups">
          {contacts.length === 0
            ? 'Follow-ups keep relationships from going quiet. They need contacts to watch.'
            : 'Switch the filter, or enjoy the calm.'}
        </Empty></Card>}
      </div>
    </div>
  )
}
