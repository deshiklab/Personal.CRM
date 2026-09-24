/* Visiting-card scan + per-contact photo/card upload. */
import { chromium } from 'playwright'
import { boot } from './probe-boot.mjs'
import { readFileSync, existsSync } from 'fs'
import { parseCardText } from './src/lib/cardscan.js'

const BASE = 'http://localhost:5173'
let pass = 0, fail = 0
const ok = (n, c, extra = '') => { c ? (pass++, console.log('  ✓', n)) : (fail++, console.log('  ✗', n, extra)) }

/* ── pure parser unit checks (no browser) ── */
{
  const sample = `
ACME LOGISTICS LTD
Karim Sheikh
Managing Director
+880 1711-853769
karim@acme-logistics.example
www.acme-logistics.example
House 12, Road 4, Dhanmondi, Dhaka 1205
`
  const d = parseCardText(sample)
  ok('parser picks the person name', /karim/i.test(d.name), JSON.stringify(d))
  ok('parser picks a phone', /880|1711/.test(d.phone.replace(/\s/g,'')), d.phone)
  ok('parser picks an email', /karim@/.test(d.email), d.email)
  ok('parser picks a website', /acme-logistics/.test(d.website), d.website)
  ok('parser picks company or role', !!(d.company || d.role), JSON.stringify({ c: d.company, r: d.role }))

  const sparse = parseCardText('Only A Name\n')
  ok('parser survives sparse input', sparse.name.length > 0)

  const empty = parseCardText('')
  ok('parser survives empty input', empty.name === '' && empty.phone === '')
}

/* ── bundle + OCR assets ── */
{
  const bundle = readFileSync(new URL('./dist/index.html', import.meta.url), 'utf8')
  ok('bundle mentions visiting-card scan', /Scan card|cardscan|ScanLine|visiting card/i.test(bundle))
  ok('bundle includes tesseract', /tesseract|createWorker/i.test(bundle))
  ok('OCR worker is shipped', existsSync('dist/ocr/worker.min.js'))
  ok('OCR language data is shipped', existsSync('dist/ocr/eng.traineddata.gz'))
  ok('OCR core wasm is shipped', existsSync('dist/ocr/tesseract-core-simd-lstm.wasm.js') || existsSync('dist/ocr/tesseract-core-lstm.wasm.js'))
}

/* ── UI surfaces ── */
const b = await chromium.launch()
const ctx = await b.newContext()
const pg = await ctx.newPage()
const errors = []
pg.on('pageerror', e => errors.push(e.message))
await boot(pg)

await pg.goto(BASE + '/#/contacts'); await pg.waitForTimeout(1200)
ok('Scan card button on Contacts', (await pg.locator('button:has-text("Scan card")').count()) > 0)

await pg.locator('button:has-text("Scan card")').first().click(); await pg.waitForTimeout(700)
ok('scan modal opens', (await pg.locator('text=Snap or drop a visiting card').count()) > 0)
ok('scan modal offers camera', (await pg.locator('button:has-text("Take photo")').count()) > 0)
ok('scan modal offers file picker', (await pg.locator('button:has-text("Choose image")').count()) > 0)
await pg.keyboard.press('Escape'); await pg.waitForTimeout(400)

/* open first contact drawer and look for photo/card panel */
await pg.locator('table tbody tr.rowclick, table tbody tr').first().click(); await pg.waitForTimeout(900)
const body = await pg.locator('body').textContent()
ok('drawer shows Photo & visiting card', /Photo & visiting card/i.test(body))
ok('drawer offers Add/Change photo', /Add photo|Change photo|Add\b|Change\b/i.test(body))
ok('drawer offers Scan for a card', (await pg.locator('button:has-text("Scan")').count()) > 0)
ok('drawer offers Upload for a card', (await pg.locator('button:has-text("Upload")').count()) > 0)

/* knowledge base article */
await pg.goto(BASE + '/#/knowledge?a=people.cardscan'); await pg.waitForTimeout(1200)
ok('KB article for card scan is reachable', /Scan a visiting card|visiting card/i.test(await pg.locator('body').textContent()))

ok('zero page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
console.log(`\n${fail === 0 ? 'ALL GREEN' : 'FAILURES'} — ${pass} passed, ${fail} failed`)
await b.close()
process.exit(fail ? 1 : 0)
