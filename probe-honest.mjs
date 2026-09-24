/* Phase 1 · item 1 — the app must never fake a feature.
 * Checks: no pretend CardDAV, no pretend Outlook, no "mock" rule run, and the
 * knowledge base agrees with the code. */
import { chromium } from 'playwright'
import { boot } from './probe-boot.mjs'

const BASE = 'http://localhost:5173'
let pass = 0, fail = 0
const ok = (n, c, extra = '') => { c ? (pass++, console.log('  ✓', n)) : (fail++, console.log('  ✗', n, extra)) }

const b = await chromium.launch()
const errors = []

/* ═══ 1. settings → connections ═══ */
{
  const ctx = await b.newContext()
  const pg = await ctx.newPage()
  pg.on('pageerror', e => errors.push('conn: ' + e.message))
  await boot(pg)
  await pg.goto(BASE + '/#/settings'); await pg.waitForTimeout(1400)
  const body = await pg.textContent('body')
  ok('CardDAV is labelled not-in-this-build', body.includes('Not in this build'))
  // (the gist token is a password field too — that one is real and stays)
  ok('no CardDAV credential form is collected',
    (await pg.locator('text=App password').count()) === 0 &&
    (await pg.locator('input[placeholder="https://contacts.icloud.com"]').count()) === 0)
  ok('no "Test connection" button survives', (await pg.locator('button:has-text("Test connection")').count()) === 0)

  // the rule builder must not offer a source we cannot reach
  const opts = await pg.locator('select').first().locator('option').allTextContents()
  ok('CardDAV is not offered as a rule source', !opts.some(o => /carddav/i.test(o)), opts.join('|'))
  ok('ICS feed is offered instead', opts.some(o => /ics feed/i.test(o)), opts.join('|'))
  await ctx.close()
}

/* ═══ 2. running an unreachable rule refuses out loud ═══ */
{
  const ctx = await b.newContext()
  const pg = await ctx.newPage()
  pg.on('pageerror', e => errors.push('rule: ' + e.message))
  await boot(pg)
  await pg.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pcrm-v1'))
    s.rules = [{
      id: 'rx', name: 'iCloud CardDAV import', source: 'CardDAV (iCloud)', direction: 'Import',
      frequency: 'Daily', scope: 'all', scopeGroups: [], scopeTags: [],
      delivery: 'Review queue', conflict: 'manual', enabled: true, lastRun: null,
    }]
    localStorage.setItem('pcrm-v1', JSON.stringify(s))
  })
  await pg.reload(); await pg.waitForTimeout(1300)
  await pg.goto(BASE + '/#/settings'); await pg.waitForTimeout(1400)
  await pg.locator('button[title*="cannot be reached"]').first().click()
  await pg.waitForTimeout(1200)
  const body = await pg.textContent('body')
  ok('running it says the source cannot be reached', /cannot be reached/i.test(body))
  ok('it is logged, not faked', /Rule not supported/.test(body))
  ok('no "Mock run" ever appears', !/Mock run/.test(body))
  ok('the rule timestamp is not faked either', await pg.evaluate(() => {
    const r = JSON.parse(localStorage.getItem('pcrm-v1')).rules[0]
    return !r.lastRun
  }))
  await ctx.close()
}

/* ═══ 3. a rule that can run, runs for real ═══ */
{
  const ctx = await b.newContext()
  const pg = await ctx.newPage()
  pg.on('pageerror', e => errors.push('icsrule: ' + e.message))
  await boot(pg)
  await pg.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pcrm-v1'))
    s.rules = [{
      id: 'r1', name: 'Calendar feeds → CRM', source: 'ICS feed', direction: 'Import',
      frequency: 'Daily', scope: 'all', scopeGroups: [], scopeTags: [],
      delivery: 'Auto-apply changes', conflict: 'newest', enabled: true, lastRun: null,
    }]
    localStorage.setItem('pcrm-v1', JSON.stringify(s))
  })
  await pg.reload(); await pg.waitForTimeout(1300)
  await pg.goto(BASE + '/#/settings'); await pg.waitForTimeout(1400)
  await pg.locator('button[title="Run now"]').first().click()
  await pg.waitForTimeout(1500)
  const body = await pg.textContent('body')
  ok('a reachable rule reports what happened', /no calendar feeds subscribed|refreshed|Rule run/i.test(body), body.slice(0, 80))
  await ctx.close()
}

/* ═══ 4. Outlook is not pretend-connected ═══ */
{
  const ctx = await b.newContext()
  const pg = await ctx.newPage()
  pg.on('pageerror', e => errors.push('outlook: ' + e.message))
  await boot(pg)
  await pg.goto(BASE + '/#/integrations'); await pg.waitForTimeout(1300)
  ok('integrations board marks Outlook unavailable', (await pg.textContent('body')).includes('NOT IN THIS BUILD'))
  await pg.goto(BASE + '/#/email'); await pg.waitForTimeout(1300)
  ok('email screen offers no Outlook connect button', (await pg.textContent('body')).includes('Not in this build'))
  await ctx.close()
}

/* ═══ 5. the knowledge base agrees with the code ═══ */
{
  const ctx = await b.newContext()
  const pg = await ctx.newPage()
  pg.on('pageerror', e => errors.push('kb: ' + e.message))
  await boot(pg)
  await pg.goto(BASE + '/#/knowledge'); await pg.waitForTimeout(1400)
  await pg.locator('input[placeholder*="Search the manual"]').fill('CardDAV')
  await pg.waitForTimeout(700)
  let body = await pg.textContent('body')
  ok('searching CardDAV no longer promises a working connector',
    !/Test connection|Point it at a CardDAV server/i.test(body))
  ok('the ICS article is what it points to', /Calendar feeds/.test(body), body.slice(0, 120))
  await pg.locator('input[placeholder*="Search the manual"]').fill('')
  await ctx.close()
}

ok('zero unexpected page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
console.log(`\n${fail === 0 ? 'ALL GREEN' : 'FAILURES'} — ${pass} passed, ${fail} failed`)
await b.close()
process.exit(fail ? 1 : 0)
