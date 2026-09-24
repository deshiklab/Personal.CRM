import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift, Cake, Heart, Bell, Check, Sparkles, PlusSquare } from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Card, Stat, Avatar, Pill, Empty, CsvButton } from '../components/ui'
import { todayISO, daysUntil, MONTHS, MONTHS_S, cn } from '../lib'


export default function Birthdays() {
  const { contacts, tasks, addTask, updateContact, toast } = useCrm()
  const navigate = useNavigate()
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1)
  const [openId, setOpenId] = useState(null)

  /* ── auto-generate reminder tasks 7 days before birthdays ── */
  useEffect(() => {
    const today = todayISO(), year = new Date().getFullYear()
    let created = 0
    contacts.filter(c => c.birthday).forEach(c => {
      let occ = `${year}-${c.birthday.slice(5)}`
      if (occ < today) occ = `${year + 1}-${c.birthday.slice(5)}`
      const d = daysUntil(occ)
      if (d < 0 || d > 7) return
      const exists = tasks.some(t => t.contactId === c.id && t.title.startsWith('Wish ') && t.due === occ)
      if (!exists) {
        addTask({ title: `Wish ${c.name.split(' ')[0]} a happy birthday 🎂`, column: 'todo', priority: d <= 1 ? 'high' : 'med', due: occ, contactId: c.id })
        created++
      }
    })
    if (created) toast(`${created} birthday reminder${created > 1 ? 's' : ''} auto-added to your kanban`)
  }, [])

  const hasWishTask = (c, occ) => tasks.some(t => t.contactId === c.id && t.title.startsWith('Wish ') && t.due === occ)

  /* per-contact upcoming occurrence */
  const upcomingOf = (c, field) => {
    if (!c[field]) return null
    const year = new Date().getFullYear()
    let occ = `${year}-${c[field].slice(5)}`
    if (occ < todayISO()) occ = `${year + 1}-${c[field].slice(5)}`
    return { occ, d: daysUntil(occ) }
  }

  const monthOf = (c, field, m) => c[field] && +c[field].slice(5, 7) === m

  const curMonth = new Date().getMonth() + 1
  const monthBdays = contacts.filter(c => monthOf(c, 'birthday', curMonth)).length
  const monthAnni = contacts.filter(c => monthOf(c, 'anniversary', curMonth)).length
  const next7 = contacts.filter(c => { const u = upcomingOf(c, 'birthday'); return u && u.d <= 7 }).length
  const wishOpen = tasks.filter(t => t.title.startsWith('Wish ') && t.column !== 'done').length

  const monthCounts = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      m: i + 1,
      n: contacts.filter(c => monthOf(c, 'birthday', i + 1) || monthOf(c, 'anniversary', i + 1)).length,
    }))
  }, [contacts])

  /* month view entries (selected month) */
  const entries = useMemo(() => {
    const list = []
    contacts.forEach(c => {
      const year = new Date().getFullYear()
      if (monthOf(c, 'birthday', selMonth)) {
        const day = +c.birthday.slice(8)
        list.push({ key: `b-${c.id}`, type: 'birthday', c, day, since: year - +c.birthday.slice(0, 4), occ: selMonth === curMonth && day < new Date().getDate() ? `${year + 1}-${c.birthday.slice(5)}` : `${year}-${c.birthday.slice(5)}` })
      }
      if (monthOf(c, 'anniversary', selMonth)) {
        const day = +c.anniversary.slice(8)
        list.push({ key: `a-${c.id}`, type: 'anniversary', c, day, since: year - +c.anniversary.slice(0, 4), occ: selMonth === curMonth && day < new Date().getDate() ? `${year + 1}-${c.anniversary.slice(5)}` : `${year}-${c.anniversary.slice(5)}` })
      }
    })
    return list.sort((a, b) => a.day - b.day)
  }, [contacts, selMonth])

  const spotlight = useMemo(() => contacts
    .filter(c => { const u = upcomingOf(c, 'birthday'); return u && u.d <= 7 })
    .map(c => ({ c, ...upcomingOf(c, 'birthday') }))
    .sort((a, b) => a.d - b.d), [contacts, tasks])

  return (
    <div className="max-w-[1150px] mx-auto">
      <SectionHead kicker="Beyond the core · 7a" title="Birthdays & Occasions"
        sub="This month at a glance — reminders auto-fire 7 days out, gift ideas live on each card."
        right={<CsvButton filename="occasions.csv" rows={contacts.filter(c => c.birthday || c.anniversary)} headers={[
          { label: 'Contact', get: r => r.name },
          { label: 'Birthday', get: r => r.birthday || '' },
          { label: 'Next birthday', get: r => { if (!r.birthday) return ''; const y = new Date().getFullYear(); let d = `${y}-${r.birthday.slice(5)}`; if (daysUntil(d) < 0) d = `${y + 1}-${r.birthday.slice(5)}`; return d } },
          { label: 'Days until', get: r => { if (!r.birthday) return ''; const y = new Date().getFullYear(); let d = `${y}-${r.birthday.slice(5)}`; if (daysUntil(d) < 0) d = `${y + 1}-${r.birthday.slice(5)}`; return daysUntil(d) } },
          { label: 'Turning', get: r => { if (!r.birthday) return ''; const y = new Date().getFullYear(); let d = `${y}-${r.birthday.slice(5)}`; if (daysUntil(d) < 0) d = `${y + 1}-${r.birthday.slice(5)}`; return +d.slice(0, 4) - +r.birthday.slice(0, 4) } },
          { label: 'Anniversary', get: r => r.anniversary || '' },
          { label: 'Gift ideas', get: r => r.giftIdeas || '' },
        ]} />} />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat icon={Cake} label={`Birthdays in ${MONTHS_S[curMonth - 1]}`} value={monthBdays} tone="#f472b6" />
        <Stat icon={Heart} label={`Anniversaries in ${MONTHS_S[curMonth - 1]}`} value={monthAnni} tone="#fb7185" />
        <Stat icon={Bell} label="Next 7 days" value={next7} tone="#fbbf24" />
        <Stat icon={PlusSquare} label="Open wish tasks" value={wishOpen} tone="#34d399" />
      </div>

      {spotlight.length > 0 && (
        <>
          <div className="text-[11px] font-bold uppercase tracking-[.1em] mb-2" style={{ color: 'var(--faint)' }}>Coming right up</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
            {spotlight.map(({ c, occ, d }) => (
              <div key={c.id} className="card p-4 relative overflow-hidden"
                style={d === 0 ? { borderColor: 'rgba(244,114,182,.55)', boxShadow: '0 0 32px rgba(244,114,182,.15)' } : {}}>
                {d === 0 && <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(200px 90px at 85% -20%, rgba(244,114,182,.14), transparent 70%)' }} />}
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[14px] truncate">{c.name}</div>
                    <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
                      {MONTHS_S[+occ.slice(5, 7) - 1]} {+occ.slice(8)} · turns {new Date().getFullYear() - +c.birthday.slice(0, 4) + (occ.slice(0, 4) > `${new Date().getFullYear()}` ? 1 : 0)}
                    </div>
                  </div>
                  <Pill color={d === 0 ? '#f472b6' : d <= 2 ? '#fbbf24' : '#94a3b8'}>{d === 0 ? 'Today 🎉' : `${d}d`}</Pill>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {hasWishTask(c, occ)
                    ? <Pill color="#34d399"><Check size={11} /> Reminder on kanban</Pill>
                    : <button className="btn btn-primary btn-sm" onClick={() => { addTask({ title: `Wish ${c.name.split(' ')[0]} a happy birthday 🎂`, column: 'todo', priority: d <= 1 ? 'high' : 'med', due: occ, contactId: c.id }); toast('Reminder task created') }}><Bell size={12} /> Remind me</button>}
                  <button className="btn btn-ghost btn-sm ml-auto" onClick={() => navigate(`/contacts?open=${c.id}`)}>Profile</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* month strip */}
      <div className="flex items-center gap-1 mb-4 flex-wrap">
        {monthCounts.map(({ m, n }) => (
          <button key={m} onClick={() => setSelMonth(m)}
            className={cn('flex flex-col items-center rounded-xl px-3 py-2 transition-colors min-w-[56px]',
              selMonth === m ? 'bg-indigo-400/20 text-[color:var(--text)]' : 'hover:bg-[var(--hover)]')}
            style={m === curMonth && selMonth !== m ? { color: 'var(--t-sky)' } : selMonth !== m ? { color: 'var(--muted)' } : {}}>
            <span className="text-[10px] font-bold uppercase tracking-wider">{MONTHS_S[m - 1]}</span>
            <span className="text-[15px] font-extrabold">{n || '·'}</span>
          </button>
        ))}
      </div>

      <div className="text-[11px] font-bold uppercase tracking-[.1em] mb-2" style={{ color: 'var(--faint)' }}>
        {MONTHS[selMonth - 1]} — {entries.length} occasion{entries.length === 1 ? '' : 's'}
      </div>
      <div className="flex flex-col gap-2">
        {entries.length === 0 && <Card><Empty icon={Gift} title={`Nothing in ${MONTHS[selMonth - 1]}`}>Pick another month above.</Empty></Card>}
        {entries.map(e => {
          const open = openId === e.key
          const isBday = e.type === 'birthday'
          const d = daysUntil(e.occ)
          return (
            <Card key={e.key} className="overflow-hidden">
              <button className="w-full flex items-center gap-3 p-3.5 text-left flex-wrap" onClick={() => setOpenId(o => o === e.key ? null : e.key)}>
                <span className="w-10 h-10 rounded-xl grid place-items-center flex-none"
                  style={{ background: (isBday ? '#f472b6' : '#fb7185') + '1c', color: isBday ? '#f472b6' : '#fb7185' }}>
                  {isBday ? <Cake size={17} /> : <Heart size={17} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[13.5px]">{e.c.name}</span>
                    <Pill color={isBday ? '#f472b6' : '#fb7185'}>{isBday ? 'Birthday' : 'Anniversary'}</Pill>
                    {d === 0 && <Pill color="#fbbf24">Today!</Pill>}
                  </div>
                  <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
                    {MONTHS_S[selMonth - 1]} {e.day} · {isBday ? `turns ${e.since}` : `${e.since} year${e.since === 1 ? '' : 's'} together`}
                    {e.c.giftIdeas ? ' · 🎁 ideas on file' : ''}
                  </div>
                </div>
                {isBday && (hasWishTask(e.c, e.occ)
                  ? <Pill color="#34d399"><Check size={11} /> Reminded</Pill>
                  : d > 7
                    ? <Pill color="#94a3b8"><Bell size={11} /> auto {d - 7}d before</Pill>
                    : <Pill color="#fbbf24"><Bell size={11} /> remind now?</Pill>)}
                <span className="chip flex-none">{d >= 0 ? (d === 0 ? 'today' : `${d}d`) : '—'}</span>
              </button>

              {open && (
                <div className="border-t p-4 fadein" style={{ borderColor: 'var(--hairline)' }}>
                  <div className="label">🎁 Gift ideas for {e.c.name.split(' ')[0]} — autosaves</div>
                  <textarea className="input" rows={2} placeholder="e.g. books they've mentioned, sizes, wishlist links…"
                    defaultValue={e.c.giftIdeas || ''}
                    onBlur={ev => { if (ev.target.value !== (e.c.giftIdeas || '')) { updateContact(e.c.id, { giftIdeas: ev.target.value }); toast('Gift ideas saved') } }} />
                  <div className="flex gap-2 mt-3">
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/contacts?open=${e.c.id}`)}>Open profile</button>
                    {isBday && !hasWishTask(e.c, e.occ) && d <= 7 && (
                      <button className="btn btn-primary btn-sm" onClick={() => { addTask({ title: `Wish ${e.c.name.split(' ')[0]} a happy birthday 🎂`, column: 'todo', priority: 'med', due: e.occ, contactId: e.c.id }); toast('Reminder task created') }}>
                        <Bell size={12} /> Create remaining reminder
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <div className="card p-4 mt-5 flex items-center gap-3 text-[12px]" style={{ color: 'var(--muted)' }}>
        <Sparkles size={15} style={{ color: 'var(--t-amber)' }} className="flex-none" />
        The 7-day rule ran when you opened this page — any birthday within the next week that lacked a reminder got a kanban task automatically. Delete a task and “Reminded” resets.
      </div>
    </div>
  )
}
