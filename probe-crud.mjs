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

const state = () => pg.evaluate(() => JSON.parse(localStorage.getItem('pcrm-v1') || '{}'))
const boot = async () => {
  await pg.goto(URL + '/'); await pg.waitForTimeout(1200)
  const skip = pg.locator('button:has-text("Skip for now")')
  if (await skip.count()) { await skip.first().click(); await pg.waitForTimeout(900) }
}
await boot()

/* ── 1. EDIT a contact ───────────────────────────────────────────── */
await pg.goto(URL + '/contacts'); await pg.waitForTimeout(1000)
const before = await state()
const first = before.contacts[0]
const groups = before.groups
const otherGroup = groups.find(g => g.id !== first.groupIds?.[0]) || groups[1]
console.log('editing', first.name, '· adding group', otherGroup.name)

await pg.locator(`tr:has-text("${first.name}") button[title="Edit contact"]`).first().click()
await pg.waitForTimeout(600)
ok('edit modal opened', await pg.locator('text=Edit ' + first.name).count() > 0)
await pg.locator('.fixed input').first().fill(first.name + ' Jr')
// tick a second group in the modal
await pg.locator(`.fixed button:has-text("${otherGroup.name}")`).first().click()
await pg.waitForTimeout(200)
await pg.locator('.fixed button:has-text("Save changes")').click()
await pg.waitForTimeout(900)

let st = await state()
let edited = st.contacts.find(c => c.id === first.id)
ok('name saved', edited?.name === first.name + ' Jr', edited?.name)
ok('contact now in 2 groups', edited?.groupIds?.length === 2, JSON.stringify(edited?.groupIds))
ok('groupId stays in sync (legacy)', edited?.groupId === edited?.groupIds[0])
ok('row shows both groups', await pg.locator(`tr:has-text("${first.name} Jr")`).first().textContent().then(t => t.includes(otherGroup.name)))

/* ── 2. SELECTION + BULK ─────────────────────────────────────────── */
const target = st.contacts.slice(1, 4)
for (const c of target) {
  await pg.locator(`input[aria-label="Select ${c.name}"]`).first().check()
  await pg.waitForTimeout(120)
}
ok('bulk bar shows 3 selected', (await pg.locator('text=3 selected').count()) > 0)

const bulkGroup = groups.find(g => !g.name.includes('Lead')) || groups[2]
await pg.selectOption('select[aria-label="Add selected to group"]', bulkGroup.id)
await pg.waitForTimeout(800)
st = await state()
const inBulk = target.every(c => st.contacts.find(x => x.id === c.id)?.groupIds.includes(bulkGroup.id))
ok(`bulk added 3 contacts to "${bulkGroup.name}"`, inBulk)

await pg.selectOption('select[aria-label="Remove selected from group"]', bulkGroup.id)
await pg.waitForTimeout(800)
st = await state()
const outBulk = target.every(c => !st.contacts.find(x => x.id === c.id)?.groupIds.includes(bulkGroup.id))
ok(`bulk removed same 3 from "${bulkGroup.name}"`, outBulk)

// bulk delete (no pin set yet → plain confirm)
const nBefore = st.contacts.length
await pg.locator('button:has-text("Delete")').last().click()
await pg.waitForTimeout(500)
ok('confirm dialog (no pin set) appears', (await pg.locator('text=Delete 3 contacts?').count()) > 0)
await pg.locator('.fixed button:has-text("Delete 3")').click()
await pg.waitForTimeout(900)
st = await state()
ok('3 contacts deleted', st.contacts.length === nBefore - 3, `${nBefore} → ${st.contacts.length}`)
ok('selection cleared after delete', (await pg.locator('text=selected').count()) === 0)

/* ── 3. SET A PIN, then delete must ask for it ───────────────────── */
await pg.goto(URL + '/settings'); await pg.waitForTimeout(1100)
await pg.locator('button:has-text("Set pincode")').first().click()
await pg.waitForTimeout(500)
const pinDots = pg.locator('.fixed input[placeholder="••••"]')
await pinDots.nth(0).fill('4321'); await pinDots.nth(1).fill('4321')
await pg.locator('.fixed button:has-text("Confirm")').first().click()
await pg.waitForTimeout(1000)
st = await state()
ok('pincode set', !!st.lock?.hash)

/* ── 4. DELETE ONE CONTACT → PIN GATE ────────────────────────────── */
await pg.goto(URL + '/contacts'); await pg.waitForTimeout(1100)
st = await state()
const victim = st.contacts[0]
const cntBefore = st.contacts.length
await pg.locator(`tr:has-text("${victim.name}") button[title="Delete contact"]`).first().click()
await pg.waitForTimeout(500)
ok('pin prompt shown for delete', (await pg.locator('text=Enter your pincode to confirm').count()) > 0)

// wrong pin is rejected
await pg.locator('.fixed input[aria-label="Pincode"]').fill('1111')
await pg.locator('.fixed button:has-text("Delete contact")').click()
await pg.waitForTimeout(700)
ok('wrong pin rejected', (await pg.locator('text=Wrong pincode').count()) > 0)
st = await state()
ok('contact survives wrong pin', st.contacts.length === cntBefore)

// right pin deletes
await pg.locator('.fixed input[aria-label="Pincode"]').fill('4321')
await pg.locator('.fixed button:has-text("Delete contact")').click()
await pg.waitForTimeout(1000)
st = await state()
ok('correct pin deletes contact', st.contacts.length === cntBefore - 1, `${cntBefore} → ${st.contacts.length}`)
ok('deleted contact gone', !st.contacts.some(c => c.id === victim.id))

/* ── 5. GROUPS: edit + delete ────────────────────────────────────── */
await pg.goto(URL + '/groups'); await pg.waitForTimeout(1100)
st = await state()
const grp = st.groups[0]
const grpMembers = st.contacts.filter(c => (c.groupIds || []).includes(grp.id)).length
await pg.locator(`button[title="Edit group"]`).first().click()
await pg.waitForTimeout(500)
await pg.locator('.fixed input').first().fill(grp.name + ' ★')
await pg.locator('.fixed button:has-text("Save changes")').click()
await pg.waitForTimeout(900)
st = await state()
ok('group renamed', st.groups.find(g => g.id === grp.id)?.name === grp.name + ' ★')

await pg.locator('button[title="Delete group"]').first().click()
await pg.waitForTimeout(500)
ok('group delete asks for pin', (await pg.locator('text=Enter your pincode to confirm').count()) > 0)
await pg.locator('.fixed input[aria-label="Pincode"]').fill('4321')
await pg.locator('.fixed button:has-text("Delete group")').click()
await pg.waitForTimeout(1000)
st = await state()
ok('group deleted', !st.groups.some(g => g.id === grp.id))
ok('contacts kept after group delete', st.contacts.length === (await state()).contacts.length && st.contacts.length > 0)
ok('members detached from deleted group', st.contacts.every(c => !(c.groupIds || []).includes(grp.id)))
console.log(`  (group "${grp.name}" had ${grpMembers} members — all kept)`)

/* ── 6. drawer edit + delete buttons ─────────────────────────────── */
await pg.goto(URL + '/contacts'); await pg.waitForTimeout(1000)
st = await state()
const dc = st.contacts[0]
await pg.locator(`tr:has-text("${dc.name}")`).first().click()
await pg.waitForTimeout(700)
ok('drawer Edit details button', (await pg.locator('button:has-text("Edit details")').count()) > 0)
ok('drawer Delete contact button', (await pg.locator('button:has-text("Delete contact")').count()) > 0)
ok('drawer groups section', (await pg.locator('text=a contact can sit in several').count()) > 0)

/* ── 7. no runtime errors ────────────────────────────────────────── */
ok('zero page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

console.log(`\n${fail === 0 ? 'ALL GREEN' : 'FAILURES'} — ${pass} passed, ${fail} failed`)
await b.close()
process.exit(fail ? 1 : 0)
