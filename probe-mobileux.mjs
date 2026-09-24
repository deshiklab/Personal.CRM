/* Mobile UX probe: pin focus retention, hamburger drawer, registration form
 * layout (icon overlap) and the first-run screens at phone width. */
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
let pass = 0, fail = 0
const ok = (n, c, extra = '') => { c ? (pass++, console.log('  ✓', n)) : (fail++, console.log('  ✗', n, extra)) }

const b = await chromium.launch()
const errors = []

/* ───────────── 1. PIN: type without re-tapping ───────────── */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const pg = await ctx.newPage()
  pg.on('pageerror', e => errors.push(e.message))
  await pg.goto(BASE + '/#/'); await pg.waitForTimeout(1200)

  // registration first
  await pg.locator('input[placeholder="e.g. BiTsCol"]').fill('Mobile Tester')
  await pg.locator('input[type="email"]').first().fill('mobile@example.com')
  await pg.locator('button:has-text("Continue")').click(); await pg.waitForTimeout(1000)

  const f1 = pg.locator('input[placeholder="••••"]').nth(0)
  const f2 = pg.locator('input[placeholder="••••"]').nth(1)

  // click ONCE, then type four digits with no further clicking
  await f1.click()
  await pg.keyboard.type('1234', { delay: 60 })
  const v1 = await f1.inputValue()
  ok('4 digits land in field 1 from one click', v1 === '1234', `got "${v1}"`)

  const focusedAfter = await pg.evaluate(() => document.activeElement?.placeholder || '')
  ok('focus moved to field 2 automatically', focusedAfter === '••••', `activeElement placeholder="${focusedAfter}"`)

  await pg.keyboard.type('1234', { delay: 60 })
  const v2 = await f2.inputValue()
  ok('field 2 receives the repeat pin', v2 === '1234', `got "${v2}"`)

  // and it still works on unlock after a reload
  await pg.locator('button:has-text("Set pincode & start")').click(); await pg.waitForTimeout(1200)
  await pg.reload(); await pg.waitForTimeout(1300)
  const unlockField = pg.locator('input[placeholder="••••"]').first()
  await unlockField.click()
  await pg.keyboard.type('1234', { delay: 60 })
  ok('unlock: 4 digits typed in one go', (await unlockField.inputValue()) === '1234', await unlockField.inputValue())
  await pg.locator('button:has-text("Unlock")').click(); await pg.waitForTimeout(1200)
  ok('unlocked into the app', (await pg.locator('aside').count()) > 0)

  // Settings → change pincode: same focus behaviour on PinRow
  await pg.goto(BASE + '/#/settings'); await pg.waitForTimeout(1100)
  await pg.locator('button:has-text("Change pincode")').first().click(); await pg.waitForTimeout(600)
  const cur = pg.locator('.fixed input[type="password"]').nth(0)
  await cur.click()
  await pg.keyboard.type('1234', { delay: 60 })
  ok('settings: current pin typed without re-tap', (await cur.inputValue()) === '1234', await cur.inputValue())
  const np = pg.locator('.fixed input[type="password"]').nth(1)
  await np.click(); await pg.keyboard.type('4321', { delay: 60 })
  ok('settings: new pin typed without re-tap', (await np.inputValue()) === '4321', await np.inputValue())
  const rp = pg.locator('.fixed input[type="password"]').nth(2)
  await rp.click(); await pg.keyboard.type('4321', { delay: 60 })
  ok('settings: repeat pin typed without re-tap', (await rp.inputValue()) === '4321', await rp.inputValue())
  await pg.locator('.fixed button:has-text("Confirm")').first().click(); await pg.waitForTimeout(900)
  ok('pincode change flow completed', (await pg.locator('text=Pincode changed').count()) > 0)
  await ctx.close()
}

/* ───────────── 2. Hamburger drawer ───────────── */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const pg = await ctx.newPage()
  pg.on('pageerror', e => errors.push(e.message))
  await pg.goto(BASE + '/#/'); await pg.waitForTimeout(1200)
  const regName = pg.locator('input[placeholder="e.g. BiTsCol"]')
  if (await regName.count()) {
    await regName.fill('Drawer Tester')
    await pg.locator('input[type="email"]').first().fill('drawer@example.com')
    await pg.locator('button:has-text("Continue")').click(); await pg.waitForTimeout(900)
    const skip = pg.locator('button:has-text("Skip for now")')
    if (await skip.count()) { await skip.first().click(); await pg.waitForTimeout(800) }
  }

  const burger = pg.locator('button[aria-label="Open menu"]')
  ok('hamburger visible on mobile', await burger.isVisible())
  const asideClosed = await pg.evaluate(() => document.querySelector('aside')?.getBoundingClientRect().right ?? -999)
  ok('sidebar parked off-canvas by default', asideClosed <= 1, `right=${asideClosed}`)

  await burger.click(); await pg.waitForTimeout(500)
  const asideOpen = await pg.evaluate(() => document.querySelector('aside')?.getBoundingClientRect().right ?? 0)
  ok('drawer slides in when tapped', asideOpen > 200, `right=${asideOpen}`)
  ok('backdrop appears', (await pg.locator('div.fixed.inset-0.z-\\[80\\]').count()) > 0)
  ok('nav labels readable in drawer', (await pg.locator('aside').textContent()).includes('Contacts'))

  await pg.locator('aside a:has-text("Groups")').click(); await pg.waitForTimeout(900)
  ok('tapping a destination navigates', pg.url().includes('/groups'), pg.url())
  const asideAfter = await pg.evaluate(() => document.querySelector('aside')?.getBoundingClientRect().right ?? -999)
  ok('drawer closes after navigating', asideAfter <= 1, `right=${asideAfter}`)

  // desktop keeps the sidebar permanently docked
  await pg.setViewportSize({ width: 1280, height: 900 }); await pg.waitForTimeout(600)
  const deskRight = await pg.evaluate(() => document.querySelector('aside')?.getBoundingClientRect().right ?? 0)
  ok('desktop sidebar stays docked', deskRight > 200, `right=${deskRight}`)
  ok('hamburger hidden on desktop', !(await pg.locator('button[aria-label="Open menu"]').isVisible()))
  await ctx.close()
}

/* ───────────── 3. Registration form: icons vs text ───────────── */
{
  const ctx = await b.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true })
  const pg = await ctx.newPage()
  pg.on('pageerror', e => errors.push(e.message))
  await pg.goto(BASE + '/#/'); await pg.waitForTimeout(1300)
  ok('registration shown on 320px', (await pg.locator('text=Welcome to Personal CRM').count()) > 0)

  const gaps = await pg.evaluate(() => {
    const out = []
    document.querySelectorAll('input').forEach(inp => {
      const wrap = inp.parentElement
      const icon = wrap?.querySelector('svg')
      if (!icon) return
      const ir = icon.getBoundingClientRect(), br = inp.getBoundingClientRect()
      const padLeft = parseFloat(getComputedStyle(inp).paddingLeft)
      out.push({ ph: inp.placeholder, iconRight: Math.round(ir.right - br.left), padLeft: Math.round(padLeft) })
    })
    return out
  })
  gaps.forEach(g => ok(`icon clear of the text (${g.ph})`, g.padLeft >= g.iconRight + 4, `text starts at ${g.padLeft}, icon ends at ${g.iconRight}`))
  ok('three icon fields found', gaps.length === 3, JSON.stringify(gaps))

  // no horizontal overflow on the gate screen itself
  const ov = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }))
  ok('registration does not overflow at 320px', ov.sw <= ov.vw + 1, JSON.stringify(ov))

  // tap targets are big enough
  const btn = await pg.locator('button:has-text("Continue")').boundingBox()
  ok('primary button tall enough to tap', btn.height >= 36, `${Math.round(btn.height)}px`)
  await ctx.close()
}

/* ───────────── 4. PIN screen at 320px ───────────── */
{
  const ctx = await b.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true })
  const pg = await ctx.newPage()
  await pg.goto(BASE + '/#/'); await pg.waitForTimeout(1200)
  await pg.locator('input[placeholder="e.g. BiTsCol"]').fill('Tiny Screen')
  await pg.locator('input[type="email"]').first().fill('tiny@example.com')
  await pg.locator('button:has-text("Continue")').click(); await pg.waitForTimeout(1000)
  const ov = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }))
  ok('pin screen does not overflow at 320px', ov.sw <= ov.vw + 1, JSON.stringify(ov))
  const card = await pg.locator('.card').first().boundingBox()
  ok('pin card fits the viewport', card.width <= 320, `${Math.round(card.width)}px`)
  await ctx.close()
}

ok('zero page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
console.log(`\n${fail === 0 ? 'ALL GREEN' : 'FAILURES'} — ${pass} passed, ${fail} failed`)
await b.close()
process.exit(fail ? 1 : 0)
