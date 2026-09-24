/* Mobile layout sweep: every route, at real phone sizes, checking for
 * horizontal overflow (the classic "design breaks out" symptom). */
import { chromium } from 'playwright'
import { boot } from './probe-boot.mjs'

const BASE = 'http://localhost:5173'
const SIZES = [
  { name: 'iPhone SE  320x568', w: 320, h: 568 },
  { name: 'Android     360x800', w: 360, h: 800 },
  { name: 'iPhone 14   390x844', w: 390, h: 844 },
]
const ROUTES = ['/', '/contacts', '/tasks', '/notes', '/calendar', '/birthdays', '/follow-ups',
  '/notifications', '/groups', '/graph', '/analytics', '/tags', '/import', '/history',
  '/integrations', '/settings', '/about', '/email', '/knowledge']

let pass = 0
const b = await chromium.launch()
let totalIssues = 0

for (const size of SIZES) {
  console.log(`\n-- ${size.name} --`)
  const ctx = await b.newContext({ viewport: { width: size.w, height: size.h }, isMobile: true, hasTouch: true })
  const pg = await ctx.newPage()
  await boot(pg)
  for (const r of ROUTES) {
    await pg.goto(BASE + '/#' + r)
    await pg.waitForTimeout(700)
    const res = await pg.evaluate(() => {
      const de = document.documentElement
      const vw = window.innerWidth
      const bad = []
      document.querySelectorAll('*').forEach(el => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return
        let p = el, scrollable = false
        while (p && p !== document.body) {
          const ov = getComputedStyle(p).overflowX
          if (ov === 'auto' || ov === 'scroll') { scrollable = true; break }
          p = p.parentElement
        }
        if (scrollable) return
        // the mobile drawer parks itself off-canvas on purpose — not an overflow
        const drawer = el.closest('aside.sidebar')
        if (drawer && drawer.getBoundingClientRect().right <= 1) return
        if (r.right > vw + 1.5 || r.left < -1.5) {
          bad.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').slice(0, 3).join('.')} [${Math.round(r.left)}..${Math.round(r.right)}]`)
        }
      })
      return { scrollW: de.scrollWidth, vw, count: bad.length, sample: bad.slice(0, 4) }
    })
    if (res.scrollW > res.vw + 1 || res.count > 0) {
      totalIssues++
      console.log(`  x ${r.padEnd(15)} scrollWidth=${res.scrollW} (vw ${res.vw}) - ${res.count} el(s)`)
      res.sample.forEach(x => console.log('       ', x))
    } else pass++
  }
  await ctx.close()
}
console.log(`\n${totalIssues === 0 ? 'NO OVERFLOW ANYWHERE' : totalIssues + ' route/size combos overflow'} (${pass} clean)`)
await b.close()
process.exit(totalIssues ? 1 : 0)
