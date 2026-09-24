/* End-to-end test of registration + owner notification + verification.
 * Requires the throwaway notify server on :5199 and a build whose
 * NOTIFY_CONFIG points at it (see test-notify-server.mjs). */
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const NOTIFY = 'http://localhost:5199'
let pass = 0, fail = 0
const ok = (n, c, extra = '') => { c ? (pass++, console.log('  ✓', n)) : (fail++, console.log('  ✗', n, extra)) }
const lastNotify = async () => (await fetch(`${NOTIFY}/last`)).json()
const resetNotify = () => fetch(`${NOTIFY}/reset`)

const b = await chromium.launch()
const ctx = await b.newContext()
const pg = await ctx.newPage()
const errors = []
pg.on('pageerror', e => errors.push(e.message))
pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

await resetNotify()

/* ── 1. registration fires the owner notification ── */
await pg.goto(BASE + '/#/'); await pg.waitForTimeout(1300)
ok('registration window first', (await pg.locator('text=Welcome to Personal CRM').count()) > 0)

// validation
await pg.locator('input[placeholder="e.g. BiTsCol"]').fill('A')
await pg.locator('input[type="email"]').first().fill('nope')
await pg.locator('button:has-text("Continue")').click(); await pg.waitForTimeout(400)
ok('too-short name rejected', (await pg.locator('text=at least 2 characters').count()) > 0)
await pg.locator('input[placeholder="e.g. BiTsCol"]').fill('Nadia Rahman')
await pg.locator('button:has-text("Continue")').click(); await pg.waitForTimeout(400)
ok('malformed email rejected', (await pg.locator('text=valid email address').count()) > 0)

await pg.locator('input[placeholder="e.g. BiTsCol"]').fill('Nadia Rahman')
await pg.locator('input[type="email"]').first().fill('nadia@example.com')
await pg.locator('input[type="tel"]').first().fill('+880 1700-000777')
await pg.locator('button:has-text("Continue")').click(); await pg.waitForTimeout(1400)

const reg = await lastNotify()
ok('owner notified of registration', reg?.type === 'registration', JSON.stringify(reg)?.slice(0, 120))
ok('notification carries the name', reg?.name === 'Nadia Rahman', reg?.name)
ok('notification carries the email', reg?.email === 'nadia@example.com', reg?.email)
ok('notification carries the mobile', reg?.mobile === '+880 1700-000777', reg?.mobile)
ok('notification addressed to owner', reg?.to === 'sales@bitscol.com', reg?.to)

/* ── 2. pin skip → app, greeting uses the first name ── */
const skip = pg.locator('button:has-text("Skip for now")')
if (await skip.count()) { await skip.first().click(); await pg.waitForTimeout(900) }
const dash = await pg.locator('body').textContent()
ok('greeting shows the registered first name', dash.includes('Good day,') && dash.includes('Nadia'), dash.slice(0, 80))
ok('greeting no longer says BiTsCol', !dash.includes('Good day, BiTsCol'))
ok('sidebar shows personal workspace', (await pg.locator('aside').first().textContent()).includes("Nadia's workspace"))

/* ── 3. verification: request → owner gets the code → user confirms ── */
await pg.goto(BASE + '/#/settings'); await pg.waitForTimeout(1100)
await resetNotify()
await pg.locator('button:has-text("Send me a code")').first().click()
await pg.waitForTimeout(1500)

const ver = await lastNotify()
ok('verification request reached the owner', ver?.type === 'verification', JSON.stringify(ver)?.slice(0, 140))
ok('request includes a 6-digit code', /^\d{6}$/.test(String(ver?.code || '')), String(ver?.code))
ok('request says which channel', ver?.kind === 'email', ver?.kind)
ok('UI confirms the code was sent', (await pg.locator('text=Code sent').count()) > 0)

// code is never shown to the user, and only a hash is stored
const stored = await pg.evaluate(() => JSON.parse(localStorage.getItem('pcrm-v1')).profile)
ok('code not stored in plaintext', !JSON.stringify(stored).includes(ver.code), 'code leaked into storage')
ok('only a salted hash is stored', !!stored.pendingCode?.hash && stored.pendingCode.hash.length > 20)

// wrong code is rejected
await pg.locator('input[aria-label="email verification code"]').fill('000000')
await pg.locator('button:has-text("Confirm code")').first().click(); await pg.waitForTimeout(900)
ok('wrong code rejected', (await pg.locator('text=wrong or has expired').count()) > 0)
let prof = await pg.evaluate(() => JSON.parse(localStorage.getItem('pcrm-v1')).profile)
ok('still unverified after wrong code', !prof.verified?.email)

// right code verifies
await pg.locator('input[aria-label="email verification code"]').fill(String(ver.code))
await pg.locator('button:has-text("Confirm code")').first().click(); await pg.waitForTimeout(1200)
ok('correct code verifies the email', (await pg.locator('text=Verified').count()) > 0)
prof = await pg.evaluate(() => JSON.parse(localStorage.getItem('pcrm-v1')).profile)
ok('verified timestamp recorded', !!prof.verified?.email, JSON.stringify(prof.verified))
ok('pending code cleared', !prof.pendingCode)

/* ── 4. mobile verification on the same pattern ── */
await resetNotify()
await pg.locator('button:has-text("Send me a code")').last().click(); await pg.waitForTimeout(1400)
const ver2 = await lastNotify()
ok('mobile code issued', ver2?.kind === 'mobile' && /^\d{6}$/.test(String(ver2?.code)), String(ver2?.code))
await pg.locator('input[aria-label="mobile verification code"]').fill(String(ver2.code))
await pg.locator('button:has-text("Confirm code")').last().click(); await pg.waitForTimeout(1100)
prof = await pg.evaluate(() => JSON.parse(localStorage.getItem('pcrm-v1')).profile)
ok('mobile verified', !!prof.verified?.mobile)

/* ── 5. registration notification status surfaced in Settings ── */
ok('owner notification status shown', (await pg.locator('text=sent to BITSCOL').count()) > 0)

/* ── 6. no runtime errors ── */
ok('zero page errors', errors.length === 0, errors.slice(0, 2).join(' | '))

console.log(`\n${fail === 0 ? 'ALL GREEN' : 'FAILURES'} — ${pass} passed, ${fail} failed`)
await b.close()
process.exit(fail ? 1 : 0)
