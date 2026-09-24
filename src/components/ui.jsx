import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { X, Download, HelpCircle } from 'lucide-react'
import { cn, initials, hashColor, relDay, daysUntil } from '../lib'
import { SCREEN_GUIDE } from '../lib/kb'
import { downloadCSV } from '../lib/csv'

export function CsvButton({ headers, rows, filename, label = 'CSV' }) {
  return (
    <button className="btn btn-ghost btn-sm" title={`Download ${rows.length} rows as CSV (Excel-ready)`}
      onClick={e => { e.stopPropagation(); downloadCSV(filename, headers, rows) }}>
      <Download size={13} /><span className="hidden sm:inline">{label}</span>
    </button>
  )
}

export function Card({ className = '', children, ...rest }) {
  return <div className={cn('card', className)} {...rest}>{children}</div>
}
export function Panel({ className = '', children, ...rest }) {
  return <div className={cn('panel', className)} {...rest}>{children}</div>
}

export function SectionHead({ kicker, title, sub, right, help }) {
  /* no `help` prop? fall back to the article for this screen (help={false} opts out) */
  const { pathname } = useLocation()
  const guide = help === false ? null : (help || SCREEN_GUIDE[pathname] || null)
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          {kicker && <div className="text-[11px] font-bold tracking-[.12em] uppercase text-indigo-300 mb-1">{kicker}</div>}
          <h2 className="text-[20px] font-bold tracking-tight flex items-center gap-2">
            {title}
            {guide && <GuideLink slug={guide} />}
          </h2>
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
      {sub && <p className="text-[13.5px] mt-1" style={{ color: 'var(--muted)' }}>{sub}</p>}
    </div>
  )
}

export function Stat({ icon: Icon, label, value, delta, tone = '#818cf8' }) {
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl grid place-items-center flex-none" style={{ background: tone + '1c', color: tone }}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className="text-[22px] font-extrabold tracking-tight leading-6 truncate">{value}</div>
        <div className="text-[11.5px] font-semibold uppercase tracking-[.07em] truncate" style={{ color: 'var(--faint)' }}>{label}</div>
      </div>
      {delta && <div className="ml-auto text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>{delta}</div>}
    </Card>
  )
}

export function Avatar({ name = '', size = 36, className = '' }) {
  const color = hashColor(name)
  return (
    <div className={cn('rounded-full grid place-items-center font-bold flex-none', className)}
      style={{ width: size, height: size, fontSize: size * 0.36, background: color + '22', color, border: `1px solid ${color}44` }}>
      {initials(name)}
    </div>
  )
}

export function TagPill({ tag, small = false }) {
  if (!tag) return null
  return (
    <span className="inline-flex items-center gap-1 font-semibold rounded-full whitespace-nowrap"
      style={{ fontSize: small ? 10.5 : 11.5, padding: small ? '1px 8px' : '3px 10px', background: tag.color + '1c', color: tag.color, border: `1px solid ${tag.color}40` }}>
      <span>{tag.icon}</span>{tag.name}
    </span>
  )
}

export function Pill({ children, color = '#9aa3b2' }) {
  return (
    <span className="chip" style={{ background: color + '16', color, borderColor: color + '38' }}>{children}</span>
  )
}

export function Field({ label, children, hint }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <div className="text-[11.5px] mt-1" style={{ color: 'var(--faint)' }}>{hint}</div>}
    </div>
  )
}

export function Toggle({ on, onChange, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange?.(!on)}
      className="relative rounded-full transition-colors flex-none"
      style={{ width: 38, height: 22, background: on ? 'linear-gradient(120deg,#818cf8,#38bdf8)' : 'rgba(255,255,255,.12)' }}>
      <span className="absolute top-[3px] rounded-full bg-white transition-all"
        style={{ width: 16, height: 16, left: on ? 19 : 3 }} />
    </button>
  )
}

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return
    const fn = e => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto p-4 sm:p-8 flex items-start justify-center"
      style={{ background: 'rgba(6,8,12,.7)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <Panel className={cn('fadein w-full p-6 my-auto', wide ? 'max-w-2xl' : 'max-w-lg')} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16.5px] font-bold tracking-tight">{title}</h3>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        {children}
      </Panel>
    </div>
  )
}

export function Drawer({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return
    const fn = e => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[90]" style={{ background: 'rgba(6,8,12,.55)', backdropFilter: 'blur(3px)' }} onClick={onClose}>
      <div className="fadein absolute inset-y-0 right-0 w-full sm:w-[480px] overflow-y-auto"
        style={{ background: 'var(--panel)', borderLeft: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="py-10 text-center">
      {Icon && <Icon size={28} className="mx-auto mb-3" style={{ color: 'var(--faint)' }} />}
      <div className="font-semibold text-[14px]">{title}</div>
      {children && <div className="text-[12.5px] mt-1" style={{ color: 'var(--faint)' }}>{children}</div>}
    </div>
  )
}

export function Seg({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

const DUE_TONE = d => {
  if (d == null) return null
  const n = daysUntil(d)
  if (n < 0) return '#fb7185'
  if (n === 0) return '#fbbf24'
  return 'var(--muted)'
}
export function DueBadge({ date }) {
  if (!date) return null
  const color = DUE_TONE(date)
  return <span className="text-[11px] font-semibold" style={{ color }}>{relDay(date)}</span>
}

export function Sparkline({ data, height = 60, color = '#38bdf8' }) {
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => [ (i / Math.max(1, data.length - 1)) * 100, height - 6 - (v / max) * (height - 14) ])
  const line = pts.map(p => p.join(',')).join(' ')
  const area = `0,${height} ${line} 100,${height}`
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <polygon points={area} fill={color} opacity=".12" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function MiniBars({ items, height = 110 }) {
  const max = Math.max(...items.map(i => i.value), 1)
  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {items.map((it, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold" style={{ color: it.color }}>{it.value}</span>
          <div className="w-full rounded-t-lg" style={{ height: `${Math.max(4, (it.value / max) * (height - 44))}px`, background: `linear-gradient(180deg, ${it.color}cc, ${it.color}33)` }} />
          <span className="text-[10px] font-semibold uppercase tracking-wide truncate w-full text-center" style={{ color: 'var(--faint)' }}>{it.label}</span>
        </div>
      ))}
    </div>
  )
}

export const EVENT_COLORS = {
  meeting: '#38bdf8', call: '#34d399', 'follow-up': '#fbbf24',
  personal: '#a78bfa', birthday: '#f472b6', task: '#94a3b8',
}
export const PRIORITY_COLORS = { high: '#fb7185', med: '#fbbf24', low: '#94a3b8' }

/* Small "?" next to a screen title — opens that screen's knowledge-base article.
   Optional: pass `help="article.slug"` to any SectionHead. */
export function GuideLink({ slug, label = 'Guide' }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(`/knowledge?a=${encodeURIComponent(slug)}`)}
      data-tip-with-title="Read the guide"
      data-tip-title={`${label} for this screen`}
      data-tip-body="Opens the matching article in the knowledge base."
      data-tip-learn={slug}
      aria-label={`${label} for this screen`}
      className="inline-flex items-center gap-1 text-[12px] sm:text-[11px] font-bold px-2.5 sm:px-1.5 py-0.5 rounded-full min-h-[34px] sm:min-h-0"
      style={{
        background: 'var(--hover)', border: '1px solid var(--border)',
        color: 'var(--muted)', cursor: 'pointer', verticalAlign: 'middle',
      }}>
      <HelpCircle size={11} /> {label}
    </button>
  )
}
