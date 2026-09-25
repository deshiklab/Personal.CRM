/* ═══════════════════════════════════════════════════════════════════════════
 * Locale pack — en + bn (Bangla). 100% local, no CDN.
 *
 *   const { t, locale, setLocale } = useT()
 *   t('nav.dashboard')
 *   t('dash.greeting', { name: firstName })
 *
 * Store: helpPrefs.locale ('en' | 'bn'). Missing keys fall back to English.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { createContext, useContext, useMemo } from 'react'
import en from '../locales/en'
import bn from '../locales/bn'

export const LOCALES = [
  { id: 'en', label: 'English', native: 'English', dir: 'ltr' },
  { id: 'bn', label: 'Bangla', native: 'বাংলা', dir: 'ltr' },
]

const CATALOGS = { en, bn }

const get = (obj, path) => {
  if (!obj || !path) return undefined
  const parts = String(path).split('.')
  let cur = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[p]
  }
  return cur
}

const interpolate = (str, vars) => {
  if (!vars || typeof str !== 'string') return str
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? `{${k}}` : String(vars[k])))
}

export function t(key, vars, locale = 'en') {
  const loc = CATALOGS[locale] ? locale : 'en'
  let val = get(CATALOGS[loc], key)
  if (val == null && loc !== 'en') val = get(CATALOGS.en, key)
  if (val == null) return typeof key === 'string' ? key : ''
  if (typeof val === 'string') return interpolate(val, vars)
  return val
}

export function localeTag(locale = 'en') {
  return locale === 'bn' ? 'bn-BD' : 'en-US'
}

export function formatDate(d, locale = 'en', opts) {
  try {
    return new Date(d).toLocaleDateString(localeTag(locale), opts || { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    return String(d)
  }
}

const I18nCtx = createContext(null)

export function I18nProvider({ locale = 'en', setLocale, children }) {
  const value = useMemo(() => {
    const loc = CATALOGS[locale] ? locale : 'en'
    return {
      locale: loc,
      setLocale: (id) => setLocale?.(CATALOGS[id] ? id : 'en'),
      t: (key, vars) => t(key, vars, loc),
      formatDate: (d, opts) => formatDate(d, loc, opts),
      locales: LOCALES,
    }
  }, [locale, setLocale])
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export function useT() {
  const ctx = useContext(I18nCtx)
  if (ctx) return ctx
  return {
    locale: 'en',
    setLocale: () => {},
    t: (key, vars) => t(key, vars, 'en'),
    formatDate: (d, opts) => formatDate(d, 'en', opts),
    locales: LOCALES,
  }
}
