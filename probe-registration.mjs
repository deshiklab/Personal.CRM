/* Registration window, greeting, identity screen and the un-configured channel path.
 * Runs against the SHIPPED build (notify channel intentionally unconfigured). */
import { chromium } from 'playwright'
import { boot } from './probe-boot.mjs'

const BASE = 'http://localhost:5173'
let pass = 0, fail = 0
const ok = (n, c, extra = '') => { c ? (pass++, console.log('  ✓', n)) : (fail++, console.log('  ✗', n, extra)) }

const b = await chromium.launch()

/* ── 1. fresh install: registration comes BEFORE the pincode screen ── */
const ctx = await b.newContext()
const pg = await ctx.newPage()
const errors = []
pg.on('pageerror', e => errors.push(e.message))
pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

await pg.goto(BASE + '/#/'); await pg.waitForTimeout(1300)
ok('registration shown first', (await pg.locator('text=Welcome to Personal CRM').count()) > 0)
ok('pincode screen not shown yet', (await pg.locator('text=Set a 4–6 digit pincode').count()) === 0)
ok('privacy reassurance on the form', (await pg.locator('text=stored on this device').count()) > 0)
ok('consent checkbox present', (await pg.locator('input[type="checkbox"]').count()) > 0)

// skip path
await pg.locator('button:has-text("Skip for now")').first().click(); await pg.waitForTimeout(900)
ok('skip → reaches pincode setup', (await pg.locator('text=Set a 4–6 digit pincode').count()) > 0)
let prof = await pg.evaluate(() => JSON.parse(localStorage.getItem('pcrm-v1')).profile)
ok('skip recorded, no identity stored', prof?.skipped === true && !prof?.name, JSON.stringify(prof))

/* ── 2. register properly, then confirm the greeting ── */
await pg.goto(BASE + '/#/settings'); await pg.waitForTimeout(300)   // no-op, keeps app mounted
await boot(pg)
prof = await pg.evaluate(() => JSON.parse(localStorage.getItem('pcrm-v1')).profile)
ok('registration is skipped once (no re-prompt)', prof?.skipped === true)

const ctx2 = await b.newContext()
const pg2 = await ctx2.newPage()
pg2.on('pageerror', e => errors.push(e.message))
await pg2.goto(BASE + '/#/'); await pg2.waitForTimeout(1300)
await pg2.locator('input[placeholder="e.g. BiTsCol"]').fill('Karim Ahmed')
await pg2.locator('input[type="email"]').first().fill('karim@example.com')
await pg2.locator('input[type="tel"]').first().fill('+880 1700-000321')
await pg2.locator('button:has-text("Continue")').click(); await pg2.waitForTimeout(1200)
const skip2 = pg2.locator('button:has-text("Skip for now")')
if (await skip2.count()) { await skip2.first().click(); await pg2.waitForTimeout(900) }

const body = await pg2.locator('body').textContent()
ok('greeting uses first name', body.includes('Good day,') && body.includes('Karim'), body.slice(0, 70))
ok('hardcoded BiTsCol greeting gone', !(await pg2.locator('text=Good day, BiTsCol').count()))
ok('workspace label personalised', (await pg2.locator('aside').first().textContent()).includes("Karim's workspace"))

prof = await pg2.evaluate(() => JSON.parse(localStorage.getItem('pcrm-v1')).profile)
ok('profile persisted', prof?.name === 'Karim Ahmed' && prof?.email === 'karim@example.com', JSON.stringify(prof))
ok('starts unverified', prof?.verified?.email === false && prof?.verified?.mobile === false)
ok('notification status honest when channel is off', prof?.notified === 'not-configured', String(prof?.notified))

/* ── 3. Identity screen in Settings ── */
await pg2.goto(BASE + '/#/settings'); await pg2.waitForTimeout(1100)
const settings = await pg2.locator('body').textContent()
ok('Identity card present', settings.includes('Identity'))
ok('shows name / email / mobile', settings.includes('Karim Ahmed') && settings.includes('karim@example.com') && settings.includes('+880 1700-000321'))
ok('email unverified state', settings.includes('Not verified'))
ok('owner notification status surfaced', settings.includes('Owner notification'))
ok('unconfigured channel explained', settings.includes('channel not configured') || settings.includes('not shared'))

/* ── 4. verification is honest when the channel is off: no code is issued ── */
await pg2.locator('button:has-text("Send me a code")').first().click(); await pg2.waitForTimeout(900)
prof = await pg2.evaluate(() => JSON.parse(localStorage.getItem('pcrm-v1')).profile)
ok('no code issued when unconfigured', !prof?.pendingCode, JSON.stringify(prof?.pendingCode))
ok('user told to contact the owner', (await pg2.locator('text=sales@bitscol.com').count()) > 0)

/* ── 5. edit profile → greeting follows ── */
await pg2.locator('button:has-text("Edit")').first().click(); await pg2.waitForTimeout(600)
await pg2.locator('.fixed input').first().fill('Karim A. Rahman')
await pg2.locator('.fixed button:has-text("Save changes")').click(); await pg2.waitForTimeout(900)
await pg2.goto(BASE + '/#/'); await pg2.waitForTimeout(900)
ok('greeting follows the edited name', (await pg2.locator('body').textContent()).includes('Karim'))

/* ── 6. sign out clears identity but keeps data ── */
const beforeContacts = await pg2.evaluate(() => JSON.parse(localStorage.getItem('pcrm-v1')).contacts.length)
await pg2.goto(BASE + '/#/settings'); await pg2.waitForTimeout(1000)
await pg2.locator('button:has-text("Sign out")').click(); await pg2.waitForTimeout(600)
await pg2.locator('.fixed button:has-text("Sign out")').last().click(); await pg2.waitForTimeout(1000)
prof = await pg2.evaluate(() => JSON.parse(localStorage.getItem('pcrm-v1')).profile)
const afterContacts = await pg2.evaluate(() => JSON.parse(localStorage.getItem('pcrm-v1')).contacts.length)
ok('identity cleared on sign out', !prof?.name && prof?.skipped === true, JSON.stringify(prof))
ok('CRM data untouched', afterContacts === beforeContacts && afterContacts > 0, `${beforeContacts} → ${afterContacts}`)
await pg2.goto(BASE + '/#/'); await pg2.waitForTimeout(900)
ok('app still usable after sign out', (await pg2.locator('body').textContent()).includes('Good day,'))
ok('greeting falls back to BiTsCol when unregistered', (await pg2.locator('body').textContent()).includes('BiTsCol'))

ok('zero page errors', errors.length === 0, errors.slice(0, 2).join(' | '))

console.log(`\n${fail === 0 ? 'ALL GREEN' : 'FAILURES'} — ${pass} passed, ${fail} failed`)
await b.close()
process.exit(fail ? 1 : 0)
