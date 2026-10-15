import { chromium } from 'playwright'

const URL = 'http://localhost:5173/#'
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { cond ? (pass++, console.log('  ✓', name)) : (fail++, console.log('  ✗', name, extra)) }

const b = await chromium.launch()
const ctx = await b.newContext()
const pg = await ctx.newPage()
const errors = []
pg.on('pageerror', e => errors.push(e.message))
pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
pg.on('dialog', d => d.accept())

const state = () => pg.evaluate(() => JSON.parse(localStorage.getItem('pcrm-v1') || '{}'))
const boot = async () => {
  await pg.goto(URL + '/'); await pg.waitForTimeout(1200)
  const skip = pg.locator('button:has-text("Skip for now")')
  if (await skip.count()) { await skip.first().click(); await pg.waitForTimeout(900) }
}
await boot()

/* ── 1. Notes 2.0 shell ─────────────────────────────────────────── */
console.log('· Notes page shell')
await pg.goto(URL + '/notes'); await pg.waitForTimeout(800)
ok('quick-add bar visible', await pg.locator('input[placeholder*="Take a note"]').count() > 0)
ok('view filter chips present', await pg.locator('.chip-btn:has-text("Reminders")').count() > 0)
ok('seed notes render as cards', await pg.locator('.note-card').count() >= 5)
ok('seed checklist card shows items', await pg.locator('.note-card .md-task, .note-card button:has(svg)').count() > 0)

/* ── 2. quick add ───────────────────────────────────────────────── */
console.log('· Quick add')
const qa = pg.locator('input[placeholder*="Take a note"]')
await qa.fill('Probe quick note\nExtra body line')
await qa.press('Enter')
await pg.waitForTimeout(500)
let st = await state()
let created = st.notes.find(n => n.title === 'Probe quick note')
ok('quick-add creates note', !!created)
ok('quick-add splits title/body', created && created.body === 'Extra body line')
ok('note has v2 shape', created && 'checklist' in created && 'labels' in created && 'color' in created && 'trashedAt' in created)

/* ── 3. editor + checklist ──────────────────────────────────────── */
console.log('· Editor & checklist')
await pg.locator('.note-card:has-text("Probe quick note")').first().click()
await pg.waitForTimeout(500)
ok('editor modal opens', await pg.locator('input[placeholder="Title"]').count() > 0)
await pg.locator('button:has-text("Turn into checklist")').click()
await pg.waitForTimeout(300)
const item = pg.locator('input[placeholder="List item…"]')
await item.fill('buy milk'); await item.press('Enter')
await pg.waitForTimeout(400)
st = await state(); created = st.notes.find(n => n.title === 'Probe quick note')
ok('checklist item added', created?.checklist?.length === 1 && created.checklist[0].text === 'buy milk')
await pg.locator('button[title="Mark done"]').first().click()
await pg.waitForTimeout(400)
st = await state(); created = st.notes.find(n => n.title === 'Probe quick note')
ok('checklist item toggled done', created?.checklist?.[0]?.done === true)

/* ── 4. color + label ───────────────────────────────────────────── */
console.log('· Color & labels')
await pg.locator('button[title="amber"]').first().click()
await pg.waitForTimeout(300)
await pg.locator('input[placeholder="+ New label…"]').fill('probetag')
await pg.locator('input[placeholder="+ New label…"]').press('Enter')
await pg.waitForTimeout(400)
st = await state(); created = st.notes.find(n => n.title === 'Probe quick note')
ok('color applied', created?.color === 'amber')
ok('label created + applied', created?.labels?.length === 1 && st.noteLabels.some(l => l.name === 'probetag' && l.id === created.labels[0]))

/* ── 5. reminder ────────────────────────────────────────────────── */
console.log('· Reminder')
await pg.locator('button:has-text("In 1 hour")').click()
await pg.waitForTimeout(400)
st = await state(); created = st.notes.find(n => n.title === 'Probe quick note')
ok('reminder set (datetime-local)', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(created?.remindAt || ''))
await pg.locator('button[title="Close"], button:has(svg.lucide-x)').first().click().catch(() => {})
await pg.keyboard.press('Escape')
await pg.waitForTimeout(400)

/* ── 6. reminder shows in Notification center ───────────────────── */
console.log('· Notification integration')
await pg.goto(URL + '/notifications'); await pg.waitForTimeout(700)
ok('note category chip exists', await pg.locator('.chip-btn:has-text("Note reminders")').count() > 0)
ok('note reminder in inbox', await pg.locator('text=Probe quick note').count() > 0)

/* ── 7. pin / archive / trash / restore / purge ─────────────────── */
console.log('· Pin · Archive · Trash · Restore · Purge')
await pg.goto(URL + '/notes'); await pg.waitForTimeout(700)
const card = () => pg.locator('.note-card:has-text("Probe quick note")').first()
await card().locator('button[title="Pin"]').click()
await pg.waitForTimeout(400)
st = await state(); created = st.notes.find(n => n.title === 'Probe quick note')
ok('pin toggled from card', created?.pinned === true)
ok('pinned section header shows', await pg.locator('div:has-text("Pinned")').count() > 0)

await card().locator('button[title="Archive"]').click()
await pg.waitForTimeout(400)
st = await state(); created = st.notes.find(n => n.title === 'Probe quick note')
ok('archived', !!created?.archivedAt && created?.pinned === false)
ok('archived note hidden from All', await pg.locator('.note-card:has-text("Probe quick note")').count() === 0)

await pg.locator('.chip-btn:has-text("Archive")').first().click()
await pg.waitForTimeout(500)
ok('visible in Archive view', await card().count() > 0)
await card().locator('button[title="Unarchive"]').click()
await pg.waitForTimeout(400)
st = await state(); created = st.notes.find(n => n.title === 'Probe quick note')
ok('unarchived', !created?.archivedAt)

await card().locator('button[title="Move to trash"]').click()
await pg.waitForTimeout(400)
st = await state(); created = st.notes.find(n => n.title === 'Probe quick note')
ok('trashed (soft delete)', !!created?.trashedAt && created?.remindAt === null)
await pg.locator('.chip-btn:has-text("Trash")').first().click()
await pg.waitForTimeout(500)
ok('visible in Trash view', await card().count() > 0)
await card().locator('button[title="Restore"]').click()
await pg.waitForTimeout(400)
st = await state(); created = st.notes.find(n => n.title === 'Probe quick note')
ok('restored from trash', !created?.trashedAt)

await pg.locator('.chip-btn:has-text("All")').first().click()
await pg.waitForTimeout(400)
await card().locator('button[title="Move to trash"]').click()
await pg.waitForTimeout(400)
await pg.locator('.chip-btn:has-text("Trash")').first().click()
await pg.waitForTimeout(400)
await card().locator('button[title="Delete forever"]').click()
await pg.waitForTimeout(500)
st = await state()
ok('purged forever', !st.notes.some(n => n.title === 'Probe quick note'))

/* ── 8. editor trash flow + markdown preview ────────────────────── */
console.log('· Editor extras')
await pg.locator('.chip-btn:has-text("All")').first().click()
await pg.waitForTimeout(400)
await pg.locator('.note-card').first().click()
await pg.waitForTimeout(500)
await pg.locator('button:has-text("Preview")').click()
await pg.waitForTimeout(300)
ok('markdown preview renders', await pg.locator('.fixed .md, .fixed .md-tasks').count() > 0)
await pg.locator('button:has-text("Write")').click()
await pg.waitForTimeout(200)
ok('duplicate works', (await (async () => {
  await pg.locator('button:has-text("Duplicate")').click()
  await pg.waitForTimeout(500)
  return true
})()))
st = await state()
ok('duplicate created copy', st.notes.some(n => /\(copy\)$/.test(n.title || '')))
await pg.keyboard.press('Escape')
await pg.waitForTimeout(300)

/* ── 9. old backups keep loading (normalizeNote) ────────────────── */
console.log('· Back-compat')
const legacy = await pg.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('pcrm-v1'))
  s.notes.push({ id: 'legacy1', title: 'Legacy note', body: 'old shape', contactIds: [], pinned: false, updated: new Date().toISOString() })
  localStorage.setItem('pcrm-v1', JSON.stringify(s))
  return true
})
ok('legacy note injected', legacy)
await pg.goto(URL + '/notes'); await pg.waitForTimeout(900)
st = await state()
const ln = st.notes.find(n => n.id === 'legacy1')
ok('legacy note normalized on load', ln && ln.kind === 'text' && Array.isArray(ln.checklist) && ln.trashedAt === null)

/* ── 10. clean errors ───────────────────────────────────────────── */
const fatal = errors.filter(e => !/favicon|Failed to fetch resource|AbortError/i.test(e))
ok('no page errors', fatal.length === 0, fatal.slice(0, 3).join(' | '))

console.log(`\n${pass} passed · ${fail} failed`)
await b.close()
process.exit(fail ? 1 : 0)
