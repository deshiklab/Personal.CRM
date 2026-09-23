import { chromium } from 'playwright'
const BASE = 'http://localhost:5173'
const fails = []
const ok = m => console.log('  ✓ ' + m)
const bad = m => { console.log('  ✗ ' + m); fails.push(m) }
const b = await chromium.launch()
const ctx = await b.newContext()
const pg = await ctx.newPage()
const errs = []
pg.on('pageerror', e => errs.push(e.message))

const dots = () => pg.locator('input[placeholder="••••"]')
const fillPin = async v => { await dots().nth(0).fill(v) }
const dashboardVisible = async () => (await pg.locator('text=Dashboard').count()) > 0

// 1. first launch → setup screen
await pg.goto(BASE + '/#/'); await pg.waitForTimeout(1200)
;(await pg.locator('text=Set a 4–6 digit pincode').count()) ? ok('first launch shows pincode setup') : bad('setup screen missing')

// 2. mismatched pins rejected
await dots().nth(0).fill('1234'); await dots().nth(1).fill('1239')
await pg.click('button:has-text("Set pincode & start")'); await pg.waitForTimeout(600)
;(await pg.locator('text=do not match').count()) ? ok('mismatch rejected') : bad('mismatch allowed')

// 3. matching pin → dashboard
await dots().nth(0).fill('1234'); await dots().nth(1).fill('1234')
await pg.click('button:has-text("Set pincode & start")'); await pg.waitForTimeout(1200)
;(await dashboardVisible()) ? ok('pin set → entered app') : bad('did not enter app')

// 4. real reload → unlock required
await pg.reload(); await pg.waitForTimeout(1300)
;(await pg.locator('text=This app is locked').count()) ? ok('reload asks unlock') : bad('unlock screen missing')

// 5. wrong pin → error; right pin → in
await fillPin('9999'); await pg.click('button:has-text("Unlock")'); await pg.waitForTimeout(700)
;(await pg.locator('text=Wrong pincode').count()) ? ok('wrong pin rejected') : bad('wrong pin accepted?!')
await fillPin('1234'); await pg.click('button:has-text("Unlock")'); await pg.waitForTimeout(1200)
;(await dashboardVisible()) ? ok('correct pin unlocks') : bad('no unlock')

// 6. lock now relocks instantly
await pg.goto(BASE + '/#/settings'); await pg.waitForTimeout(1200)
;(await pg.locator('text=LOCKED ON START').count()) ? ok('settings shows lock on') : bad('status missing')
await pg.click('button:has-text("Lock now")'); await pg.waitForTimeout(800)
;(await pg.locator('text=This app is locked').count()) ? ok('Lock now works') : bad('lock-now failed')
await fillPin('1234'); await pg.click('button:has-text("Unlock")'); await pg.waitForTimeout(1100)

// 7. change pincode: wrong current rejected
await pg.click('button:has-text("Change pincode")'); await pg.waitForTimeout(600)
let inputs = pg.locator('.fixed input')
await inputs.nth(0).fill('0000'); await inputs.nth(1).fill('5678'); await inputs.nth(2).fill('5678')
await pg.locator('.fixed button:has-text("Confirm")').click(); await pg.waitForTimeout(900)
let body = await pg.textContent('body')
body.includes('Current pincode is wrong') ? ok('change with wrong current rejected') : bad('wrong current accepted')

// 8. change with right current
await inputs.nth(0).fill('1234')
await pg.locator('.fixed button:has-text("Confirm")').click(); await pg.waitForTimeout(900)
body = await pg.textContent('body')
!(await pg.locator('.fixed').count()) || body.includes('Pincode changed') ? ok('pincode changed') : bad('change failed')

// 9. factory reset: wrong pin stays; right pin wipes → blank + fresh setup
await pg.click('button:has-text("Wipe everything…")'); await pg.waitForTimeout(600)
await pg.locator('.fixed input').fill('0000')
await pg.locator('.fixed button:has-text("Wipe everything")').click(); await pg.waitForTimeout(900)
body = await pg.textContent('body')
body.includes('Pincode is wrong') ? ok('wipe with wrong pin rejected') : bad('wipe with wrong pin went through')
await pg.locator('.fixed input').fill('5678')
await pg.locator('.fixed button:has-text("Wipe everything")').click(); await pg.waitForTimeout(2200)
body = await pg.textContent('body')
;(await pg.locator('text=Set a 4–6 digit pincode').count()) ? ok('factory reset → fresh setup screen') : bad('no setup after wipe')
await pg.goto(BASE + '/#/contacts'); await pg.waitForTimeout(900)

// 10. skip flow on a fresh context: setup → skip → never again
const ctx2 = await b.newContext()
const pg2 = await ctx2.newPage()
await pg2.goto(BASE + '/#/'); await pg2.waitForTimeout(1200)
await pg2.click('text=Skip for now'); await pg2.waitForTimeout(900)
;(await pg2.locator('text=Dashboard').count()) ? ok('skip lets you in') : bad('skip failed')
await pg2.reload(); await pg2.waitForTimeout(1100)
;(await pg2.locator('text=Set a 4–6 digit pincode').count()) ? bad('skip not remembered') : ok('skip remembered across reloads')

errs.length ? bad('pageerrors: ' + errs.join(' | ')) : ok('zero page errors')
console.log(fails.length ? `\nFAILURES: ${fails.length}` : '\nALL GREEN')
await b.close(); process.exit(fails.length ? 1 : 0)
