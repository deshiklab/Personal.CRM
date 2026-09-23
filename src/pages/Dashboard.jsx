import { useMemo, useState } from 'react'
import { Settings2, RotateCcw, ChevronLeft, ChevronRight, EyeOff, Plus } from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead } from '../components/ui'
import { WIDGET_META, WIDGET_COMPONENTS } from '../components/dashboardWidgets'
import { cn } from '../lib'

export default function Dashboard() {
  const { widgetPrefs, toggleWidget, moveWidget, resetWidgets, DEFAULT_WIDGET_ORDER, profile, isRegistered } = useCrm()
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
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
