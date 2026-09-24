/* Theme guard.
 *
 * Walks every screen in BOTH themes and measures the contrast between each
 * piece of text and whatever is actually behind it (translucent layers
 * composited properly — two 4% tints are still mostly transparent).
 *
 * Fails on any text under 4.5:1 (WCAG AA for body text) and, separately, on
 * anything under 2:1, which is the "white text on a white card" class of bug
 * that makes text vanish entirely. */
import { chromium } from 'playwright'
import { boot } from './probe-boot.mjs'

const BASE = 'http://localhost:5173'
const ROUTES = [
  '/', '/contacts', '/tasks', '/notes', '/email', '/calendar', '/birthdays',
  '/followups', '/groups', '/network', '/analytics', '/tags', '/import',
  '/integrations', '/settings', '/knowledge', '/about',
]

let pass = 0, fail = 0
const ok = (n, c, extra = '') => { c ? (pass++, console.log('  ✓', n)) : (fail++, console.log('  ✗', n, extra)) }

const SCAN = canvas => {
  const out = []
  const parse = c => {
    const m = String(c).match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number)
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const lum = ({ r, g, b }) => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1,
  })
  const backdrop = el => {
    const layers = []
    let node = el
    while (node && node !== document.documentElement.parentNode) {
      const cs = getComputedStyle(node)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null
      const c = parse(cs.backgroundColor)
      if (c && c.a > 0) { layers.push(c); if (c.a >= 0.999) break }
      node = node.parentElement
    }
    const body = parse(getComputedStyle(document.body).backgroundColor)
    let base = body && body.a >= 0.999 ? body : { ...canvas, a: 1 }
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base)
    return base
  }

  document.querySelectorAll('body *').forEach(el => {
    if (el.children.length) return
    const txt = (el.textContent || '').trim()
    if (!txt) return
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') return
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight + 400) return
    const fg = parse(cs.color), bg = backdrop(el)
    if (!fg || !bg) return
    const f = over(fg, bg)
    const l1 = lum(f), l2 = lum(bg)
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    const size = parseFloat(cs.fontSize) || 13
    const bold = (parseInt(cs.fontWeight, 10) || 400) >= 700
    const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5
    if (ratio < need)
      out.push({ ratio: Math.round(ratio * 100) / 100, text: txt.slice(0, 30), color: cs.color })
  })
  const seen = new Set()
  return out.sort((a, b) => a.ratio - b.ratio).filter(o => {
    const k = o.text + o.color
    if (seen.has(k)) return false
    seen.add(k); return true
  })
}

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
const pg = await ctx.newPage()
await boot(pg)

for (const theme of ['light', 'dark']) {
  const canvas = theme === 'light' ? { r: 242, g: 244, b: 249 } : { r: 10, g: 12, b: 17 }
  await pg.evaluate(t => localStorage.setItem('pcrm-theme', t), theme)
  await pg.reload(); await pg.waitForTimeout(1200)
  ok(`${theme}: theme actually applied`,
    (await pg.evaluate(() => document.documentElement.getAttribute('data-theme'))) === theme)

  const all = []
  for (const route of ROUTES) {
    await pg.goto(BASE + '/#' + route); await pg.waitForTimeout(1000)
    const bad = await pg.evaluate(SCAN, canvas)
    bad.forEach(o => all.push({ ...o, route }))
  }
  ok(`${theme}: no text below 4.5:1`, all.length === 0,
    all.slice(0, 4).map(o => `${o.route} "${o.text}" ${o.ratio}:1 ${o.color}`).join(' | '))
  ok(`${theme}: nothing invisible (<2:1)`, all.filter(o => o.ratio < 2).length === 0)
}

/* the exact bug this guard exists for: bold text inside an article used to be
 * hardcoded white, so it disappeared completely on the light theme */
await pg.evaluate(() => localStorage.setItem('pcrm-theme', 'light'))
await pg.reload(); await pg.waitForTimeout(1000)
let strong = null
for (const slug of ['data.ics', 'start.layout', 'data.backup', 'people.contacts']) {
  await pg.goto(`${BASE}/#/knowledge?a=${slug}`); await pg.waitForTimeout(1300)
  strong = await pg.evaluate(() => {
    const el = document.querySelector('.md strong')
    if (!el) return null
    return { color: getComputedStyle(el).color, text: (el.textContent || '').slice(0, 24) }
  })
  if (strong) break
}
ok('light: bold text in an article is not white', strong && !/255,\s*255,\s*255/.test(strong.color), JSON.stringify(strong))

/* chips and segmented controls carry their own light-mode twins */
ok('light: an active chip keeps readable text', await pg.evaluate(() => {
  const el = [...document.querySelectorAll('.chip.on')][0]
  if (!el) return true
  const c = getComputedStyle(el).color.match(/\d+/g).map(Number)
  return (c[0] + c[1] + c[2]) / 3 < 140          // dark ink, not white
}))

console.log(`\n${fail === 0 ? 'ALL GREEN' : 'FAILURES'} — ${pass} passed, ${fail} failed`)
await b.close()
process.exit(fail ? 1 : 0)
