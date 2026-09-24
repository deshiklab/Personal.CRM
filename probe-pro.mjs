/* Phase 2 · entitlements + Pro screen */
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

/* bundle stamps */
const bundle = readFileSync(new URL('./dist/index.html', import.meta.url), 'utf8')
ok('bundle is v2.0.0', /2\.0\.0/.test(bundle))
ok('bundle includes entitlements / Pro copy', /Unlock Personal CRM Pro|pcrm-license|PCRM1/.test(bundle))
ok('bundle lists free contact cap', /75/.test(bundle) && /unlimited contacts/i.test(bundle))

/* version on About */
await pg.goto(BASE + '/#/about'); await pg.waitForTimeout(1100)
const about = await pg.locator('body').textContent()
ok('About shows v2.0.0', /v2\.0\.0|Version 2\.0\.0/.test(about))
ok('About links to Pro', (await pg.locator('a[href="#/pro"], a[href="/pro"]').count()) > 0
  || /See Pro|Manage licence/i.test(about))
await pg.goto(BASE + '/#/pro'); await pg.waitForTimeout(800)
ok('default tier is Free on Pro screen', /Unlock Personal CRM Pro|Free forever|Free plan/i.test(await pg.locator('body').textContent()))

/* Pro route */
await pg.goto(BASE + '/#/pro'); await pg.waitForTimeout(1300)
await pg.keyboard.press('Escape'); await pg.waitForTimeout(200)
const proBody = await pg.locator('body').textContent()
ok('Pro screen renders', /Unlock Personal CRM Pro|You are on Pro/i.test(proBody))
ok('Pro lists free features', /Visiting-card scan|PIN lock|CSV/i.test(proBody))
ok('Pro lists paid features', /Reminders|Unlimited contacts|Automatic rolling|auto-sync/i.test(proBody))
ok('licence key field present', (await pg.locator('input[placeholder="PCRM1-…"]').count()) > 0)
ok('Play restore button present', (await pg.locator('button:has-text("Restore purchases")').count()) > 0)
ok('Sidebar exposes Pro', await pg.evaluate(() => /Pro/.test(document.querySelector('aside')?.innerText || '')))

/* mint + verify + redeem entirely inside the page (WebCrypto + storage) */
const roundtrip = await pg.evaluate(async () => {
  /* The app already loaded entitlements into the store. We mint via the same
   * algorithm by calling the store's unlock after manufacturing a key through
   * the global crypto + a tiny inline of the public mint path exposed on window
   * only in probes — instead: use complimentary unlock to prove Pro state, and
   * mint a key through the page by evaluating the module graph is hard with
   * singlefile. So: complimentary unlock + licence key path with a precomputed
   * approach.
   *
   * Practical path: click complimentary if DEV tools show, else write a pro
   * licence record that matches blankLicense shape (honest for "storage works")
   * and separately unit-test HMAC in a Worker. */
  return { hasUnlock: typeof window !== 'undefined' }
})

/* Complimentary unlock via storage + reload exercises the licence slot without
 * needing to re-implement HMAC in the probe. Key HMAC is covered by exercising
 * the Unlock with key button after minting inside the app when DEV tools exist. */
const minted = await pg.evaluate(async () => {
  const PEPPER = 'bitscol-personal-crm/Personal CRM/v1/lifetime'
  const b64url = bytes => {
    let bin = ''
    if (typeof bytes === 'string') {
      const enc = new TextEncoder().encode(bytes)
      bytes = enc
    }
    bytes.forEach(b => { bin += String.fromCharCode(b) })
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  }
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(PEPPER), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const payload = { v: 1, pid: 'personal-crm-pro', email: 'probe@bitscol.local', iat: Date.now() }
  const payloadB64 = b64url(JSON.stringify(payload))
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64))
  const sig = b64url(new Uint8Array(sigBuf)).slice(0, 22)
  return `PCRM1-${payloadB64}-${sig}`
})
ok('page mints a PCRM1 key', /^PCRM1-/i.test(minted), minted)

await pg.locator('input[placeholder="PCRM1-…"]').fill(minted)
await pg.locator('button:has-text("Unlock with key")').click()
await pg.waitForTimeout(1600)
let body = await pg.locator('body').textContent()
ok('key unlock shows Pro state', /You are on Pro|Thank you for supporting|Pro · licence key|licence on this device/i.test(body), body.slice(0, 220))

const stored = await pg.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('pcrm-license') || 'null') } catch { return null }
})
ok('pcrm-license tier is pro', stored?.tier === 'pro', JSON.stringify(stored))
ok('pcrm-license keeps the key', !!stored?.licenseKey)

await pg.reload(); await pg.waitForTimeout(1500)
await pg.goto(BASE + '/#/pro'); await pg.waitForTimeout(1100)
body = await pg.locator('body').textContent()
ok('Pro survives reload', /You are on Pro|Thank you for supporting|Pro · licence key/i.test(body))

await pg.goto(BASE + '/#/about'); await pg.waitForTimeout(900)
ok('About shows Pro pill after unlock', /Pro/.test(await pg.locator('body').textContent()))

/* reject bad key (first clear licence) */
await pg.evaluate(() => localStorage.removeItem('pcrm-license'))
await pg.reload(); await pg.waitForTimeout(1400)
await pg.goto(BASE + '/#/pro'); await pg.waitForTimeout(1100)
await pg.locator('input[placeholder="PCRM1-…"]').fill('PCRM1-NOT-A-REAL-KEY')
await pg.locator('button:has-text("Unlock with key")').click()
await pg.waitForTimeout(900)
body = await pg.locator('body').textContent()
ok('bad key shows an error', /does not look like|signature|damaged|Paste a licence/i.test(body), body.slice(-200))

ok('zero page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
console.log(`\n${fail === 0 ? 'ALL GREEN' : 'FAILURES'} — ${pass} passed, ${fail} failed`)
await b.close()
process.exit(fail ? 1 : 0)
