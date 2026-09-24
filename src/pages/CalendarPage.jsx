import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CalendarPlus, Cake, Clock, Trash2, Link2, FileDown, ExternalLink } from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Seg, Modal, Field, Avatar, Pill, EVENT_COLORS, Empty, CsvButton, toneVar } from '../components/ui'
import { downloadICS, gcalTemplateUrl } from '../lib/ics'
import { cn, isoDate, todayISO, monthMatrix, MONTHS, WEEKDAYS_S, addDays } from '../lib'

const TYPE_LABEL = { meeting: 'Meeting', call: 'Call', 'follow-up': 'Follow-up', personal: 'Personal' }

export default function CalendarPage() {
  const { events, gcal, moveEvent, contactById } = useCrm()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [newDate, setNewDate] = useState(null)   // open create modal on this date
  const [detail, setDetail] = useState(null)     // event object
  const [dragId, setDragId] = useState(null)
  const [overCell, setOverCell] = useState(null)

  useEffect(() => {
    let dirty = false
    if (params.get('new') === '1') { setNewDate(todayISO()); params.delete('new'); dirty = true }
    const ev = params.get('event')
    if (ev) { const found = events.find(e => e.id === ev); if (found) setDetail(found); params.delete('event'); dirty = true }
    if (dirty) setParams(params, { replace: true })
  }, [events, params])

  const step = dir => {
    const d = new Date(cursor)
    if (view === 'month') d.setMonth(d.getMonth() + dir)
    else if (view === 'week') d.setDate(d.getDate() + 7 * dir)
    else d.setDate(d.getDate() + dir)
    setCursor(d)
  }
  const goToday = () => { const d = new Date(); if (view === 'month') d.setDate(1); setCursor(d) }

  const byDate = useMemo(() => {
    const m = {}
    events.forEach(e => { (m[e.date] = m[e.date] || []).push(e) })
    Object.values(m).forEach(list => list.sort((a, b) => a.time.localeCompare(b.time)))
    return m
  }, [events, params])

  const title = view === 'month'
    ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
    : view === 'week'
      ? (() => { const s = addDays(cursor, -cursor.getDay()); const e = addDays(s, 6); return `${s.getDate()} ${MONTHS[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${MONTHS[e.getMonth()].slice(0, 3)} ${e.getFullYear()}` })()
      : `${cursor.getDate()} ${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`

  const dropHandlers = iso => ({
    onDragOver: e => { e.preventDefault(); setOverCell(iso) },
    onDragLeave: () => setOverCell(c => c === iso ? null : c),
    onDrop: e => {
      e.preventDefault()
      const id = e.dataTransfer.getData('text/event')
      if (id) moveEvent(id, iso)
      setDragId(null); setOverCell(null)
    },
  })

  return (
    <div className="max-w-[1280px] mx-auto">
      <SectionHead kicker="Roadmap #7" title="Calendar"
        sub="Drag events between days to reschedule. Contact birthdays appear automatically."
        right={
          <>
            <CsvButton filename="events.csv" rows={events} headers={[
              { label: 'Title', get: r => r.title }, { label: 'Date', get: r => r.date },
              { label: 'Start', get: r => r.time }, { label: 'End', get: r => r.endTime },
              { label: 'Type', get: r => r.type },
              { label: 'Contact', get: r => contactById[r.contactId]?.name || '' },
              { label: 'Source', get: r => r.gcal }, { label: 'Location', get: r => r.location || '' },
            ]} />
            <button className="btn btn-ghost btn-sm" title="Download every event as a standard .ics — imports into Apple Calendar, Outlook and Google"
              onClick={() => downloadICS(events, contactById)}>
              <FileDown size={13} /> .ics
            </button>
            <SyncChip gcal={gcal} />
            <button className="btn btn-primary btn-sm" onClick={() => setNewDate(todayISO())}><CalendarPlus size={14} /> New event</button>
          </>
        } />

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Seg value={view} onChange={setView} options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'day', label: 'Day' }]} />
        <div className="flex items-center gap-1.5">
          <button className="icon-btn" onClick={() => step(-1)}><ChevronLeft size={16} /></button>
          <button className="btn btn-ghost btn-sm" onClick={goToday}>Today</button>
          <button className="icon-btn" onClick={() => step(1)}><ChevronRight size={16} /></button>
        </div>
        <h3 className="text-[16px] font-bold tracking-tight">{title}</h3>
        <div className="ml-auto hidden md:flex items-center gap-3 text-[11px] font-semibold" style={{ color: 'var(--faint)' }}>
          {Object.entries(TYPE_LABEL).map(([k, l]) => (
            <span key={k} className="inline-flex items-center gap-1.5"><span className="dot" style={{ background: EVENT_COLORS[k] }} />{l}</span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className="dot" style={{ background: EVENT_COLORS.birthday }} />Birthday</span>
        </div>
      </div>

      {view === 'month' && (
        <MonthView cursor={cursor} byDate={byDate} setNewDate={setNewDate} setDetail={setDetail}
          dragId={dragId} setDragId={setDragId} overCell={overCell} dropHandlers={dropHandlers} />
      )}
      {view === 'week' && (
        <WeekView cursor={cursor} byDate={byDate} setNewDate={setNewDate} setDetail={setDetail}
          dragId={dragId} setDragId={setDragId} overCell={overCell} dropHandlers={dropHandlers} />
      )}
      {view === 'day' && <DayView cursor={cursor} byDate={byDate} setNewDate={setNewDate} setDetail={setDetail} />}

      <EventModal iso={newDate} onClose={() => setNewDate(null)} />
      <EventDetail ev={detail} onClose={() => setDetail(null)} />
    </div>
  )
}

function SyncChip({ gcal }) {
  const navigate = useNavigate()
  return (
    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/settings')} title="Open sync settings">
      <span className="dot" style={{ background: gcal.connected ? '#34d399' : '#fbbf24' }} />
      {gcal.connected ? 'Google · Synced' : 'Google · Not connected'}
    </button>
  )
}

function BirthdayChip({ name, small }) {
  return (
    <div className={cn('flex items-center gap-1 rounded-md px-1.5 truncate font-semibold',
      small ? 'text-[10px] py-[1px]' : 'text-[11px] py-[2px]')}
      style={{ background: '#f472b61c', color: 'var(--t-pink)', border: '1px solid #f472b638' }}>
      <Cake size={small ? 9 : 10} className="flex-none" /> {name.split(' ')[0]}
    </div>
  )
}

function EventChip({ e, small, dragId, setDragId, onOpen }) {
  const { contactById } = useCrm()
  const contact = e.contactId && contactById[e.contactId]
  const color = EVENT_COLORS[e.type] || '#94a3b8'
  return (
    <button draggable
      onClick={ev => { ev.stopPropagation(); onOpen(e) }}
      onDragStart={ev => { ev.stopPropagation(); ev.dataTransfer.setData('text/event', e.id); ev.dataTransfer.effectAllowed = 'move'; setDragId(e.id) }}
      onDragEnd={() => setDragId(null)}
      className={cn('w-full flex items-center gap-1.5 rounded-md px-1.5 text-left truncate font-semibold cursor-grab active:cursor-grabbing',
      small ? 'text-[10px] py-[1px]' : 'text-[11px] py-[2px]', dragId === e.id && 'dragging')}
      style={{ background: color + '1c', color: toneVar(color), border: `1px solid ${color}38` }}>
      <span className="font-mono flex-none">{e.time}</span>
      <span className="truncate flex-1">{e.title}</span>
      {e.gcal === 'synced' && <Link2 size={9} className="flex-none opacity-70" />}
      {contact && !small && <Avatar name={contact.name} photo={contact.photo} size={13} />}
    </button>
  )
}

function useBirthdays() {
  const { contacts } = useCrm()
  return iso => contacts.filter(c => c.birthday && c.birthday.slice(5) === iso.slice(5))
}

function MonthView({ cursor, byDate, setNewDate, setDetail, dragId, setDragId, overCell, dropHandlers }) {
  const weeks = useMemo(() => monthMatrix(cursor.getFullYear(), cursor.getMonth()), [cursor])
  const birthdaysAt = useBirthdays()
  const today = todayISO()
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--border)' }}>
        {WEEKDAYS_S.map(d => <div key={d} className="text-center py-2 text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--faint)' }}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((d, i) => {
          const iso = isoDate(d)
          const outside = d.getMonth() !== cursor.getMonth()
          const list = byDate[iso] || []
          const bdays = birthdaysAt(iso)
          const chips = [...bdays.map(c => ({ bday: c })), ...list]
          const shown = chips.slice(0, 3)
          return (
            <div key={i}
              className={cn('min-h-[104px] p-1.5 cursor-pointer transition-colors', overCell === iso && 'dragover')}
              style={{ borderRight: (i + 1) % 7 ? '1px solid var(--hairline)' : 'none', borderBottom: '1px solid var(--hairline)', background: outside ? 'var(--chipbg)' : 'transparent' }}
              onClick={() => setNewDate(iso)}
              {...dropHandlers(iso)}>
              <div className={cn('w-6 h-6 grid place-items-center rounded-full text-[11.5px] font-bold mb-1',
                iso === today ? 'text-[#0a0c11]' : '')}
                style={iso === today
                  ? { background: 'linear-gradient(120deg,#818cf8,#38bdf8)' }
                  : { color: outside ? 'var(--faint)' : 'var(--muted)' }}>
                {d.getDate()}
              </div>
              <div className="flex flex-col gap-[3px]">
                {shown.map((ch, j) => ch.bday
                  ? <BirthdayChip key={`b${ch.bday.id}`} name={ch.bday.name} small />
                  : <EventChip key={ch.id} e={ch} small dragId={dragId} setDragId={setDragId} onOpen={setDetail} />)}
                {chips.length > 3 && <span className="text-[10px] font-semibold px-1" style={{ color: 'var(--faint)' }}>+{chips.length - 3} more</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({ cursor, byDate, setNewDate, setDetail, dragId, setDragId, overCell, dropHandlers }) {
  const start = addDays(cursor, -cursor.getDay())
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const birthdaysAt = useBirthdays()
  const today = todayISO()
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((d, i) => {
        const iso = isoDate(d)
        const list = byDate[iso] || []
        const bdays = birthdaysAt(iso)
        return (
          <div key={i} className={cn('card p-2 min-h-[380px] cursor-pointer', overCell === iso && 'dragover')}
            onClick={() => setNewDate(iso)} {...dropHandlers(iso)}>
            <div className="text-center mb-2">
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--faint)' }}>{WEEKDAYS_S[d.getDay()]}</div>
              <div className={cn('w-7 h-7 mx-auto grid place-items-center rounded-full text-[13px] font-bold', iso === today && 'text-[#0a0c11]')}
                style={iso === today ? { background: 'linear-gradient(120deg,#818cf8,#38bdf8)' } : { color: 'var(--text)' }}>
                {d.getDate()}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {bdays.map(c => <BirthdayChip key={c.id} name={c.name} />)}
              {list.map(e => <EventChip key={e.id} e={e} dragId={dragId} setDragId={setDragId} onOpen={setDetail} />)}
              {list.length === 0 && bdays.length === 0 && <div className="text-center text-[10.5px] pt-6" style={{ color: 'var(--faint)' }}>—</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DayView({ cursor, byDate, setNewDate, setDetail }) {
  const iso = isoDate(cursor)
  const list = byDate[iso] || []
  const birthdaysAt = useBirthdays()
  const bdays = birthdaysAt(iso)
  const hours = Array.from({ length: 13 }, (_, i) => i + 8) // 08:00–20:00
  return (
    <div className="card p-4 max-w-[720px]">
      {bdays.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Cake size={14} style={{ color: 'var(--t-pink)' }} />
          {bdays.map(c => <Pill key={c.id} color="#f472b6">{c.name}'s birthday</Pill>)}
        </div>
      )}
      {list.length === 0 && bdays.length === 0 && <Empty icon={Clock} title="Nothing on this day">Click to create an event.</Empty>}
      <div>
        {hours.map(h => {
          const hh = String(h).padStart(2, '0') + ':00'
          const evs = list.filter(e => +e.time.slice(0, 2) === h)
          return (
            <div key={h} className="flex gap-3 border-b last:border-0 min-h-[44px] py-1.5" style={{ borderColor: 'var(--hairline)' }}>
              <span className="w-12 flex-none text-[11px] font-mono pt-1" style={{ color: 'var(--faint)' }}>{hh}</span>
              <div className="flex-1 flex flex-col gap-1 cursor-pointer" onClick={() => setNewDate(iso)}>
                {evs.map(e => <EventChip key={e.id} e={e} dragId={null} setDragId={() => {}} onOpen={setDetail} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EventModal({ iso, onClose }) {
  const { addEvent, contacts, toast } = useCrm()
  const empty = { title: '', type: 'meeting', time: '10:00', endTime: '10:30', contactId: '', location: '' }
  const [f, setF] = useState(empty)
  useEffect(() => { if (iso) setF(empty) }, [iso])
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  return (
    <Modal open={!!iso} onClose={onClose} title={`New event · ${iso || ''}`}>
      <div className="flex flex-col gap-4">
        <Field label="Title *"><input className="input" value={f.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Coffee with Priya" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <select className="input" value={f.type} onChange={e => set('type', e.target.value)}>
              {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Contact (attendee)">
            <input className="input" list="crm-contacts" placeholder="Start typing a name…" value={f.contactId ? contacts.find(c => c.id === f.contactId)?.name || '' : f.contactName || ''}
              onChange={e => {
                const v = e.target.value
                const match = contacts.find(c => c.name.toLowerCase() === v.toLowerCase())
                setF(x => ({ ...x, contactId: match ? match.id : '', contactName: v }))
              }} />
            <datalist id="crm-contacts">{contacts.map(c => <option key={c.id} value={c.name} />)}</datalist>
          </Field>
          <Field label="Start"><input className="input" type="time" value={f.time} onChange={e => set('time', e.target.value)} /></Field>
          <Field label="End"><input className="input" type="time" value={f.endTime} onChange={e => set('endTime', e.target.value)} /></Field>
        </div>
        <Field label="Location"><input className="input" value={f.location} onChange={e => set('location', e.target.value)} placeholder="Optional — café, office, video link…" /></Field>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!f.title.trim()}
          onClick={() => { addEvent({ title: f.title.trim(), type: f.type, time: f.time, endTime: f.endTime, contactId: f.contactId || null, location: f.location, date: iso }); toast('Event created'); onClose() }}>
          <CalendarPlus size={14} /> Create event
        </button>
      </div>
    </Modal>
  )
}

function EventDetail({ ev, onClose }) {
  const { contactById, deleteEvent, toast } = useCrm()
  if (!ev) return null
  const contact = ev.contactId && contactById[ev.contactId]
  const color = EVENT_COLORS[ev.type] || '#94a3b8'
  return (
    <Modal open onClose={onClose} title="Event details">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-3 h-3 rounded-full flex-none" style={{ background: color }} />
        <h4 className="text-[16px] font-bold tracking-tight">{ev.title}</h4>
      </div>
      <div className="card p-4 flex flex-col gap-2.5 text-[13px]">
        <div className="flex gap-3"><Clock size={14} style={{ color: 'var(--t-sky)' }} className="flex-none" /> {ev.date} · {ev.time}–{ev.endTime}</div>
        {ev.location && <div className="flex gap-3">📍 {ev.location}</div>}
        <div className="flex gap-3 items-center flex-wrap">
          <span className="chip" style={{ background: color + '1c', color, borderColor: color + '38' }}>{TYPE_LABEL[ev.type] || ev.type}</span>
          <Pill color={ev.gcal === 'synced' ? '#34d399' : '#94a3b8'}>{ev.gcal === 'synced' ? 'Google Calendar synced' : 'Local only'}</Pill>
        </div>
        <div className="flex gap-2 pt-1 flex-wrap">
          <a className="btn btn-ghost btn-sm" href={gcalTemplateUrl(ev, contact)} target="_blank" rel="noreferrer"
             title="Opens a pre-filled Google Calendar event — works with zero setup, any Google account">
            <ExternalLink size={12} /> Add to Google Calendar
          </a>
        </div>
        {contact && (
          <div className="flex items-center gap-2 pt-1">
            <Avatar name={contact.name} photo={contact.photo} size={26} />
            <div>
              <div className="font-semibold text-[13px]">{contact.name}</div>
              <div className="text-[11px]" style={{ color: 'var(--faint)' }}>{contact.phone || contact.email || 'attendee'}</div>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-between mt-6">
        <button className="btn btn-danger btn-sm" onClick={() => { deleteEvent(ev.id); toast('Event deleted'); onClose() }}><Trash2 size={13} /> Delete</button>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  )
}
