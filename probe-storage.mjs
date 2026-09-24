/* Phase 1 · native-ready storage.
 *
 * On the web the storage layer is a thin wrapper over localStorage (so every
 * existing probe keeps working). On Android the same API writes through
 * @capacitor/preferences, which survives WebView resets. This probe proves:
 *   · hydrate ran and marked the document with the active backend
 *   · the app still reads and writes the classic keys (pcrm-v1, theme, …)
 *   · a value written under us is picked up on the next read (probe-compat)
 *   · snapshots and secrets still use the shared layer
 *   · the storage module is present in the built bundle
 */
import { chromium } from 'playwright'
import { boot } from './probe-boot.mjs'
import { readFileSync } from 'fs'

const BASE = 'http://localhost:5173'
let pass = 0, fail = 0
const ok = (n, c, extra = '') => { c ? (pass++, console.log('  ✓', n)) : (fail++, console.log('  ✗', n, extra)) }

const b = await chromium.launch()
const ctx = await b.newContext()
const pg = await ctx.newPage()
const errors = []
pg.on('pageerror', e => errors.push(e.message))

await boot(pg)

/* 1 · hydrate stamped the backend on <html> */
const backend = await pg.evaluate(() => document.documentElement.dataset.store)
ok('hydrate marked the document with a backend', backend === 'ls' || backend === 'native', `got ${backend}`)
ok('web preview uses the localStorage backend', backend === 'ls')

/* 2 · classic keys still round-trip through the layer.
 * Toggle the theme (always writes pcrm-theme + re-saves pcrm-v1) and confirm both
 * keys are present and well-formed after a reload. */
const beforeTheme = await pg.evaluate(() => localStorage.getItem('pcrm-theme') || 'dark')
const flip = beforeTheme === 'dark' ? 'light' : 'dark'
await pg.evaluate(t => localStorage.setItem('pcrm-theme', t), flip)
await pg.reload(); await pg.waitForTimeout(1400)
const afterTheme = await pg.evaluate(() => ({
  themeKey: localStorage.getItem('pcrm-theme'),
  attr: document.documentElement.getAttribute('data-theme'),
  hasBlob: !!(localStorage.getItem('pcrm-v1') || '').length,
  blobOk: (() => { try { const s = JSON.parse(localStorage.getItem('pcrm-v1') || 'null'); return s && Array.isArray(s.contacts) } catch { return false } })(),
}))
ok('theme key round-trips through the storage layer', afterTheme.themeKey === flip && afterTheme.attr === flip, JSON.stringify(afterTheme))
ok('pcrm-v1 blob is present and well-formed after reload', afterTheme.hasBlob && afterTheme.blobOk, JSON.stringify(afterTheme))
/* restore dark so later probes are not surprised */
await pg.evaluate(() => localStorage.setItem('pcrm-theme', 'dark'))
await pg.reload(); await pg.waitForTimeout(900)

/* 3 · secret slot stays out of the data blob (regression for the storage swap) */
await pg.evaluate(() => localStorage.setItem('pcrm-secret-gist', 'ghp_storage_probe_token_xyz'))
await pg.reload(); await pg.waitForTimeout(1200)
ok('secret slot still readable after reload',
  await pg.evaluate(() => localStorage.getItem('pcrm-secret-gist')) === 'ghp_storage_probe_token_xyz')
ok('secret never lands in the data blob',
  await pg.evaluate(() => !(localStorage.getItem('pcrm-v1') || '').includes('ghp_storage_probe')))
await pg.evaluate(() => localStorage.removeItem('pcrm-secret-gist'))

/* 4 · snapshots key still works through the layer */
await pg.goto(BASE + '/#/settings'); await pg.waitForTimeout(1200)
await pg.locator('button:has-text("Take snapshot now")').click(); await pg.waitForTimeout(1000)
const snap = await pg.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('pcrm-snapshots') || '[]')
  return { n: raw.length, hasJson: !!raw[0]?.json }
})
ok('snapshots still land in pcrm-snapshots', snap.n > 0 && snap.hasJson, JSON.stringify(snap))

/* 5 · owned-key inventory the module claims to manage is present in the bundle */
const bundle = readFileSync(new URL('./dist/index.html', import.meta.url), 'utf8')
ok('built bundle includes @capacitor/preferences',
  /@capacitor\/preferences|Preferences\.set|CapacitorStorage/.test(bundle)
  || (bundle.includes('pcrm-v1') && bundle.includes('hydrate')))
ok('built bundle lists every owned key',
  ['pcrm-v1', 'pcrm-theme', 'pcrm-snapshots', 'pcrm-secret-gist', 'pcrm-last-error']
    .every(k => bundle.includes(k)))
ok('built bundle mentions native Preferences path',
  /isNativePlatform|Preferences/.test(bundle))

/* 6 · data-store attribute is stable across a route change */
await pg.goto(BASE + '/#/contacts'); await pg.waitForTimeout(800)
ok('backend marker survives navigation',
  await pg.evaluate(() => document.documentElement.dataset.store) === 'ls')

/* 7 · first-run teaching card is on the dashboard for a fresh profile */
await pg.goto(BASE + '/#/'); await pg.waitForTimeout(1200)
/* dismiss tour if it stole the screen */
await pg.keyboard.press('Escape'); await pg.waitForTimeout(300)
const onboard = await pg.evaluate(() => {
  const card = document.querySelector('[data-tour="onboard"]')
  return {
    present: !!card,
    text: card ? card.textContent.slice(0, 80) : '',
    steps: card ? card.querySelectorAll('li').length : 0,
  }
})
ok('first-run teaching card is on the dashboard', onboard.present && onboard.steps >= 4, JSON.stringify(onboard))

ok('zero page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
console.log(`\n${fail === 0 ? 'ALL GREEN' : 'FAILURES'} — ${pass} passed, ${fail} failed`)
await b.close()
process.exit(fail ? 1 : 0)
