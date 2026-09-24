import { useMemo, useState } from 'react'
import { Settings2, RotateCcw, ChevronLeft, ChevronRight, EyeOff, Plus, UserPlus, CheckSquare, Shield, BookOpen, X, Sparkles } from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Card } from '../components/ui'
import { Link } from 'react-router-dom'
import { WIDGET_META, WIDGET_COMPONENTS } from '../components/dashboardWidgets'
import { cn } from '../lib'

export default function Dashboard() {
  const { widgetPrefs, toggleWidget, moveWidget, resetWidgets, DEFAULT_WIDGET_ORDER, profile, isRegistered, helpPrefs, patchHelpPrefs, contacts, lock } = useCrm()
  const firstName = isRegistered ? (profile.name.trim().split(/\s+/)[0] || 'there') : 'BiTsCol'
  const [edit, setEdit] = useState(false)

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


      {/* First-run teaching card — dismissed once, lives only on this device */}
      {!helpPrefs?.onboardDone && (
        <Card className="p-4 sm:p-5 mb-5 relative overflow-hidden" data-tour="onboard">
          <button className="icon-btn absolute top-3 right-3" title="Dismiss"
            onClick={() => patchHelpPrefs({ onboardDone: true })}>
            <X size={14} />
          </button>
          <div className="flex items-start gap-3 pr-8">
            <div className="w-10 h-10 rounded-2xl grid place-items-center flex-none"
              style={{ background: 'linear-gradient(140deg,var(--i1),var(--i2))', color: '#0b0e17' }}>
              <Sparkles size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-bold tracking-tight">Your first five minutes</div>
              <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: 'var(--muted)' }}>
                Everything stays on this device. No account, no cloud unless you turn one on.
              </p>
            </div>
          </div>
          <ol className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              { n: 1, icon: UserPlus, title: 'Add a person',
                body: contacts.length ? `${contacts.length} already in` : 'Name, how you know them, how often to stay in touch.',
                to: '/contacts?new=1', done: contacts.length > 0 },
              { n: 2, icon: CheckSquare, title: 'Capture a task or note',
                body: 'Quick Capture (lightning bolt) or the Tasks / Notes screens.',
                to: '/tasks', done: false },
              { n: 3, icon: Shield, title: 'Turn on a pincode',
                body: lock?.hash ? 'Pincode is on — you are set.' : 'Optional, but the only lock between a borrowed phone and your network.',
                to: '/settings', done: !!lock?.hash },
              { n: 4, icon: BookOpen, title: 'Open the knowledge base',
                body: 'Short articles and a guided tour of every screen.',
                to: '/knowledge', done: !!helpPrefs?.tourDone },
            ].map(step => (
              <li key={step.n}>
                <Link to={step.to}
                  className="flex items-start gap-3 rounded-xl p-3 h-full transition-colors hover:bg-[var(--hover)]"
                  style={{ background: 'var(--cardbg2)', border: '1px solid var(--border)' }}>
                  <span className="w-7 h-7 rounded-lg grid place-items-center flex-none text-[12px] font-bold"
                    style={{ background: step.done ? 'rgba(52,211,153,.16)' : 'var(--chipbg)',
                             color: step.done ? 'var(--t-green)' : 'var(--t-indigo)' }}>
                    {step.done ? '✓' : step.n}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight">{step.title}</span>
                    <span className="block text-[11.5px] mt-0.5 leading-snug" style={{ color: 'var(--muted)' }}>{step.body}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => window.dispatchEvent(new CustomEvent('crm:tour'))}>
              Take the guided tour
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => patchHelpPrefs({ onboardDone: true })}>
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
        <div className="text-center text-[12px] mt-6" style={{ color: 'var(--faint)' }}>All 10 widgets are visible — hide some to declutter.</div>
      )}
    </div>
  )
}
