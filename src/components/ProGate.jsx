import { Crown, Lock, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCrm } from '../store'
import { useT } from '../lib/i18n'

/** Tiny PRO chip */
export function ProBadge({ className = '', style = {} }) {
  return (
    <span
      className={`chip ${className}`}
      style={{
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '.06em',
        background: 'rgba(129,140,248,.14)',
        color: 'var(--t-indigo)',
        borderColor: 'rgba(129,140,248,.35)',
        ...style,
      }}
      aria-label="Pro"
    >
      PRO
    </span>
  )
}

/**
 * Inline lock + unlock CTA used next to Pro-only controls.
 * If already Pro, renders children only (or null when bare).
 */
export function ProLockHint({ feature, children, compact = false }) {
  const { can, isPro } = useCrm()
  const { t } = useT()
  if (isPro?.() || (feature && can?.(feature))) {
    return children || null
  }
  return (
    <span className={`inline-flex items-center gap-1.5 ${compact ? '' : 'flex-wrap'}`}>
      {children}
      <ProBadge />
      <Link
        to="/pro"
        className="text-[11px] font-semibold underline decoration-dotted underline-offset-2"
        style={{ color: 'var(--t-indigo)' }}
      >
        {t('pro.unlockCta')}
      </Link>
    </span>
  )
}

/**
 * Card-style gate: shows locked panel for free users, children when Pro (or feature allowed).
 * soft=true keeps children visible but dimmed with overlay CTA (for previews).
 */
export default function ProGate({
  feature,
  title,
  body,
  children,
  soft = false,
  className = '',
}) {
  const { can, isPro } = useCrm()
  const { t } = useT()
  const ok = isPro?.() || (feature ? can?.(feature) : false)

  if (ok) return children || null

  if (soft && children) {
    return (
      <div className={`relative ${className}`}>
        <div className="opacity-40 pointer-events-none select-none" aria-hidden>
          {children}
        </div>
        <div
          className="absolute inset-0 grid place-items-center p-4 rounded-xl"
          style={{ background: 'color-mix(in srgb, var(--cardbg) 72%, transparent)', backdropFilter: 'blur(2px)' }}
        >
          <div className="text-center max-w-sm">
            <div
              className="w-10 h-10 rounded-2xl grid place-items-center mx-auto mb-2"
              style={{ background: 'linear-gradient(140deg,var(--i1),var(--i2))', color: '#0b0e17' }}
            >
              <Lock size={18} />
            </div>
            <div className="font-bold text-[13.5px]">{title || t('pro.gateTitle')}</div>
            {body && (
              <p className="text-[12px] mt-1 leading-snug" style={{ color: 'var(--muted)' }}>
                {body}
              </p>
            )}
            <Link to="/pro" className="btn btn-primary btn-sm mt-3 inline-flex">
              <Crown size={13} /> {t('pro.unlockCta')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl p-4 flex items-start gap-3 ${className}`}
      style={{ background: 'var(--cardbg2)', border: '1px solid var(--border)' }}
      role="note"
    >
      <span
        className="w-9 h-9 rounded-xl grid place-items-center flex-none"
        style={{ background: 'rgba(129,140,248,.16)', color: 'var(--t-indigo)' }}
      >
        <Sparkles size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-bold text-[13px]">{title || t('pro.gateTitle')}</div>
          <ProBadge />
        </div>
        <p className="text-[12px] mt-1 leading-snug" style={{ color: 'var(--muted)' }}>
          {body || t('pro.gateBody')}
        </p>
        <Link to="/pro" className="btn btn-primary btn-sm mt-2.5 inline-flex">
          <Crown size={13} /> {t('pro.unlockCta')}
        </Link>
      </div>
    </div>
  )
}
