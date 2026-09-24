/* Phase 0 probe — publisher credit, About screen, legal pages, sanitised seed data */
import { chromium } from 'playwright'
import { boot } from './probe-boot.mjs'

const BASE = 'http://localhost:5173'
let pass = 0, fail = 0
const ok = (n, c, extra = '') => { c ? (pass++, console.log('  ✓', n)) : (fail++, console.log('  ✗', n, extra)) }

const b = await chromium.launch()
const ctx = await b.newContext()
const pg = await ctx.newPage()
const errors = []
pg.on('pageerror', e => errors.push(e.message))
pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

await boot(pg, BASE + '/#/')

/* ── 1. sidebar / global credit ── */
const side = await pg.locator('aside').first().textContent()
ok('sidebar shows app + version', side.includes('Personal CRM') && side.includes('v'), side.slice(-90))
ok('sidebar shows BITSCOL copyright', side.includes('© 2026 BITSCOL'))

/* ── 2. About screen ── */
await pg.goto(BASE + '/#/about'); await pg.waitForTimeout(1000)
const about = await pg.locator('body').textContent()
ok('About screen renders', about.includes('Version 2.0.0') && about.includes('BITSCOL'))
ok('credit: publisher name', about.includes('Designed and developed by'))
ok('credit: copyright line', about.includes('© 2026 BITSCOL. All rights reserved.'))
ok('credit: website', about.includes('www.bitscol.com'))
ok('credit: email', about.includes('sales@bitscol.com'))
ok('credit: mobile', about.includes('+880 1711-853769'))
ok('legal: privacy link', about.includes('Privacy Policy'))
ok('legal: terms link', about.includes('Terms of Use'))
ok('open-source credits listed', about.includes('React') && about.includes('Lucide'))
ok('local-first statement', about.includes('never uploaded to a server we operate'))

const links = await pg.evaluate(() => ({
  web:   document.querySelector('a[href*="bitscol.com"]')?.href || '',
  mail:  document.querySelector('a[href^="mailto:"]')?.href || '',
  tel:   document.querySelector('a[href^="tel:"]')?.href || '',
  priv:  document.querySelector('a[href*="privacy.html"]')?.href || '',
  terms: document.querySelector('a[href*="terms.html"]')?.href || '',
}))
ok('website link correct', links.web.includes('www.bitscol.com'), links.web)
ok('email link correct', links.mail === 'mailto:sales@bitscol.com', links.mail)
ok('phone link correct', links.tel === 'tel:+8801711853769', links.tel)
ok('privacy URL correct', links.priv.endsWith('/privacy.html'), links.priv)
ok('terms URL correct', links.terms.endsWith('/terms.html'), links.terms)

/* ── 3. static legal pages ── */
for (const [file, must] of [['privacy.html', ['BITSCOL', 'no server', 'sales@bitscol.com', '+880 1711-853769']],
                            ['terms.html', ['BITSCOL', 'licensed, not sold', 'sales@bitscol.com', 'Bangladesh']]]) {
  await pg.goto(`${BASE}/${file}`); await pg.waitForTimeout(400)
  const t = await pg.locator('body').textContent()
  ok(`${file} served & complete`, must.every(m => t.includes(m)), must.filter(m => !t.includes(m)).join(', '))
}

/* ── 4. seed data is fictional ── */
await pg.goto(BASE + '/#/contacts'); await pg.waitForTimeout(1100)
const seed = await pg.evaluate(() => JSON.parse(localStorage.getItem('pcrm-v1')))
const all = JSON.stringify(seed.contacts)
const banned = ['SkyBridge', 'Tiger IT', 'BRAC', 'bKash', 'Pathao', 'BUET', 'Daily Star',
                'TradePort', 'FinEdge', 'x.com/', 'linkedin.com/in/', 'facebook.com/', 'instagram.com/']
ok('no real orgs/handles in seed', !banned.some(b => all.includes(b)), banned.filter(b => all.includes(b)).join(', '))
const phones = seed.contacts.map(c => c.phone).filter(Boolean)
ok('phone numbers synthetic', phones.every(p => /\+880 1700-|\+91 98000-/.test(p)), phones.slice(0, 3).join(' | '))
const emails = seed.contacts.map(c => c.email).filter(Boolean)
ok('emails use example.com', emails.every(e => e.endsWith('@example.com')), emails.slice(0, 2).join(' | '))

/* ── 5. no runtime errors ── */
ok('zero page errors', errors.length === 0, errors.slice(0, 2).join(' | '))

console.log(`\n${fail === 0 ? 'ALL GREEN' : 'FAILURES'} — ${pass} passed, ${fail} failed`)
await b.close()
process.exit(fail ? 1 : 0)
