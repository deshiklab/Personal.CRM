/* Phone contacts — native (Capacitor) + graceful web fallbacks.
 * Every function resolves to a result object; nothing throws at the UI. */
import { Contacts, PhoneType, EmailType } from '@capacitor-community/contacts'
import { isNative } from './google'
import { mapNativeContact, mapPickerContact, toNativeContactInput, usableRows } from './contacts'

/* ── capability detection ─────────────────────────────────────── */
export const phoneContactsAvailable = () => isNative()
export const contactPickerAvailable = () =>
  typeof navigator !== 'undefined' && !!(navigator.contacts && navigator.contacts.select)
export const canReadPhoneContacts = () => phoneContactsAvailable() || contactPickerAvailable()
export const canWritePhoneContacts = () => phoneContactsAvailable()   // createContact is native-only

export const readHint = () => phoneContactsAvailable()
  ? 'Reads your phone address book (permission required). Nothing is uploaded anywhere.'
  : contactPickerAvailable()
    ? 'This browser can pick contacts one-by-one (Chrome contact picker).'
    : 'Phone contact access requires the Android app (or Chrome on Android/desktop with the contact picker). Import a .vcf file instead — it works everywhere.'

export const writeHint = () => phoneContactsAvailable()
  ? 'Saves a copy into your phone address book (permission required).'
  : 'Saving to the phone address book requires the Android app — use the vCard share button instead.'

/* ── read ─────────────────────────────────────────────────────── */
export async function readPhoneContacts() {
  /* 1. native Android: full address book */
  if (phoneContactsAvailable()) {
    try {
      let perm = await Contacts.checkPermissions()
      if (perm.contacts !== 'granted' && perm.contacts !== 'limited') {
        perm = await Contacts.requestPermissions()
      }
      if (perm.contacts !== 'granted' && perm.contacts !== 'limited') {
        return { ok: false, reason: 'denied', rows: [] }
      }
      const res = await Contacts.getContacts({
        projection: { name: true, phones: true, emails: true, organization: true, birthday: true },
      })
      const rows = usableRows((res.contacts || []).map(mapNativeContact))
      return { ok: true, source: 'phone', rows }
    } catch (e) {
      return { ok: false, reason: e?.message || 'error', rows: [] }
    }
  }
  /* 2. web: Chrome contact picker (one-by-one, user-approved) */
  if (contactPickerAvailable()) {
    try {
      const picked = await navigator.contacts.select(['name', 'tel', 'email', 'org'], { multiple: true })
      const rows = usableRows((picked || []).map(mapPickerContact))
      return { ok: true, source: 'picker', rows }
    } catch (e) {
      return { ok: false, reason: e?.message || 'cancelled', rows: [] }
    }
  }
  return { ok: false, reason: 'unavailable', rows: [] }
}

/* ── write (export to phone) ──────────────────────────────────── */
export async function saveContactToPhone(row) {
  if (!canWritePhoneContacts()) return { ok: false, reason: 'unavailable' }
  try {
    let perm = await Contacts.checkPermissions()
    if (perm.contacts !== 'granted' && perm.contacts !== 'limited') {
      perm = await Contacts.requestPermissions()
    }
    if (perm.contacts !== 'granted' && perm.contacts !== 'limited') {
      return { ok: false, reason: 'denied' }
    }
    const input = toNativeContactInput(row)
    const res = await Contacts.createContact({
      contact: {
        name: input.name,
        organization: input.organization,
        birthday: input.birthday,
        phones: input.phones?.map(p => ({ ...p, type: PhoneType.Mobile })),
        emails: input.emails?.map(e => ({ ...e, type: EmailType.Home })),
      },
    })
    return { ok: true, id: res?.contactId || null }
  } catch (e) {
    return { ok: false, reason: e?.message || 'error' }
  }
}

export async function saveContactsToPhone(rows) {
  let saved = 0, failed = 0
  for (const r of rows) {
    const res = await saveContactToPhone(r)
    res.ok ? saved++ : failed++
  }
  return { saved, failed }
}
