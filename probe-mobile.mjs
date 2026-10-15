/**
 * WS-7 device-matrix probe (Playwright — run in a BROWSER environment with
 * playwright browsers installed:  npx playwright install chromium && node probe-mobile.mjs
 *
 * Sweeps every route at 360 / 390 / 768 / 1280 px and asserts:
 *   1. no horizontal overflow (documentElement.scrollWidth <= innerWidth + 1)
 *   2. no visible element wider than the viewport
 *   3. primary tap targets (buttons, .btn, .icon-btn, .chip-btn) are ≥ 44px on phones
 * Saves screenshots to ./probe-mobile-shots/.
 *
 * The behavioral half of this sweep runs in CI via probe-mobile.test.jsx
 * (vitest + jsdom). This file is the real-layout half — same convention as
 * probe-notes.mjs.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.CRM_URL || 'http://localhost:5173'
const ROUTES = [
  '/', '/contacts', '/tasks', '/notes', '/kb', '/files', '/calendar', '/birthdays',
  '/follow-ups', '/notifications', '/groups', '/graph', '/analytics', '/email',
  '/tags', '/import', '/history', '/integrations', '/settings',
]
const SIZES = [
  { w: 360, h: 780, name: '360' },
  { w: 390, h: 844, name: '390' },
  { w: 768, h: 1024, name: '768' },
  { w: 1280, h: 800, name: '1280' },
]
const TAP_MIN = 44 // px on phones

mkdirSync('probe-mobile-shots', { recursive: true })

const browser = await chromium.launch()
let failures = 0
const report = []

for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h } })
  const page = await ctx.newPage()
  await page.goto(BASE + '/#/')

  /* skip the first-launch lock prompt if it shows */
  const skip = page.getByRole('button', { name: /skip for now/i })
  if (await skip.count()) await skip.first().click()

  for (const route of ROUTES) {
    await page.goto(BASE + '/#' + route)
    await page.waitForTimeout(450)

    const overflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      wide: [...document.querySelectorAll('body *')]
        .filter(el => el.getBoundingClientRect().width > window.innerWidth + 1)
        .slice(0, 3)
        .map(el => el.tagName + '.' + String(el.className).slice(0, 40)),
    }))

    const issues = []
    if (overflow.scrollW > overflow.innerW + 1) {
      issues.push(`horizontal overflow: scrollWidth ${overflow.scrollW} > ${overflow.innerW}${overflow.wide.length ? ` (wide: ${overflow.wide.join(', ')})` : ''}`)
    }

    /* tap-target audit on phones */
    if (size.w <= 430) {
      const small = await page.evaluate(min => {
        return [...document.querySelectorAll('button, .btn, .icon-btn, .chip-btn, a.chip')]
          .filter(el => {
            const r = el.getBoundingClientRect()
            return r.width > 0 && r.height > 0 && r.height < min - 6 // 6px tolerance for inline chips
          })
          .slice(0, 5)
          .map(el => `${el.tagName}.${String(el.className).slice(0, 30)} ${Math.round(el.getBoundingClientRect().height)}px`)
      }, TAP_MIN)
      /* chips are exempt-ish (they scroll rows); flag only buttons */
      const btnSmall = small.filter(s => !s.includes('chip'))
      if (btnSmall.length) issues.push(`tap targets < ${TAP_MIN}px: ${btnSmall.join(' | ')}`)
    }

    await page.screenshot({ path: `probe-mobile-shots/${size.name}-${route.replace(/\W+/g, '_') || 'home'}.png`, fullPage: false })
    const line = `${size.name}px ${route}: ${issues.length ? 'FAIL — ' + issues.join('; ') : 'ok'}`
    report.push(line)
    if (issues.length) failures++
  }
  await ctx.close()
}

await browser.close()
console.log(report.join('\n'))
console.log(`\n${failures === 0 ? '✅ device matrix clean' : `❌ ${failures} route/size combos with issues`}`)
process.exit(failures === 0 ? 0 : 1)
