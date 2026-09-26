import { Palette, Check, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCrm } from '../../store'
import { Card, Pill } from '../../components/ui'
import { useT } from '../../lib/i18n'
import { ProBadge } from '../../components/ProGate'

const SWATCHES = {
  dark:  { bg: '#0a0c11', fg: '#e2e8f0', accent: '#818cf8', labelKey: 'pro.themeDark' },
  light: { bg: '#f8fafc', fg: '#0f172a', accent: '#4f46e5', labelKey: 'pro.themeLight' },
  ocean: { bg: '#0b1c2c', fg: '#e0f2fe', accent: '#38bdf8', labelKey: 'pro.themeOcean' },
}

export default function ThemeCard() {
  const { theme, setThemeExplicit, can, isPro, toast } = useCrm()
  const { t } = useT()
  const proThemes = can?.('themes') || isPro?.()

  const pick = id => {
    if (id === 'ocean' && !proThemes) {
      toast?.(t('pro.themeOceanLocked'), 'warn')
      return
    }
    setThemeExplicit?.(id)
  }

  return (
    <Card className="p-5 mb-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: '#818cf81c', color: 'var(--t-indigo)' }}>
          <Palette size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[14.5px] flex items-center gap-2 flex-wrap">
            {t('pro.themesTitle')}
            {!proThemes && <ProBadge />}
          </div>
          <div className="text-[11.5px]" style={{ color: 'var(--faint)' }}>{t('pro.themesSub')}</div>
        </div>
        <Pill color={proThemes ? '#34d399' : '#94a3b8'}>{proThemes ? 'Pro' : 'Free'}</Pill>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4">
        {Object.entries(SWATCHES).map(([id, s]) => {
          const locked = id === 'ocean' && !proThemes
          const on = theme === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => pick(id)}
              className="text-left rounded-xl p-3 transition-transform hover:scale-[1.01] active:scale-[.99]"
              style={{
                background: s.bg,
                color: s.fg,
                border: on ? `2px solid ${s.accent}` : '1px solid var(--border)',
                boxShadow: on ? `0 0 0 3px ${s.accent}33` : 'none',
                opacity: locked ? 0.72 : 1,
              }}
              title={locked ? t('pro.themeOceanLocked') : t(s.labelKey)}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[12.5px] font-bold">{t(s.labelKey)}</span>
                {locked ? <Lock size={13} style={{ color: s.fg, opacity: .7 }} />
                  : on ? <Check size={14} style={{ color: s.accent }} /> : null}
              </div>
              <div className="flex gap-1.5">
                <span className="w-5 h-5 rounded-full" style={{ background: s.accent }} />
                <span className="w-5 h-5 rounded-full" style={{ background: s.fg, opacity: .35 }} />
                <span className="w-5 h-5 rounded-full border" style={{ background: s.bg, borderColor: s.fg + '44' }} />
              </div>
              {locked && (
                <div className="text-[10.5px] mt-2 font-semibold" style={{ color: s.accent }}>
                  {t('pro.unlockCta')} →
                </div>
              )}
            </button>
          )
        })}
      </div>

      {!proThemes && (
        <p className="text-[12px] mt-3 leading-snug" style={{ color: 'var(--muted)' }}>
          {t('pro.themesHint')}{' '}
          <Link to="/pro" className="font-semibold underline decoration-dotted underline-offset-2" style={{ color: 'var(--t-indigo)' }}>
            {t('pro.unlockCta')}
          </Link>
        </p>
      )}
    </Card>
  )
}
