import { useEffect, useMemo, useState } from 'react'
import { Settings2, RotateCcw, ChevronLeft, ChevronRight, EyeOff, Plus, UserPlus, CheckSquare, Shield, BookOpen, X, Sparkles, Crown, Bell, Camera, StickyNote } from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Card } from '../components/ui'
import { Link } from 'react-router-dom'
import { WIDGET_META, WIDGET_COMPONENTS } from '../components/dashboardWidgets'
import { cn } from '../lib'
import { useT } from '../lib/i18n'

export default function Dashboard() {
  const {
    widgetPrefs, toggleWidget, moveWidget, resetWidgets, DEFAULT_WIDGET_ORDER,
    profile, isRegistered, helpPrefs, patchHelpPrefs, contacts, lock,
    tasks, notes, isPro, snapshots, reminderPrefs,
  } = useCrm()
  const { t } = useT()
  const firstName = isRegistered ? (profile.name.trim().split(/\s+/)[0] || 'there') : 'BiTsCol'
  const [edit, setEdit] = useState(false)

  const onboardSteps = useMemo(() => {
    const hasTaskOrNote = (tasks?.length || 0) + (notes?.length || 0) > 0
    const snapOk = (snapshots?.length || 0) > 0
    const remOk = !!(reminderPrefs?.permission === 'granted' && reminderPrefs?.enabled !== false && isPro?.())
    return [
      { id: 'person', n: 1, icon: UserPlus, title: t('dash.stepPerson'),
        body: contacts.length ? t('dash.stepPersonDone', { n: contacts.length }) : t('dash.stepPersonBody'),
        to: '/contacts?new=1', done: contacts.length > 0 },
      { id: 'task', n: 2, icon: CheckSquare, title: t('dash.stepTask'),
        body: hasTaskOrNote ? t('dash.stepTaskDone') : t('dash.stepTaskBody'),
        to: '/tasks', done: hasTaskOrNote },
      { id: 'pin', n: 3, icon: Shield, title: t('dash.stepPin'),
        body: lock?.hash ? t('dash.stepPinDone') : t('dash.stepPinBody'),
        to: '/settings', done: !!lock?.hash },
      { id: 'snap', n: 4, icon: Camera, title: t('dash.stepSnap'),
        body: snapOk ? t('dash.stepSnapDone') : t('dash.stepSnapBody'),
        to: '/settings', done: snapOk },
      { id: 'kb', n: 5, icon: BookOpen, title: t('dash.stepKb'),
        body: t('dash.stepKbBody'),
        to: '/knowledge', done: !!helpPrefs?.tourDone },
      { id: 'pro', n: 6, icon: Crown, title: t('dash.stepPro'),
        body: isPro?.() ? t('dash.stepProDone') : t('dash.stepProBody'),
        to: '/pro', done: !!isPro?.() || !!helpPrefs?.seenPro },
      { id: 'remind', n: 7, icon: Bell, title: t('dash.stepRemind'),
        body: remOk ? t('dash.stepRemindDone') : t('dash.stepRemindBody'),
        to: '/notifications', done: remOk },
    ]
  }, [contacts, tasks, notes, lock, snapshots, helpPrefs, isPro, reminderPrefs, t])

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
      <SectionHead kicker={t('dash.kicker')} title={<>{t('dash.greeting', { name: firstName })} <span aria-hidden="true">👋</span></>}
        sub={t('dash.sub')}
        right={edit ? (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => { resetWidgets(); }}><RotateCcw size={13} /> {t('dash.resetLayout')}</button>
            <button className="btn btn-primary btn-sm" onClick={() => setEdit(false)}>{t('dash.done')}</button>
          </>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={() => setEdit(true)}><Settings2 size={13} /> {t('dash.customize')}</button>
        )} />


      {/* First-run checklist — dismissed once (or when all steps done) */}
      {!helpPrefs?.onboardDone && (
        <Card className="p-4 sm:p-5 mb-5 relative overflow-hidden" data-tour="onboard" role="region" aria-label={t('dash.gettingStarted')}>
          <button type="button" className="icon-btn absolute top-3 right-3" title={t('dash.dismiss')} aria-label={t('dash.dismiss')}
            onClick={() => patchHelpPrefs({ onboardDone: true })}>
            <X size={14} />
          </button>
          <div className="flex items-start gap-3 pr-8">
            <div className="w-10 h-10 rounded-2xl grid place-items-center flex-none"
              style={{ background: 'linear-gradient(140deg,var(--i1),var(--i2))', color: '#0b0e17' }}>
              <Sparkles size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold tracking-tight">{t('dash.gettingStarted')}</div>
              <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: 'var(--muted)' }}>
                {t('dash.gettingStartedBody')}
              </p>
              <div className="mt-2.5 flex items-center gap-2.5">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--chipbg)' }} role="progressbar"
                  aria-valuenow={onboardDoneCount} aria-valuemin={0} aria-valuemax={onboardTotal} aria-label={t('dash.checklistProgress')}>
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
              {t('dash.tour')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => patchHelpPrefs({ onboardDone: true })}>
              {t('dash.hideChecklist')}
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
          <div className="text-[10.5px] font-bold uppercase tracking-[.1em] mb-2" style={{ color: 'var(--faint)' }}>{t('dash.hiddenWidgets')}</div>
          <div className="flex gap-1.5 flex-wrap">
            {widgetPrefs.hidden.map(id => WIDGET_META[id] && (
              <button key={id} className="chip chip-btn" onClick={() => toggleWidget(id)}><Plus size={11} /> {WIDGET_META[id].title}</button>
            ))}
          </div>
        </div>
      )}
      {edit && widgetPrefs.hidden.length === 0 && (
        <div className="text-center text-[12px] mt-6" style={{ color: 'var(--faint)' }}>{t('dash.allVisible')}</div>
      )}
    </div>
  )
}
