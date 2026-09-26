#!/usr/bin/env node
/**
 * Capture Play-style phone screenshots from the running web build.
 * Expects dist served on :5173 (or PROBE_URL). Writes PNGs into docs/store-assets/.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { boot, registerAs } from '../probe-boot.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'docs/store-assets')
const BASE = process.env.PROBE_URL || 'http://127.0.0.1:5173/'
fs.mkdirSync(OUT, { recursive: true })

const shots = [
  { file: 'screenshot-01-dashboard.png', hash: '#/', wait: 1000 },
  { file: 'screenshot-02-contacts.png', hash: '#/contacts', wait: 900 },
  { file: 'screenshot-03-contact-drawer.png', hash: '#/contacts', wait: 900, openFirst: true },
  { file: 'screenshot-04-followups.png', hash: '#/follow-ups', wait: 800 },
  { file: 'screenshot-05-tasks.png', hash: '#/tasks', wait: 800 },
  { file: 'screenshot-06-inbox.png', hash: '#/notifications', wait: 900 },
  { file: 'screenshot-07-pro.png', hash: '#/pro', wait: 800 },
  { file: 'screenshot-08-about.png', hash: '#/about', wait: 800 },
]

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
})
const page = await context.newPage()

const url = BASE.endsWith('/') ? BASE + '#/' : BASE + '/#/'
await boot(page, url)
await registerAs(page, 'Ayesha Rahman', 'ayesha@bitscol.local', '+880 1711-000000')
/* keep demo data if offered */
for (const t of ['Continue with demo data', 'Keep demo data', 'Continue']) {
  const b = page.getByText(t, { exact: false }).first()
  if (await b.count()) { await b.click().catch(() => {}); break }
}
await page.keyboard.press('Escape').catch(() => {})
await page.waitForTimeout(600)

for (const shot of shots) {
  await page.evaluate(h => { location.hash = h }, shot.hash)
  await page.waitForTimeout(shot.wait || 800)
  if (shot.openFirst) {
    /* click first visible contact-ish row */
    const candidates = [
      'main button:has(h3), main [class*="contact"]',
      'main .card button',
      'main button.w-full',
      'main li button',
      'main tr',
    ]
    let clicked = false
    for (const sel of candidates) {
      const rows = page.locator(sel)
      const n = await rows.count()
      for (let i = 0; i < Math.min(n, 8); i++) {
        const r = rows.nth(i)
        try {
          if (await r.isVisible()) {
            await r.click({ timeout: 800 })
            clicked = true
            break
          }
        } catch {}
      }
      if (clicked) break
    }
    await page.waitForTimeout(1000)
  }
  const dest = path.join(OUT, shot.file)
  await page.screenshot({ path: dest, fullPage: false })
  console.log('wrote', shot.file, fs.statSync(dest).size)
}

await browser.close()
console.log('done →', OUT)
