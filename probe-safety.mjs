/* Phase 1 · "make it honest and safe" — pin brute-force throttle, rolling
 * snapshots, error boundary, support contact, secret hygiene. */
import { chromium } from 'playwright'
import { boot } from './probe-boot.mjs'

const BASE = 'http://localhost:5173'
let pass = 0, fail = 0
const ok = (n, c, extra = '') => { c ? (pass++, console.log('  ✓', n)) : (fail++, console.log('  ✗', n, extra)) }

const b = await chromium.launch()
const errors = []

/* ═══ 1. pincode brute-force throttle ═══ */
{
  const ctx = await b.newContext()
  const pg = await ctx.newPage()
  pg.on('pageerror', e => errors.push('pin: ' + e.message))
  await pg.goto(BASE + '/#/'); await pg.waitForTimeout(1200)
  await pg.locator('input[placeholder="e.g. BiTsCol"]').fill('Safe Tester')
  await pg.locator('input[type="email"]').first().fill('safe@example.com')
  await pg.locator('button:has-text("Continue")').click(); await pg.waitForTimeout(900)

  // set a known pincode
  const dots = pg.locator('input[placeholder="••••"]')
  await dots.nth(0).click(); await pg.keyboard.type('1234', { delay: 40 })
  await pg.keyboard.type('1234', { delay: 40 })
  await pg.locator('button:has-text("Set pincode & start")').click(); await pg.waitForTimeout(1200)
  ok('pincode set', (await pg.locator('aside').count()) > 0)
  await pg.reload(); await pg.waitForTimeout(1400)
  ok('unlock screen shows after reload', (await pg.locator('text=Unlock').count()) > 0)

  const field = pg.locator('input[placeholder="••••"]').first()
  const unlockBtn = pg.locator('button:has-text("Unlock")')

  // four wrong attempts are free, and the app says how many are left
  for (let i = 0; i < 4; i++) {
    await field.click({ force: true }); await field.fill('9999')
    await unlockBtn.click(); await pg.waitForTimeout(700)
  }
  const afterFour = await pg.locator('body').textContent()
  ok('wrong pincode is rejected', afterFour.includes('Wrong pincode'), afterFour.slice(-120))
  ok('attempts remaining are shown', /attempts? left before a lockout/.test(afterFour), afterFour.slice(-140))
  ok('still unlocked after 4 attempts', !(await pg.locator('text=Too many wrong pincodes').count()))

  // the fifth trips the lockout
  await field.click({ force: true }); await field.fill('9999')
  await unlockBtn.click(); await pg.waitForTimeout(900)
  const locked = await pg.locator('body').textContent()
  ok('5th wrong pincode locks the app', locked.includes('Too many wrong pincodes'), locked.slice(-160))
  ok('lockout shows a countdown', /Try again in \d+s/.test(locked), locked.slice(-160))

  const disabled = await field.isDisabled()
  ok('pin field disabled while locked', disabled)
  ok('unlock button disabled while locked', await unlockBtn.isDisabled())

  // even the correct code is refused until the timer runs out
  await pg.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pcrm-v1')); s.lock = { ...s.lock, lockedUntil: Date.now() + 60000 }
    localStorage.setItem('pcrm-v1', JSON.stringify(s))
  })
  await pg.reload(); await pg.waitForTimeout(1400)
  const f2 = pg.locator('input[placeholder="••••"]').first()
  ok('lockout survives a reload', (await pg.locator('text=Too many wrong pincodes').count()) > 0)
  ok('correct pin refused while locked', await f2.isDisabled())

  // clear the lockout and confirm the right pin gets in
  await pg.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pcrm-v1')); s.lock = { ...s.lock, lockedUntil: 0, fails: 0 }
    localStorage.setItem('pcrm-v1', JSON.stringify(s))
  })
  await pg.reload(); await pg.waitForTimeout(1400)
  const f3 = pg.locator('input[placeholder="••••"]').first()
  await f3.click(); await pg.keyboard.type('1234', { delay: 40 })
  await pg.locator('button:has-text("Unlock")').click(); await pg.waitForTimeout(1300)
  ok('correct pin still unlocks once the lockout clears', (await pg.locator('aside').count()) > 0)
  await ctx.close()
}

/* ═══ 2. rolling snapshots ═══ */
{
  const ctx = await b.newContext()
  const pg = await ctx.newPage()
  pg.on('pageerror', e => errors.push('snap: ' + e.message))
  await boot(pg)
  await pg.goto(BASE + '/#/settings'); await pg.waitForTimeout(1200)

  ok('safety net card present', (await pg.locator('text=Safety net').count()) > 0)
  const before = await pg.locator('text=/\\d+ snapshots? · /').first().textContent().catch(() => '')
  await pg.locator('button:has-text("Take snapshot now")').click(); await pg.waitForTimeout(1200)
  const after = await pg.locator('text=/\\d+ snapshots? · /').first().textContent().catch(() => '')
  ok('manual snapshot is stored', after !== before, `${before} → ${after}`)
  ok('snapshot list renders a timestamp', (await pg.locator('button:has-text("Restore")').count()) > 0)
  ok('newest snapshot is marked', (await pg.locator('text=newest').count()) > 0)

  const stored = await pg.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('pcrm-snapshots') || '[]')
    return { count: raw.length, hasData: !!raw[0]?.json, keys: Object.keys(JSON.parse(raw[0]?.json || '{}')) }
  })
  ok('snapshot kept on device', stored.count > 0 && stored.hasData, JSON.stringify(stored))
  ok('snapshot holds a restorable shape', stored.keys.includes('data'), JSON.stringify(stored.keys))

  // snapshots must never carry credentials
  const leaks = await pg.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('pcrm-snapshots') || '[]')
    const blob = JSON.stringify(raw)
    return { gistToken: /ghp_|github_pat_/.test(blob), secret: blob.includes('pcrm-secret') }
  })
  ok('no credentials inside snapshots', !leaks.gistToken && !leaks.secret, JSON.stringify(leaks))

  // restore a snapshot
  await pg.locator('button:has-text("Restore")').first().click(); await pg.waitForTimeout(500)
  await pg.locator('button:has-text("Yes, restore")').click(); await pg.waitForTimeout(1400)
  ok('restoring a snapshot works', (await pg.locator('text=Safety net').count()) > 0)
  ok('restore is recorded in the audit trail', (await pg.locator('text=Restored a snapshot').count()) > 0)

  // a token parked in the main data blob must be dropped on the next save
  await pg.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pcrm-v1')); s.gist = { token: 'ghp_FAKE_TOKEN_TEST', gistId: 'abc' }
    localStorage.setItem('pcrm-v1', JSON.stringify(s))
  })
  await pg.reload(); await pg.waitForTimeout(1400)
  await pg.goto(BASE + '/#/settings'); await pg.waitForTimeout(1200)
  const blobHasToken = await pg.evaluate(() => (localStorage.getItem('pcrm-v1') || '').includes('ghp_FAKE_TOKEN_TEST'))
  ok('a token left inside the data blob is stripped on save', !blobHasToken, 'token still in pcrm-v1')

  /* the token's own slot: it survives a reload, is picked up by the app, is
     never copied into the data blob, and Clear removes it everywhere */
  await pg.evaluate(() => localStorage.setItem('pcrm-secret-gist', 'ghp_probe_fake_token_1234567890'))
  await pg.reload(); await pg.waitForTimeout(1400)
  await pg.goto(BASE + '/#/settings'); await pg.waitForTimeout(1300)
  // >20 chars, so the sync engine treats it as the active backend
  ok('the token is read back from its own slot', (await pg.locator('text=ACTIVE BACKEND').count()) > 0)
  ok('the token stays out of the data blob', await pg.evaluate(() =>
    !(localStorage.getItem('pcrm-v1') || '').includes('ghp_probe_fake')))
  await pg.locator('button:has-text("Clear")').first().click(); await pg.waitForTimeout(1200)
  ok('clearing the token empties its slot', await pg.evaluate(() => !localStorage.getItem('pcrm-secret-gist')))
  ok('the app still runs after the token is cleared', (await pg.locator('text=Safety net').count()) > 0)
  await ctx.close()
}

/* ═══ 3. error boundary ═══ */
{
  const ctx = await b.newContext()
  const pg = await ctx.newPage()
  await boot(pg)
  // the ?simulate-crash diagnostic trips a real render error
  await pg.goto(BASE + '/#/settings?simulate-crash'); await pg.waitForTimeout(1800)
  const crashed = await pg.locator('text=Something broke').count()
  ok('errors are caught instead of white-screening', crashed > 0)
  const body = await pg.locator('body').textContent()
  ok('crash screen says the data is safe', /your data is safe/i.test(body))
  ok('crash screen offers a reload', (await pg.locator('button:has-text("Reload the app")').count()) > 0)
  ok('crash screen offers support', (await pg.locator('a:has-text("Email support")').count()) > 0)
  ok('crash screen offers a snapshot rollback', (await pg.locator('text=Roll back to').count()) > 0)
  ok('crash screen carries the BITSCOL credit', body.includes('sales@bitscol.com'))
  ok('the fault is recorded for support', await pg.evaluate(() => {
    const e = JSON.parse(localStorage.getItem('pcrm-last-error') || 'null')
    return !!e && !!e.message && !!e.at
  }))
  // and the app comes back cleanly afterwards
  await pg.goto(BASE + '/#/'); await pg.reload(); await pg.waitForTimeout(1600)
  ok('the app recovers after the crash is cleared', (await pg.locator('aside').count()) > 0)
  await ctx.close()
}

/* ═══ 4. support contact + dev-only controls ═══ */
{
  const ctx = await b.newContext()
  const pg = await ctx.newPage()
  pg.on('pageerror', e => errors.push('support: ' + e.message))
  await boot(pg)
  await pg.goto(BASE + '/#/settings'); await pg.waitForTimeout(1300)
  const body = await pg.locator('body').textContent()
  ok('support card present', (await pg.locator('text=Support').count()) > 0)
  ok('support shows the BITSCOL email', body.includes('sales@bitscol.com'))
  ok('support shows the BITSCOL mobile', body.includes('+880 1711-853769'))
  ok('support shows the website', body.includes('www.bitscol.com'))
  ok('report-a-problem link is a mailto', (await pg.locator('a[href^="mailto:sales@bitscol.com"]').count()) > 0)
  ok('copyright shown', body.includes('BITSCOL. All rights reserved'))

  // the dev-only simulate button must not ship
  await pg.goto(BASE + '/#/'); await pg.waitForTimeout(1200)
  await pg.locator('button[title*="Quick Capture"]').click(); await pg.waitForTimeout(800)
  const qc = await pg.locator('body').textContent()
  ok('dev-only simulate button is hidden in the build', !qc.includes('Simulate incoming audio'))
  await ctx.close()
}

/* ═══ 5. the new surfaces on a phone ═══ */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const pg = await ctx.newPage()
  pg.on('pageerror', e => errors.push('phone: ' + e.message))
  await boot(pg)

  // every control we added has to be thumb-sized, and nothing may stick out
  const measure = async pattern => pg.evaluate(pat => {
    const card = [...document.querySelectorAll('.card')].find(c => new RegExp(pat).test(c.textContent))
    if (!card) return null
    const vw = document.documentElement.clientWidth
    let smallest = 999, outside = 0, clipped = 0
    card.querySelectorAll('button, a[href], input, select').forEach(el => {
      const r = el.getBoundingClientRect()
      if (r.width && r.height) smallest = Math.min(smallest, r.height)
    })
    card.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect()
      if (r.width && (r.right > vw + 1 || r.left < -1)) outside++
      const cs = getComputedStyle(el)
      if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && !el.children.length && el.scrollWidth > el.clientWidth + 1) clipped++
    })
    return { smallest: Math.round(smallest), outside, clipped }
  }, pattern)

  await pg.goto(BASE + '/#/settings'); await pg.waitForTimeout(1500)
  const net = await measure('Safety net')
  ok('safety net controls are thumb-sized on a phone', net && net.smallest >= 36, JSON.stringify(net))
  ok('safety net fits the phone', net && net.outside === 0 && net.clipped === 0, JSON.stringify(net))
  const sup = await measure('Support')
  ok('support card controls are thumb-sized on a phone', sup && sup.smallest >= 36, JSON.stringify(sup))

  // the confirm row is the tightest layout in the card
  await pg.locator('.card', { hasText: 'Safety net' }).locator('button:has-text("Restore")').first().click()
  await pg.waitForTimeout(500)
  const conf = await measure('Safety net')
  ok('the restore confirmation fits the phone', conf && conf.outside === 0 && conf.clipped === 0, JSON.stringify(conf))

  // the crash screen is the one screen a phone user must still be able to use
  await pg.goto(BASE + '/#/settings?simulate-crash'); await pg.waitForTimeout(1600)
  const crash = await measure('Something broke')
  ok('crash screen controls are thumb-sized', crash && crash.smallest >= 36, JSON.stringify(crash))
  ok('crash screen fits the phone', crash && crash.outside === 0 && crash.clipped === 0, JSON.stringify(crash))
  ok('crash screen actions run full width',
    await pg.evaluate(() => {
      const b = [...document.querySelectorAll('.card button, .card a')].find(el => /Reload the app/.test(el.textContent))
      if (!b) return false
      const card = b.closest('.card')
      const cw = card.getBoundingClientRect().width - 40   // p-5 on a phone
      return b.getBoundingClientRect().width >= cw - 2
    }))

  // the lockout banner, shown at its worst
  await pg.goto(BASE + '/#/')
  await pg.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pcrm-v1'))
    s.lock = { salt: 'probe', hash: 'deadbeef', setAt: new Date().toISOString(), fails: 6, lockedUntil: Date.now() + 120000 }
    localStorage.setItem('pcrm-v1', JSON.stringify(s))
  })
  await pg.reload(); await pg.waitForTimeout(1600)
  const lockBody = await pg.textContent('body')
  ok('the lockout banner shows on a phone', /Too many wrong pincodes/.test(lockBody))
  ok('the lockout screen fits the phone', await pg.evaluate(() => {
    const card = document.querySelector('.card'); if (!card) return false
    const vw = document.documentElement.clientWidth, r = card.getBoundingClientRect()
    return r.left >= -1 && r.right <= vw + 1
  }))
  await ctx.close()
}

ok('zero unexpected page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
console.log(`\n${fail === 0 ? 'ALL GREEN' : 'FAILURES'} — ${pass} passed, ${fail} failed`)
await b.close()
process.exit(fail ? 1 : 0)
