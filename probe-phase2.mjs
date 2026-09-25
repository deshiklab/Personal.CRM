#!/usr/bin/env node
/**
 * Phase 2 remainder probes: reminders module, a11y, virtual list, store docs.
 * Run against app-static on :5173 (built dist).
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.PROBE_URL || 'http://127.0.0.1:5173/'
let passed = 0, failed = 0
const ok = (name, cond) => {
  if (cond) { console.log('  ✓', name); passed++ }
  else { console.log('  ✗', name); failed++ }
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))

const bundle = fs.readFileSync(path.join(__dirname, 'dist/index.html'), 'utf8')

ok('bundle v2.0.0', /2\.0\.0/.test(bundle))
ok('bundle has reminders engine', /pcrm-reminder|syncReminders|local-notifications|pcrm_reminders/.test(bundle))
ok('bundle has VirtualList', /VirtualList|translateY\(|rowHeight/.test(bundle))
ok('bundle has skip-link', /skip-link|Skip to main content/.test(bundle))
ok('bundle has sr-only / focus-visible', /sr-only|focus-visible|prefers-reduced-motion/.test(bundle))
ok('docs CLOSED-TEST present', fs.existsSync(path.join(__dirname, 'docs/CLOSED-TEST.md')))
ok('docs STORE-LISTING present', fs.existsSync(path.join(__dirname, 'docs/STORE-LISTING.md')))
ok('feature graphic SVG present', fs.existsSync(path.join(__dirname, 'docs/store-assets/feature-graphic.svg')))
ok('screenshot templates ≥ 8', fs.readdirSync(path.join(__dirname, 'docs/store-assets')).filter(f => f.startsWith('screenshot-')).length >= 8)
ok('package has local-notifications', /@capacitor\/local-notifications/.test(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')))
ok('mint-keys script present', fs.existsSync(path.join(__dirname, 'scripts/mint-keys.mjs')))
ok('bundle gates advanced analytics / graph export', /advanced_analytics|graph_export|Longer windows on Pro|Export SVG|Ocean/.test(bundle))
ok('bundle has getting-started checklist', /Getting started|onboardSteps|Who to call today|callToday/.test(bundle))
ok('bundle has contact density + key blocklist', /contactDensity|KEY_BLOCKLIST|Compact|Comfort/.test(bundle))
ok('bundle has encrypted backup', /pcrm-enc-v1|exportEncryptedBackup|Encrypted backup|secureBackup|AES-GCM/.test(bundle))

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(800)

/* bypass gates if needed — seed profile/lock like other probes */
await page.evaluate(() => {
  try {
    const k = 'pcrm-v1'
    let s = null
    try { s = JSON.parse(localStorage.getItem(k) || 'null') } catch {}
    if (!s) s = {}
    if (!s.profile) s.profile = { name: 'Probe User', email: 'probe@bitscol.local', mobile: '', verified: {}, createdAt: new Date().toISOString() }
    if (!s.lock) s.lock = { hash: null, skipped: true }
    localStorage.setItem(k, JSON.stringify(s))
    sessionStorage.setItem('pcrm-session', '1')
  } catch {}
})
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1000)
/* dismiss lock if still up */
const unlock = page.locator('text=Skip for now').first()
if (await unlock.count()) { await unlock.click().catch(() => {}) }
await page.waitForTimeout(400)

ok('skip link in DOM', await page.locator('a.skip-link, a:has-text("Skip to main content")').count() > 0)
ok('main#main-content present', await page.locator('#main-content').count() > 0)

await page.goto(BASE + '#/', { waitUntil: 'domcontentloaded' }).catch(()=>{})
await page.evaluate(() => { location.hash = '#/' })
await page.waitForTimeout(500)
ok('Dashboard getting started or widgets', (await page.getByText('Getting started').count()) + (await page.getByText('Who to call today').count()) + (await page.getByText('Key stats').count()) > 0)
await page.goto(BASE + '#/contacts', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(600)
ok('Contacts region labelled', await page.locator('[aria-label="Contacts directory"], [aria-label*="contacts" i]').count() > 0)

await page.goto(BASE + '#/notifications', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(600)
ok('Notifications page loads', (await page.getByText('Notification Center').count()) > 0 || (await page.getByText('Inbox categories').count()) > 0)
ok('Device reminders section present', (await page.getByText('Device reminders').count()) > 0)
ok('Quiet hours controls present', (await page.getByText('Quiet hours').count()) > 0)
ok('Lead times controls present', (await page.getByText('Lead times').count()) > 0)
ok('ops docs present',
  ['OPS-LAUNCH.md','TESTER-EMAILS.md','WEB-KEYS-MOR.md','PHASE3.md'].every(f => fs.existsSync(path.join(__dirname, 'docs', f))))
ok('PNG store assets present',
  fs.existsSync(path.join(__dirname, 'docs/store-assets/feature-graphic.png'))
  && fs.readdirSync(path.join(__dirname, 'docs/store-assets')).filter(f => f.startsWith('screenshot-') && f.endsWith('.png')).length >= 8)
ok('Pro gate copy or enable button',
  (await page.getByText('Unlock Pro for reminders').count())
  + (await page.getByText('Enable device reminders').count())
  + (await page.getByText('Resync schedule').count())
  + (await page.getByText('Send test notification').count()) > 0)

/* free tier: arm toggle should not schedule without pro — just no crash */
ok('zero page errors', errors.length === 0)

await browser.close()
console.log('')
if (failed) {
  console.log(`FAILED — ${passed} passed, ${failed} failed`)
  process.exit(1)
}
console.log(`ALL GREEN — ${passed} passed, 0 failed`)
