import { chromium } from 'playwright'
const b = await chromium.launch(); const ctx = await b.newContext(); const pg = await ctx.newPage()
const errs = []; pg.on('pageerror', e => errs.push(e.message))
await pg.goto('http://localhost:5173/#/'); await pg.waitForTimeout(400)
// simulate an OLD save: contacts with the legacy single groupId field only
await pg.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('pcrm-v1'))
  s.contacts = s.contacts.slice(0, 3).map((c, i) => ({ ...c, groupId: 'g_work', groupIds: undefined, name: 'Legacy ' + i }))
  s.lock = { hash: null, skipped: true }
  localStorage.setItem('pcrm-v1', JSON.stringify(s))
})
await pg.reload(); await pg.waitForTimeout(1200)
await pg.goto('http://localhost:5173/#/contacts'); await pg.waitForTimeout(1100)
const st = await pg.evaluate(() => JSON.parse(localStorage.getItem('pcrm-v1')))
const c = st.contacts.find(x => x.name === 'Legacy 0')
console.log('migrated contact:', JSON.stringify({ groupIds: c.groupIds, groupId: c.groupId }))
console.log('groups filter works:', await pg.selectOption('select', 'g_work').then(()=>true).catch(()=>false))
await pg.waitForTimeout(600)
const rows = await pg.locator('tbody tr').count()
console.log('rows shown when filtering by Work Colleagues:', rows)
console.log('errors:', errs.length)
console.log(rows === 3 && c.groupIds[0] === 'g_work' && errs.length === 0 ? 'LEGACY MIGRATION OK' : 'LEGACY PROBLEM')
await b.close()
