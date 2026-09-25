# Locale pack (en / bn)

**Where:** Settings → **Language** (right under Identity)

| Code | Label | Tag |
|---|---|---|
| `en` | English | `en` / `en-US` |
| `bn` | বাংলা (Bangla) | `bn` / `bn-BD` |

## What is translated

- Sidebar navigation + sync status
- Topbar page titles + common actions
- Dashboard greeting, checklist, customize
- Welcome window (all setup paths)
- Post-tour demo keep/wipe dialog
- Settings language card itself

## What stays English (for now)

- Knowledge-base article bodies (long form)
- Most Settings hub deep copy (Google/Gist steps)
- Sample/demo person names
- Toast strings from store helpers (partial)

Missing keys fall back to English automatically.

## Code

- `src/lib/i18n.jsx` — `t`, `useT`, `I18nProvider`, `LOCALES`
- `src/locales/en.js` / `bn.js`
- Preference: `helpPrefs.locale` (`'en'` | `'bn'`) via `setLocale`
- `<html lang>` updates with the choice

## Adding a key

1. Add under the same path in **both** catalogs  
2. Use `const { t } = useT()` then `t('nav.contacts')` or `t('dash.greeting', { name })`  
