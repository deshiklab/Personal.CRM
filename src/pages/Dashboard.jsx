import { useEffect, useMemo, useState } from 'react'
import { Settings2, RotateCcw, ChevronLeft, ChevronRight, EyeOff, Plus, UserPlus, CheckSquare, Shield, BookOpen, X, Sparkles, Crown, Bell, Camera, StickyNote } from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Card } from '../components/ui'
import { Link } from 'react-router-dom'
import { WIDGET_META, WIDGET_COMPONENTS } from '../components/dashboardWidgets'
import { cn } from '../lib'

export default function Dashboard() {
  const {
    widgetPrefs, toggleWidget, moveWidget, resetWidgets, DEFAULT_WIDGET_ORDER,
    profile, isRegistered, helpPrefs, patchHelpPrefs, contacts, lock,
    tasks, notes, isPro, snapshots, reminderPrefs,
  } = useCrm()
  const firstName = isRegistered ? (profile.name.trim().split(/\s+/)[0] || 'there') : 'BiTsCol'
  const [edit, setEdit] = useState(false)

  const onboardSteps = useMemo(() => {
    const hasTaskOrNote = (tasks?.length || 0) + (notes?.length || 0) > 0
    const snapOk = (snapshots?.length || 0) > 0
    const remOk = !!(reminderPrefs?.permission === 'granted' && reminderPrefs?.enabled !== false && isPro?.())
    return [
      { id: 'person', n: 1, icon: UserPlus, title: 'Add a person',
        body: contacts.length ? `${contacts.length} in your network` : 'Name, how you know them, stay-in-touch rhythm.',
        to: '/contacts?new=1', done: contacts.length > 0 },
      { id: 'task', n: 2, icon: CheckSquare, title: 'Capture a task or note',
        body: hasTaskOrNote ? 'You have items on the board.' : 'Quick Capture (⚡) or Tasks / Notes.',
        to: '/tasks', done: hasTaskOrNote },
      { id: 'pin', n: 3, icon: Shield, title: 'Turn on a pincode',
        body: lock?.hash ? 'App lock is on.' : 'Optional — stops a borrowed phone reading your network.',
        to: '/settings', done: !!lock?.hash },
      { id: 'snap', n: 4, icon: Camera, title: 'Take a safety-net snapshot',
        body: snapOk ? 'You can roll back from Settings.' : 'Settings → Safety net → Take snapshot now.',
        to: '/settings', done: snapOk },
      { id: 'kb', n: 5, icon: BookOpen, title: 'Open the knowledge base',
        body: 'Short articles and a guided tour of every screen.',
        to: '/knowledge', done: !!helpPrefs?.tourDone },
      { id: 'pro', n: 6, icon: Crown, title: 'Know Free vs Pro',
        body: isPro?.() ? 'Pro is unlocked on this device.' : 'One-time unlock — reminders, unlimited contacts, auto backups.',
        to: '/pro', done: !!isPro?.() || !!helpPrefs?.seenPro },
      { id: 'remind', n: 7, icon: Bell, title: 'Arm device reminders (Pro)',
        body: remOk ? 'OS nudges are armed.' : 'Inbox → Device reminders — local only, no account.',
        to: '/notifications', done: remOk },
    ]
  }, [contacts, tasks, notes, lock, snapshots, helpPrefs, isPro, reminderPrefs])

  const onboardDoneCount = onboardSteps.filter(s => s.done).length
  const onboardTotal = onboardSteps.length
  const onboardPct = Math.round((onboardDoneCount / onboardTotal) * 100)

  useEffect(() => {
    if (helpPrefs?.onboardDone) return
    if (onboardDoneCount >= onboardTotal) patchHelpPrefs({ onboardDone: true })
  }, [onboardDoneCount, onboardTotal, helpPrefs?.onboardDone]) // eslint-disable-line react-hooks/exhaustive-deps


  const order = useMemo(() => [
    ...widgetPrefs.order.filter(id => DEFAULT_WIDGET_ORDER.includes(id)),
    ...DEFAULT_WIDGET_ORDER.filter(id => !widgetPrefs.order.includes(id)),
  ], [widgetPrefs, DEFAULT_WIDGET_ORDER])
  const visible = order.filter(id => !widgetPrefs.hidden.includes(id))

  return (
    <div className="max-w-[1200px] mx-auto">
      <SectionHead kicker="Overview" title={<>Good day, <span className="grad-text">{firstName}</span> 👋</>}
        sub="Reorder with arrows, hide what you don't need — your layout is saved."
        right={edit ? (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => { resetWidgets(); }}><RotateCcw size={13} /> Reset layout</button>
            <button className="btn btn-primary btn-sm" onClick={() => setEdit(false)}>Done</button>
          </>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={() => setEdit(true)}><Settings2 size={13} /> Customize</button>
        )} />


      {/* First-run checklist — dismissed once (or when all steps done) */}
      {!helpPrefs?.onboardDone && (
        <Card className="p-4 sm:p-5 mb-5 relative overflow-hidden" data-tour="onboard" role="region" aria-label="Getting started checklist">
          <button type="button" className="icon-btn absolute top-3 right-3" title="Dismiss checklist" aria-label="Dismiss checklist"
            onClick={() => patchHelpPrefs({ onboardDone: true })}>
            <X size={14} />
          </button>
          <div className="flex items-start gap-3 pr-8">
            <div className="w-10 h-10 rounded-2xl grid place-items-center flex-none"
              style={{ background: 'linear-gradient(140deg,var(--i1),var(--i2))', color: '#0b0e17' }}>
              <Sparkles size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold tracking-tight">Getting started</div>
              <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: 'var(--muted)' }}>
                Everything stays on this device. No account. Closed testers: tick these once so we know the build is healthy.
              </p>
              <div className="mt-2.5 flex items-center gap-2.5">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--chipbg)' }} role="progressbar"
                  aria-valuenow={onboardDoneCount} aria-valuemin={0} aria-valuemax={onboardTotal} aria-label="Checklist progress">
                  <div className="h-full rounded-full transition-all" style={{ width: `${onboardPct}%`, background: 'linear-gradient(90deg,var(--i1),var(--i2))' }} />
                </div>
                <span className="text-[11px] font-bold flex-none" style={{ color: 'var(--faint)' }}>{onboardDoneCount}/{onboardTotal}</span>
              </div>
            </div>
          </div>
          <ol className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {onboardSteps.map(step => {
              const Icon = step.icon
              return (
                <li key={step.id}>
                  <Link to={step.to}
                    onClick={() => { if (step.id === 'pro') patchHelpPrefs({ seenPro: true }) }}
                    className="flex items-start gap-3 rounded-xl p-3 h-full transition-colors hover:bg-[var(--hover)]"
                    style={{ background: 'var(--cardbg2)', border: `1px solid ${step.done ? 'rgba(52,211,153,.35)' : 'var(--border)'}` }}>
                    <span className="w-7 h-7 rounded-lg grid place-items-center flex-none text-[12px] font-bold"
                      style={{ background: step.done ? 'rgba(52,211,153,.16)' : 'var(--chipbg)',
                               color: step.done ? 'var(--t-green)' : 'var(--t-indigo)' }}>
                      {step.done ? '✓' : <Icon size={14} aria-hidden="true" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold leading-tight">{step.title}</span>
                      <span className="block text-[11.5px] mt-0.5 leading-snug" style={{ color: 'var(--muted)' }}>{step.body}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.dispatchEvent(new CustomEvent('crm:tour'))}>
              Take the guided tour
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => patchHelpPrefs({ onboardDone: true })}>
              Got it — hide this
            </button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4" data-tour="widgets">
        {visible.map(id => {
          const meta = WIDGET_META[id]
          const Comp = WIDGET_COMPONENTS[id]
          if (!meta || !Comp) return null
          return (
            <div key={id}
              className={cn('relative', meta.span === 2 && 'xl:col-span-2', meta.span === 3 && 'xl:col-span-3')}
              style={edit ? { outline: '1.5px dashed rgba(129,140,248,.5)', outlineOffset: 5, borderRadius: 18 } : {}}>
              {edit && (
                <div className="panel absolute -top-3 right-3 z-10 px-1.5 py-1 flex items-center gap-1">
                  <span className="text-[10.5px] font-bold px-1" style={{ color: 'var(--muted)' }}>{meta.title}</span>
                  <button className="icon-btn" style={{ width: 24, height: 24 }} title="Move left" onClick={() => moveWidget(id, -1)}><ChevronLeft size={12} /></button>
                  <button className="icon-btn" style={{ width: 24, height: 24 }} title="Move right" onClick={() => moveWidget(id, 1)}><ChevronRight size={12} /></button>
                  <button className="icon-btn" style={{ width: 24, height: 24 }} title="Hide widget" onClick={() => toggleWidget(id)}><EyeOff size={12} /></button>
                </div>
              )}
              <Comp />
            </div>
          )
        })}
      </div>

      {edit && widgetPrefs.hidden.length > 0 && (
        <div className="card p-4 mt-6" style={{ borderStyle: 'dashed' }}>
          <div className="text-[10.5px] font-bold uppercase tracking-[.1em] mb-2" style={{ color: 'var(--faint)' }}>Hidden widgets — tap to bring back</div>
          <div className="flex gap-1.5 flex-wrap">
            {widgetPrefs.hidden.map(id => WIDGET_META[id] && (
              <button key={id} className="chip chip-btn" onClick={() => toggleWidget(id)}><Plus size={11} /> {WIDGET_META[id].title}</button>
            ))}
          </div>
        </div>
      )}
      {edit && widgetPrefs.hidden.length === 0 && (
        <div className="text-center text-[12px] mt-6" style={{ color: 'var(--faint)' }}>All widgets are visible — hide some to declutter.</div>
      )}
    </div>
  )
}
