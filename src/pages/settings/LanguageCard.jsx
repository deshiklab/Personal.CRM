import { Languages } from 'lucide-react'
import { useCrm } from '../../store'
import { Card, Pill } from '../../components/ui'
import { useT, LOCALES } from '../../lib/i18n'

export default function LanguageCard() {
  const { helpPrefs, setLocale } = useCrm()
  const { t, locale } = useT()
  const current = helpPrefs?.locale === 'bn' ? 'bn' : 'en'

  return (
    <Card className="p-5 mb-4" data-tour="language">
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center"
          style={{ background: 'rgba(129,140,248,.16)', color: 'var(--t-sky)' }}>
          <Languages size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px]">{t('settings.language')}</div>
          <div className="text-[11.5px] leading-snug" style={{ color: 'var(--faint)' }}>
            {t('settings.languageSub')}
          </div>
        </div>
        <Pill color="#818cf8">{current === 'bn' ? 'বাংলা' : 'EN'}</Pill>
      </div>
      <div className="flex flex-wrap gap-2">
        {LOCALES.map(l => {
          const active = current === l.id
          return (
            <button key={l.id} type="button"
              className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`}
              aria-pressed={active}
              onClick={() => setLocale(l.id)}>
              <span className="font-extrabold">{l.native}</span>
              <span className="opacity-70 text-[11px] ml-1">{l.label !== l.native ? l.label : ''}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
