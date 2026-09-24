#!/usr/bin/env node
/**
 * Capture Play-style phone screenshots from the running web build.
 * Expects dist served on :5173 (or PROBE_URL). Writes PNGs into docs/store-assets/.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'docs/store-assets')
const BASE = process.env.PROBE_URL || 'http://127.0.0.1:5173/'
fs.mkdirSync(OUT, { recursive: true })

const shots = [
  { file: 'screenshot-01-dashboard.png', hash: '#/', wait: 900 },
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

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(600)

/* seed a registered unlocked session so gates don't block */
await page.evaluate(() => {
  try {
    const k = 'pcrm-v1'
    let s = null
    try { s = JSON.parse(localStorage.getItem(k) || 'null') } catch {}
    if (!s || typeof s !== 'object') s = {}
    s.profile = s.profile || {
      name: 'Ayesha Rahman', email: 'ayesha@bitscol.local', mobile: '+8801711000000',
      verified: { email: true }, createdAt: new Date().toISOString(),
    }
    s.lock = { hash: null, skipped: true }
    localStorage.setItem(k, JSON.stringify(s))
    sessionStorage.setItem('pcrm-session', '1')
  } catch {}
})
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1000)
/* dismiss any skip */
for (const t of ['Skip for now', 'Skip', 'Continue']) {
  const b = page.getByText(t, { exact: false }).first()
  if (await b.count()) { await b.click().catch(() => {}) }
}
await page.waitForTimeout(400)

for (const shot of shots) {
  await page.goto(BASE.replace(/\/?$/, '/') + shot.hash.replace(/^\//, ''), { waitUntil: 'domcontentloaded' }).catch(async () => {
    await page.evaluate(h => { location.hash = h }, shot.hash)
  })
  /* hash-router style */
  await page.evaluate(h => { location.hash = h }, shot.hash)
  await page.waitForTimeout(shot.wait || 800)
  if (shot.openFirst) {
    const row = page.locator('.contact-row, tr.rowclick, [data-tip-contact]').first()
    if (await row.count()) await row.click().catch(() => {})
    await page.waitForTimeout(700)
  }
  const dest = path.join(OUT, shot.file)
  await page.screenshot({ path: dest, fullPage: false })
  console.log('wrote', shot.file, fs.statSync(dest).size)
}

await browser.close()
console.log('done →', OUT)
