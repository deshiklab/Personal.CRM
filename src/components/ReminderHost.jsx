import { useEffect, useRef, useState } from 'react'
import { BellRing, Clock, X, Check, AlarmClock } from 'lucide-react'
import { useCrm } from '../store'
import { collectDue, dueSoonLabel, fmtLocalDT } from '../lib/reminders'
import { playSound } from '../lib/sound'
import { cn } from '../lib'

/* The firing engine: checks due reminders every 20 s + on tab focus.
 * A due reminder rings (sound + vibrate + system notification) and shows an
 * alert card with snooze / done / dismiss actions. Repeating reminders
 * advance to their next run and keep ringing on schedule. */
export default function ReminderHost() {
  const crm = useCrm()
  const { reminders, notes, reminderPrefs, fireReminder, snoozeReminder, completeReminder, dismissNotif } = crm
  const [alerting, setAlerting] = useState([])
  const seen = useRef(new Set())     // per-occurrence guard: key+at
  const tickRef = useRef(null)

  tickRef.current = () => {
    if (reminderPrefs.enabled === false) return
    const due = collectDue({ reminders, notes })
    due.forEach(item => {
      const stamp = `${item.key}|${item.at}`
      if (seen.current.has(stamp)) return
      seen.current.add(stamp)
      /* ring */
      playSound(item.sound || reminderPrefs.sound || 'bell', reminderPrefs.volume ?? 0.7)
      if (item.vibrate !== false && reminderPrefs.vibrate !== false) {
        try { navigator.vibrate?.([120, 60, 120]) } catch { /* unsupported */ }
      }
      /* lifecycle */
      if (item.kind === 'reminder') fireReminder(item.id)          // advances repeats / latches one-shots
      else crm.markNotifRead(item.key)                             // note reminders: keep for the inbox
      setAlerting(a => (a.some(x => x.key === item.key) ? a : [...a, item]))
    })
  }

  useEffect(() => {
    /* overdue one-shots already latched before this session still nag once */
    reminders.filter(r => r.status === 'fired' && r.at).forEach(r => {
      const stamp = `rem-${r.id}|${r.at}`
      if (!seen.current.has(stamp)) {
        seen.current.add(stamp)
        setAlerting(a => (a.some(x => x.key === `rem-${r.id}`) ? a : [...a, {
          key: `rem-${r.id}`, kind: 'reminder', id: r.id, title: r.title, body: r.body, at: r.at, sound: 'silent', vibrate: false,
        }]))
      }
    })
    const run = () => tickRef.current?.()
    const iv = setInterval(run, 20000)
    const onVis = () => { if (document.visibilityState === 'visible') run() }
    document.addEventListener('visibilitychange', onVis)
    run()
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  const close = key => setAlerting(a => a.filter(x => x.key !== key))

  const act = {
    done(item) {
      if (item.kind === 'reminder') completeReminder(item.id)
      else { crm.updateNote(item.id, { remindAt: null }); dismissNotif(item.key) }  // CTA completed → nag cleared
      close(item.key)
    },
    dismiss(item) {
      if (item.kind === 'reminder') completeReminder(item.id)
      else { crm.updateNote(item.id, { remindAt: null }); dismissNotif(item.key) }
      close(item.key)
    },
    snooze(item, minutes) {
      if (item.kind === 'reminder') snoozeReminder(item.id, minutes)
      else {
        const d = new Date(Date.now() + minutes * 60000)   // notes: push remindAt forward
        crm.updateNote(item.id, { remindAt: fmtLocalDT(d) })
      }
      close(item.key)
    },
  }

  if (alerting.length === 0) return null

  return (
    <div data-testid="alert-overlay" className="fixed top-4 right-4 z-[120] flex flex-col gap-2 w-[300px]">
      {alerting.map(item => (
        <div key={item.key} className="fadein rounded-2xl border p-3.5 shadow-2xl"
          style={{ background: 'var(--panel)', borderColor: '#fbbf2455', boxShadow: '0 18px 50px rgba(0,0,0,.45)' }}>
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl grid place-items-center flex-none" style={{ background: 'rgba(251,191,36,.16)', color: '#fbbf24' }}>
              <BellRing size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[13px] leading-snug">{item.title || 'Reminder'}</div>
              {item.body && <div className="text-[11.5px] mt-0.5 leading-relaxed" style={{ color: 'var(--muted)' }}>{item.body}</div>}
              <div className="text-[10px] mt-1 inline-flex items-center gap-1" style={{ color: 'var(--faint)' }}>
                <Clock size={9} /> {String(item.at || '').replace('T', ' ')} · {dueSoonLabel(item.at)}
              </div>
            </div>
            <button className="icon-btn !w-6 !h-6" title="Dismiss" onClick={() => act.dismiss(item)}><X size={12} /></button>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5">
            <button className="btn btn-ghost btn-sm" onClick={() => act.snooze(item, 10)}><Clock size={11} /> 10m</button>
            <button className="btn btn-ghost btn-sm" onClick={() => act.snooze(item, 60)}>1h</button>
            {item.kind === 'note' && <button className="btn btn-ghost btn-sm" onClick={() => act.snooze(item, 1440)}>1d</button>}
            <div className="flex-1" />
            <button className="btn btn-primary btn-sm" onClick={() => act.done(item)}><Check size={11} /> Done</button>
          </div>
        </div>
      ))}
    </div>
  )
}
