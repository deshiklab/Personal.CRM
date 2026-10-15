import { Bell, BellOff, Clock, X, Repeat } from 'lucide-react'
import { useCrm } from '../store'
import { minutesBefore, dueSoonLabel, REPEATS } from '../lib/reminders'
import { cn } from '../lib'

/* "Remind me" attach row — works for tasks, events, contacts, anything.
 * Quick chips compute lead times from the item's date/time; a custom
 * datetime picker covers the rest. Existing reminders are listable/removable. */
export default function RemindMeRow({ refType, refId, title, date, time = '09:00', subtitle = '' }) {
  const crm = useCrm()
  const existing = crm.remindersFor(refType, refId)

  const add = (at, repeat = 'none') => {
    if (!at) return
    crm.addReminder({ refType, refId, title: title || 'Reminder', body: subtitle, at, repeat })
    crm.toast('⏰ Reminder set')
  }

  const chips = []
  if (date) {
    chips.push(['At 9:00', minutesBefore(date, '09:00', 0)])
    chips.push(['1h before', minutesBefore(date, time, 60)])
    chips.push(['10 min before', minutesBefore(date, time, 10)])
  }

  return (
    <div>
      <div className="label">Reminders</div>
      {existing.length > 0 && (
        <div className="flex flex-col gap-1 mb-1.5">
          {existing.map(r => (
            <div key={r.id} className="flex items-center gap-1.5 text-[11.5px] rounded-lg px-2 py-1.5" style={{ background: 'rgba(251,191,36,.1)' }}>
              <Bell size={11} style={{ color: '#fbbf24' }} className="flex-none" />
              <span className="flex-1 truncate">{String(r.at).replace('T', ' ')} · {dueSoonLabel(r.at)}</span>
              {r.repeat !== 'none' && <span className="inline-flex items-center gap-0.5 opacity-70"><Repeat size={9} /> {REPEATS[r.repeat] || r.repeat}</span>}
              <button className="icon-btn !w-6 !h-6" title="Remove reminder" onClick={() => crm.deleteReminder(r.id)}><X size={10} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {chips.map(([label, at]) => (
          <button key={label} className="chip chip-btn" disabled={!at} onClick={() => add(at)}>
            <Clock size={10} /> {label}
          </button>
        ))}
        <label className="chip chip-btn inline-flex items-center gap-1 cursor-pointer">
          <Bell size={10} /> Custom…
          <input type="datetime-local" className="hidden"
            onChange={e => { if (e.target.value) { add(e.target.value); e.target.value = '' } }} />
        </label>
        {existing.length > 0 && (
          <button className="text-[10.5px] underline opacity-60" onClick={() => existing.forEach(r => crm.deleteReminder(r.id))}>
            clear all
          </button>
        )}
      </div>
    </div>
  )
}
