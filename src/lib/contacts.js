/* Phone-contact mapping & import matching — pure helpers (testable, no native calls).
 *
 * Import rows everywhere in the app are the flat shape:
 *   { name, phone, email, org, bday }
 */

/* ── matching (dedupe) ───────────────────────────────────────────
 * Priority: normalized phone → normalized email → name (case-insensitive).
 * Same rules in the ImportPage preview AND store.commitImport so the
 * diff the user approves is exactly what gets committed. */
export const normPhone = s => {
  const d = String(s || '').replace(/\D/g, '')
  return d.length > 10 ? d.slice(-10) : d        // last 10 digits beat country-code noise
}
export const normEmail = s => String(s || '').trim().toLowerCase()
export const normName = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')

export function matchExisting(contacts, row) {
  const ph = normPhone(row.phone)
  if (ph) {
    const hit = contacts.find(c => normPhone(c.phone) === ph)
    if (hit) return hit
  }
  const em = normEmail(row.email)
  if (em) {
    const hit = contacts.find(c => normEmail(c.email) === em)
    if (hit) return hit
  }
  const nm = normName(row.name)
  if (nm) {
    const hit = contacts.find(c => normName(c.name) === nm)
    if (hit) return hit
  }
  return null
}

/* ── native plugin shape → row ────────────────────────────────── */
const bdayFromParts = b => {
  if (!b || !b.month || !b.day) return null
  const y = b.year ? String(b.year).padStart(4, '0') : '0000'
  return `${y}-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`
}

export function mapNativeContact(c) {
  const name = c?.name?.display ||
    [c?.name?.given, c?.name?.middle, c?.name?.family].filter(Boolean).join(' ').trim()
  return {
    name,
    phone: c?.phones?.find(p => p?.number)?.number || '',
    email: c?.emails?.find(e => e?.address)?.address || '',
    org: c?.organization?.company || '',
    bday: bdayFromParts(c?.birthday),
  }
}

/* ── Chrome Contact Picker API shape → row ────────────────────── */
export function mapPickerContact(c) {
  return {
    name: (c?.name || []).filter(Boolean).join(' ').trim(),
    phone: (c?.tel || [])[0] || '',
    email: (c?.email || [])[0] || '',
    org: (c?.org || [])[0] || '',
    bday: null,
  }
}

/* ── row → native createContact input ─────────────────────────── */
export function toNativeContactInput(row) {
  const parts = String(row.name || '').trim().split(/\s+/)
  const given = parts[0] || ''
  const family = parts.length > 1 ? parts.slice(1).join(' ') : ''
  const contact = {
    name: { given, family, display: row.name || '' },
    organization: row.org ? { company: row.org, jobTitle: null, department: null } : undefined,
    phones: row.phone ? [{ type: 'mobile', number: row.phone, isPrimary: true }] : undefined,
    emails: row.email ? [{ type: 'home', address: row.email, isPrimary: true }] : undefined,
  }
  if (row.bday && /^\d{4}-\d{2}-\d{2}$/.test(row.bday) && !row.bday.startsWith('0000')) {
    const [y, m, d] = row.bday.split('-').map(Number)
    contact.birthday = { year: y, month: m, day: d }
  }
  return contact
}

/* rows without a name can't be committed — drop them early */
export const usableRows = rows => (rows || []).filter(r => r && r.name && r.name.trim())
