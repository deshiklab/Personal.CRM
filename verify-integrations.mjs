import { chromium } from 'playwright'

const BASE = 'http://localhost:5173/#'            // HashRouter
const results = []
const push = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`) }

// real hook endpoint (node side has no CORS; creation + verification done here)
const tok = await (await fetch('https://webhook.site/token', { method: 'POST' })).json()
const HOOK = `https://webhook.site/${tok.uuid}`
const readback = async () => {
  await new Promise(s => setTimeout(s, 1800))
  const r = await fetch(`https://webhook.site/token/${tok.uuid}/requests?page=1&per_page=25&sorting=newest`)
  const j = await r.json()
  return (j.data || []).map(x => x.content || '')
}

const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', e => { const t = String(e); if (!t.includes('WebSocket closed') && !t.includes('validateDOMNesting')) errors.push(t) })
let curStep = 'init'
page.on('console', m => {
  const t = m.text()
  if (t.includes('validateDOMNesting')) console.log(`   [nesting @ ${curStep}]`, (t.match(/<\w+>/g) || []).join(','))
  if (m.type() === 'error' && !t.includes('ebSocket') && !t.includes('favicon') && !t.includes('DevTools') && !t.includes('ERR') && !t.includes('WebSocket closed') && !t.includes('validateDOMNesting')) errors.push(t)
})

const gotoR = r => page.goto(BASE + r, { waitUntil: 'load' }).then(() => page.waitForTimeout(600))

// ── 1. route sweep ─────────────────────────────────────────────
const routes = ['/', '/contacts', '/tasks', '/notes', '/email', '/calendar', '/birthdays', '/follow-ups',
  '/notifications', '/groups', '/graph', '/analytics', '/tags', '/import', '/history', '/integrations', '/settings']
let rendered = 0
for (const r of routes) { await gotoR(r); if ((await page.evaluate(() => document.body.innerText.trim().length)) > 80) rendered++ }
push('routes render', rendered === routes.length, `${rendered}/${routes.length}`)

// ── 2. Integrations board ──────────────────────────────────────
await gotoR('/integrations')
let txt = await page.evaluate(() => document.body.innerText)
push('integrations page header', txt.includes('Integrations & Bridges'))
push('board lists 6 pipes', ['Google Calendar', 'Google Contacts', 'Drive backup', 'Gmail', 'Outlook', 'Webhooks'].every(x => txt.includes(x)))
push('bridge cards render', ['Outbound webhooks', 'Phone & address-book bridge', 'Calendar bridges', 'Deep actions'].every(x => txt.includes(x)))

// ── 3. REAL webhook delivery vs webhook.site ───────────────────
await page.locator('input[placeholder*="hooks.zapier.com"]').fill(HOOK)
await page.click('button:has-text("Save")', { force: true })
await page.waitForTimeout(400)
const chip = page.locator('button.chip-btn', { hasText: 'Task completed' })
const chipBefore = await chip.innerText()
await chip.click(); const chipAfter = await chip.innerText()
push('event toggle chip flips', chipBefore !== chipAfter, `${JSON.stringify(chipBefore)} → ${JSON.stringify(chipAfter)}`)
await chip.click() // restore

curStep = 'ping'
await page.click('button:has-text("Send test ping")')
await page.waitForTimeout(6000)
txt = await page.evaluate(() => document.body.innerText)
const logSection = (txt.split(/recent deliveries/i)[1] || '')
push('delivery log has ping entry', /ping/.test(logSection), logSection.slice(0, 110).replace(/\n/g, ' | '))
push('ping logged as delivered (no network error)', /ping/.test(logSection) && !/network error/.test(logSection), '')
const hits1 = await readback()
push('server actually received ping payload', hits1.some(c => c.includes('"ping"') && c.includes('personal-crm')), `${hits1.length} request(s) on hook`)

// ── 4. add a lead → auto-fires 'contact' webhook ───────────────
curStep = 'arm contact chip'
const chipContact = page.locator('button.chip-btn', { hasText: 'Contact added' })
if (!(await chipContact.innerText()).includes('✓')) await chipContact.click()
await gotoR('/contacts')
await page.click('button:has-text("Add contact")')
await page.waitForTimeout(400)
await page.locator('input[placeholder="Full name"]').fill('Webhook Testperson')
await page.locator('input[placeholder="+880 …"]').fill('+880 1711-999000')
await page.click('button:has-text("Save contact")')
await page.waitForTimeout(6500)
const hits2 = await readback()
push('contact-add auto-fired real webhook', hits2.some(c => c.includes('"contact"') && c.includes('Webhook Testperson')), `${hits2.length} request(s) now`)

// cleanup the test contact
const row = page.locator('tbody tr:has-text("Webhook Testperson")').first()
if (await row.count()) {
  await row.click(); await page.waitForTimeout(500)
  const del = page.locator('button:has-text("Delete")').first()
  if (await del.count()) {
    await del.click({ force: true }); await page.waitForTimeout(400)
    const confirm = page.locator('button:has-text("Confirm")').first()
    if (await confirm.count()) await confirm.click({ force: true })
    await page.waitForTimeout(400)
  }
}

// ── 5. vCard / ICS controls ────────────────────────────────────
await gotoR('/integrations')
push('export-all .vcf button', await page.locator('button:has-text("Export all as .vcf")').count() === 1)
push('import .vcf trigger', await page.locator('button:has-text("Import .vcf")').count() === 1)
push('hidden vcf file input', await page.locator('input[type="file"][accept*=".vcf"]').count() === 1)
push('events .ics export button', await page.locator('button:has-text("(.ics)")').count() >= 1)

// ── 6. Calendar bridges ────────────────────────────────────────
await gotoR('/calendar')
push('calendar header .ics button', await page.locator('button:has-text(".ics")').count() >= 1)
curStep = 'calendar detail'
await gotoR('/calendar?event=e4')
await page.waitForTimeout(1000)
const gcalA = page.locator('a:has-text("Add to Google Calendar")')
const gcalHref = await gcalA.count() ? await gcalA.first().getAttribute('href') : null
push('event detail GCal template link', !!gcalHref && gcalHref.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'), (gcalHref || 'missing').slice(0, 72))
const closeB = page.locator('button:has-text("Close")').first()
if (await closeB.count()) await closeB.click()

// ── 7. Contacts drawer deep actions ────────────────────────────
await gotoR('/contacts')
await page.locator('tbody tr').nth(1).click()
await page.waitForTimeout(700)
curStep = 'drawer'
txt = await page.evaluate(() => document.body.innerText)
push('deep-actions row renders', /reach out directly/i.test(txt) && txt.includes('Share card'))
const telHref = await page.locator('a[title="Call through your phone dialer"]').first().getAttribute('href').catch(() => null)
const waHref = await page.locator('a[title*="WhatsApp chat"]').first().getAttribute('href').catch(() => null)
const mailHref = await page.locator('a[title="Compose in Gmail"]').first().getAttribute('href').catch(() => null)
push('tel: deep link', !!telHref && telHref.startsWith('tel:+'), telHref || '-')
push('wa.me deep link', !!waHref && waHref.startsWith('https://wa.me/'), waHref || '-')
push('gmail-compose deep link', !!mailHref && mailHref.includes('mail.google.com/mail/?view=cm'), (mailHref || '-').slice(0, 60))
push('share-card button', await page.locator('button:has-text("Share card")').count() >= 1)

// ── 8. Email page intact ───────────────────────────────────────
await gotoR('/email')
txt = await page.evaluate(() => document.body.innerText)
push('email page intact', /Gmail/i.test(txt))

// ── errors ─────────────────────────────────────────────────────
for (const r of routes) { await page.goto(BASE + r, { waitUntil: 'load' }); await page.waitForTimeout(480) }
const nested = await page.evaluate(() => document.querySelectorAll('button button, button a, a button').length)
push('no invalid nested buttons anywhere', nested === 0, nested ? `${nested} offenders` : '')
const realErr = errors.filter(e => !e.includes('ERR_INTERNET') && !e.includes('CORS'))
push('zero pageerrors', realErr.length === 0, realErr.slice(0, 3).join(' | ').slice(0, 240))

await browser.close()
const fails = results.filter(r => !r.ok)
console.log(`\n${results.length - fails.length}/${results.length} passed`)
process.exit(fails.length ? 1 : 0)
