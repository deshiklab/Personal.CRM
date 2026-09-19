import { chromium } from 'playwright'
const BASE = 'http://localhost:5173'
const fails = []
const ok = m => console.log('  ✓ ' + m)
const bad = m => { console.log('  ✗ ' + m); fails.push(m) }

const b = await chromium.launch()
const pg = await (await b.newContext()).newPage()
const errors = []
pg.on('pageerror', e => errors.push('pageerror: ' + e.message))
pg.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

// 1. Integrations — subscribe to REAL local .ics feed
await pg.goto(BASE + '/#/integrations'); await pg.waitForTimeout(1500)
await pg.fill('input[placeholder*="calendar.google.com"]', BASE + '/test.ics')
await pg.click('button:has-text("Subscribe & sync")')
await pg.waitForTimeout(2500)
const feedTxt = await pg.locator('text=2 feed events').count()
feedTxt ? ok('ICS feed subscribed + synced: "2 feed events"') : bad('feed sync row missing')
if (!(await pg.locator('text=DEMO').count())) ok('board has no DEMO pill')
else bad('board still shows DEMO')
if ((await pg.locator('text=r.getMonth? no').count()) >= 0) {}
const gmailOff = await pg.locator('text=OFF — set your Client ID').count()
gmailOff ? ok('Gmail row honest OFF') : bad('Gmail row text wrong')

// 2. Calendar — feed events landed
await pg.goto(BASE + '/#/calendar'); await pg.waitForTimeout(1500)
const ev = await pg.locator('text=Team standup').count()
ev ? ok('"Team standup (from feed)" appears on Calendar') : bad('feed event not on calendar')
const ev2 = await pg.locator('text=Product review').count()
ev2 ? ok('"Product review (from feed)" (all-day) appears') : bad('all-day feed event missing')

// 3. Settings — no demo claims, sync button routes to setup
await pg.goto(BASE + '/#/settings'); await pg.waitForTimeout(1500)
const body = await pg.textContent('body')
/DEMO/i.test(body) ? bad('settings still says DEMO') : ok('settings has no DEMO wording')
const setupPill = await pg.locator('text=SETUP NEEDED').count()
setupPill ? ok('Google hub shows SETUP NEEDED') : bad('setup pill missing')

// 4. Email — honest cards
await pg.goto(BASE + '/#/email'); await pg.waitForTimeout(1500)
const setupBtn = await pg.locator('button:has-text("Set up live mode")').count()
setupBtn ? ok('Gmail card offers "Set up live mode"') : bad('gmail setup button missing')
const soon = await pg.locator('text=Coming soon').count()
soon ? ok('Outlook card says Coming soon') : bad('outlook coming-soon missing')
const sim = await pg.locator('text=Simulated').count()
!sim ? ok('no "Simulated OAuth" claim') : bad('Simulated OAuth still shown')

// 5. Click Gmail connect w/o client id → honest toast
if ((await pg.locator('button:has-text("Set up live mode")').count())) {
  await pg.click('button:has-text("Set up live mode")'); await pg.waitForTimeout(1200)
  pg.url().includes('settings') ? ok('"Set up live mode" routes to Settings') : bad('setup button route wrong')
}

errors.length ? bad('console/page errors: ' + errors.join(' | ')) : ok('zero page errors')
console.log(fails.length ? `\nFAILURES: ${fails.length}` : '\nALL GREEN')
await b.close()
process.exit(fails.length ? 1 : 0)
