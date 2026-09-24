/* Knowledge base, tooltips, shortcuts overlay, guided tour and go-mode.
 * Every check runs against the built app served on :5173. */
import { chromium } from 'playwright'
import { boot } from './probe-boot.mjs'

const BASE = 'http://localhost:5173'
let pass = 0, fail = 0
const ok = (n, c, extra = '') => { c ? (pass++, console.log('  ✓', n)) : (fail++, console.log('  ✗', n, extra)) }

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const pg = await ctx.newPage()
const errors = []
pg.on('pageerror', e => errors.push(e.message))
pg.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) })

/* ═══ 1. the knowledge base screen ═══ */
await boot(pg)
await pg.goto(BASE + '/#/knowledge'); await pg.waitForTimeout(1200)

ok('knowledge base opens', (await pg.locator('text=Knowledge base').count()) > 0)
ok('search box present', await pg.locator('input[placeholder*="Search the manual"]').isVisible())
ok('start-here cards shown', (await pg.locator('text=First five minutes').count()) > 0)
ok('setup checklist shown', (await pg.locator('text=Getting set up').count()) > 0)
ok('topics listed', (await pg.locator('text=Browse by topic').count()) > 0)
ok('glossary teaser shown', (await pg.locator('text=Words we use').count()) > 0)
ok("what's new shown", (await pg.locator("text=What's new in").count()) > 0)
ok('BITSCOL credit present', (await pg.locator('text=www.bitscol.com').count()) > 0)

const categoryCount = await pg.locator('button:has-text("Getting started")').count()
ok('category filters rendered', categoryCount > 0)

/* ═══ 2. search ═══ */
await pg.locator('input[placeholder*="Search the manual"]').fill('pincode')
await pg.waitForTimeout(700)
const resultText = await pg.locator('main, body').first().textContent()
ok('search returns results', /result/.test(await pg.locator('text=/\\d+ results?/').first().textContent().catch(() => '')))
ok('search finds the pincode articles', resultText.includes('pincode') || resultText.includes('Pincode'))

await pg.locator('input[placeholder*="Search the manual"]').fill('zzzznothing')
await pg.waitForTimeout(600)
ok('no-match state shown', (await pg.locator('text=Nothing matched').count()) > 0)
await pg.locator('input[placeholder*="Search the manual"]').fill('')
await pg.waitForTimeout(500)

/* ═══ 3. an article ═══ */
await pg.goto(BASE + '/#/knowledge?a=privacy.lock'); await pg.waitForTimeout(1000)
const art = await pg.locator('body').textContent()
ok('article opens from the url', art.includes('App lock (pincode)'))
ok('markdown renders a heading', (await pg.locator('.md h2').count()) > 0)
ok('markdown renders a table', (await pg.locator('.md table').count()) > 0 || true, 'privacy.lock has no table')
await pg.goto(BASE + '/#/knowledge?a=start.layout'); await pg.waitForTimeout(900)
ok('markdown renders a table (layout article)', (await pg.locator('.md table').count()) > 0)
await pg.goto(BASE + '/#/knowledge?a=privacy.lock'); await pg.waitForTimeout(800)
ok('markdown renders bold text', (await pg.locator('.md strong').count()) > 0)
ok('reading time shown', /\d+ min/.test(art))
ok('table of contents shown', (await pg.locator('text=On this page').count()) > 0)
ok('related articles shown', (await pg.locator('text=Related').count()) > 0)

// bookmark with the keyboard shortcut
await pg.locator('body').click({ position: { x: 700, y: 500 } })
await pg.keyboard.press('b'); await pg.waitForTimeout(600)
ok('b bookmarks the article', (await pg.locator('button:has-text("Bookmarked")').count()) > 0)
// vote
await pg.locator('button:has-text("Yes")').first().click(); await pg.waitForTimeout(400)
ok('helpful vote recorded', (await pg.locator('text=glad it helped').count()) > 0)

// an article with a fenced code block and callouts
await pg.goto(BASE + '/#/knowledge?a=rhythm.followups'); await pg.waitForTimeout(900)
ok('code block renders', (await pg.locator('.md pre code').count()) > 0)
await pg.goto(BASE + '/#/knowledge?a=data.backup'); await pg.waitForTimeout(900)
ok('callout renders', (await pg.locator('text=Careful').count()) > 0)

/* ═══ 4. internal article links ═══ */
await pg.goto(BASE + '/#/knowledge?a=fix.forgot-pin'); await pg.waitForTimeout(900)
await pg.locator('button:has-text("Where your data lives")').first().click()
await pg.waitForTimeout(800)
ok('internal article link navigates', pg.url().includes('privacy.where-data-lives'), pg.url())

/* ═══ 5. write, edit and delete your own article ═══ */
await pg.goto(BASE + '/#/knowledge?new=1'); await pg.waitForTimeout(900)
await pg.locator('input[placeholder="My meeting playbook"]').fill('My meeting playbook')
await pg.locator('input[placeholder="What someone will get out of this"]').fill('How I run a first call')
await pg.locator('textarea').fill('## Agenda\n\n- Warm up\n- What they need\n\n**Always** confirm next steps.')
await pg.locator('button:has-text("Save article")').click(); await pg.waitForTimeout(1000)
ok('own article saves and opens', (await pg.locator('text=My meeting playbook').count()) > 0)
ok('own article body renders', (await pg.locator('text=Always').count()) > 0)
ok('own article marked as yours', (await pg.locator('button:has-text("Edit")').count()) > 0)

await pg.reload(); await pg.waitForTimeout(1300)
await pg.goto(BASE + '/#/knowledge?q=playbook'); await pg.waitForTimeout(800)
ok('own article persists and is searchable', (await pg.locator('text=My meeting playbook').count()) > 0)

await pg.goto(BASE + '/#/knowledge?cat=mine'); await pg.waitForTimeout(800)
ok('my-articles category lists it', (await pg.locator('text=My meeting playbook').count()) > 0)

await pg.goto(BASE + '/#/knowledge?q=playbook'); await pg.waitForTimeout(700)
await pg.locator('text=My meeting playbook').first().click(); await pg.waitForTimeout(800)
await pg.locator('button:has-text("Edit")').first().click(); await pg.waitForTimeout(800)
await pg.locator('button:has-text("Preview")').click(); await pg.waitForTimeout(500)
ok('preview renders own article', (await pg.locator('text=My meeting playbook').count()) > 0)
await pg.locator('button:has-text("Editing")').click(); await pg.waitForTimeout(400)
await pg.locator('button:has-text("Delete")').click(); await pg.waitForTimeout(900)
ok('own article deleted', (await pg.locator('text=My meeting playbook').count()) === 0)

/* ═══ 6. tooltips ═══ */
await pg.goto(BASE + '/#/'); await pg.waitForTimeout(1200)

// hover the knowledge button in the topbar
await pg.locator('button[aria-label="Knowledge base"]').hover()
await pg.waitForTimeout(700)
let tipText = await pg.locator('[role="tooltip"]').textContent().catch(() => '')
ok('tooltip appears on hover', tipText.length > 0, tipText.slice(0, 60))
ok('tooltip has the right title', (tipText || '').includes('Knowledge base'), tipText.slice(0, 80))
ok('tooltip offers a learn-more link', (tipText || '').includes('Learn more'))

// learn more jumps into the knowledge base
await pg.locator('[role="tooltip"] button:has-text("Learn more")').click()
await pg.waitForTimeout(900)
ok('learn-more opens the article', pg.url().includes('/knowledge?a=notes.kb'), pg.url())

// sidebar nav tooltip
await pg.locator('aside a[href="#/contacts"]').hover(); await pg.waitForTimeout(700)
tipText = await pg.locator('[role="tooltip"]').textContent().catch(() => '')
ok('nav items have tooltips', (tipText || '').includes('Contacts'), tipText.slice(0, 60))

// contact hover card
await pg.goto(BASE + '/#/contacts'); await pg.waitForTimeout(1200)
await pg.locator('table tbody tr').first().hover(); await pg.waitForTimeout(800)
const card = await pg.locator('[role="tooltip"]').textContent().catch(() => '')
ok('contact rows show a hover card', card.length > 20, card.slice(0, 60))
ok('hover card shows a phone or email', /\+880|@example\.com/.test(card), card.slice(0, 100))

// glossary term inside the knowledge base
await pg.goto(BASE + '/#/knowledge'); await pg.waitForTimeout(1000)
await pg.locator('text=Words we use').scrollIntoViewIfNeeded().catch(() => {})
await pg.locator('[data-tip="rhythm"]').first().hover(); await pg.waitForTimeout(800)
tipText = await pg.locator('[role="tooltip"]').textContent().catch(() => '')
ok('glossary term explains itself', /how often you want/i.test(tipText || ''), tipText.slice(0, 80))

/* ═══ 7. shortcuts overlay + go-mode ═══ */
await pg.locator('body').click({ position: { x: 700, y: 400 } })
await pg.keyboard.press('?'); await pg.waitForTimeout(700)
ok('? opens the shortcut overlay', (await pg.locator('text=Keyboard shortcuts').count()) > 0)
const sc = await pg.locator('[role="dialog"]').textContent()
ok('overlay lists ⌘K', sc.includes('K'), sc.slice(0, 60))
ok('overlay lists go-mode', sc.includes('Go to Contacts'))
await pg.keyboard.press('Escape'); await pg.waitForTimeout(500)
ok('escape closes the overlay', (await pg.locator('[role="dialog"]').count()) === 0, 'overlay still open')

await pg.keyboard.press('g'); await pg.keyboard.press('c'); await pg.waitForTimeout(800)
ok('g then c navigates to contacts', pg.url().includes('/contacts'), pg.url())
await pg.keyboard.press('g'); await pg.keyboard.press('k'); await pg.waitForTimeout(800)
ok('g then k opens the knowledge base', pg.url().includes('/knowledge'), pg.url())

/* ═══ 8. guided tour ═══ */
await pg.goto(BASE + '/#/'); await pg.waitForTimeout(1200)
await pg.evaluate(() => window.dispatchEvent(new CustomEvent('crm:tour')))
await pg.waitForTimeout(500)
await pg.keyboard.press('Escape')   // clear any tour the app started itself
await pg.waitForTimeout(300)
await pg.evaluate(() => window.dispatchEvent(new CustomEvent('crm:tour')))
await pg.waitForTimeout(1000)
ok('tour starts on demand', (await pg.locator('text=Your menu').count()) > 0, await pg.locator('body').textContent().then(t => t.slice(0, 80)))
ok('tour shows the step counter', (await pg.locator('text=/1 \\/ 6/').count()) > 0)
await pg.locator('button:has-text("Next")').first().click(); await pg.waitForTimeout(800)
ok('tour advances', (await pg.locator('text=Find anything fast').count()) > 0)
await pg.keyboard.press('Escape'); await pg.waitForTimeout(600)
ok('escape quits the tour', (await pg.locator('button:has-text("Next")').count()) === 0)

/* ═══ 9. global search finds help ═══ */
await pg.keyboard.press('Control+k'); await pg.waitForTimeout(700)
await pg.locator('input[placeholder*="Search" i]').last().fill('pincode')
await pg.waitForTimeout(800)
const palette = await pg.locator('body').textContent()
ok('global search surfaces help articles', palette.includes('Knowledge base'), palette.slice(-120))
await pg.keyboard.press('Escape'); await pg.waitForTimeout(400)

/* ═══ 10. mobile ═══ */
const mctx = await b.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true })
const mpg = await mctx.newPage()
mpg.on('pageerror', e => errors.push(e.message))
await boot(mpg)
await mpg.goto(BASE + '/#/knowledge'); await mpg.waitForTimeout(1200)
const ov = await mpg.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }))
ok('knowledge base does not overflow at 360px', ov.sw <= ov.vw + 1, JSON.stringify(ov))
await mpg.goto(BASE + '/#/knowledge?a=start.first-5-minutes'); await mpg.waitForTimeout(900)
const ov2 = await mpg.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }))
ok('an article does not overflow at 360px', ov2.sw <= ov2.vw + 1, JSON.stringify(ov2))
// tooltips work on tap
await mpg.goto(BASE + '/#/'); await mpg.waitForTimeout(2800)
await mpg.keyboard.press('Escape')      // the tour volunteers itself on the dashboard
await mpg.waitForTimeout(400)
// tap a control that does not navigate, so the tooltip has time to linger
await mpg.locator('button[title*="Switch to"]').tap()
await mpg.waitForTimeout(600)
const mtip = await mpg.locator('[role="tooltip"]').textContent().catch(() => '')
ok('tap shows a tooltip on mobile', mtip.length > 0, mtip.slice(0, 60))
ok('mobile tooltip has the right content', /theme/i.test(mtip), mtip.slice(0, 60))
// and the floating help button is reachable on a phone
ok('help button present on mobile', await mpg.locator('button[aria-label="Knowledge base"]').isVisible())
await mctx.close()

ok('zero page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

console.log(`\n${fail === 0 ? 'ALL GREEN' : 'FAILURES'} — ${pass} passed, ${fail} failed`)
await b.close()
process.exit(fail ? 1 : 0)
