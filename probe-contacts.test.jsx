/* Phone Contacts import/export + import-pipeline dedupe (jsdom).
 * State carries across tests via localStorage, like the playwright probes. */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { CrmProvider } from './src/store'
import App from './src/App'
import { normPhone, matchExisting, mapNativeContact, mapPickerContact, toNativeContactInput } from './src/lib/contacts'

const getState = () => JSON.parse(localStorage.getItem('pcrm-v1') || '{}')

const renderApp = (hash = '#/import') => {
  window.location.hash = hash
  return render(<HashRouter><CrmProvider><App /></CrmProvider></HashRouter>)
}

const uploadVcf = (text, name = 'contacts.vcf') => {
  const input = document.querySelector('input[type="file"]')
  const file = new File([text], name, { type: 'text/vcard' })
  fireEvent.change(input, { target: { files: [file] } })
  return file
}

beforeAll(() => { window.confirm = vi.fn(() => true) })
afterEach(cleanup)

const VCF_A = `BEGIN:VCARD
VERSION:3.0
FN:Nadia Islam
TEL;TYPE=CELL:+880 1712-901122
EMAIL:nadia.islam@gmail.com
ORG:Grameenphone
END:VCARD`

const VCF_B = `BEGIN:VCARD
VERSION:3.0
FN:Nadia I.
TEL;TYPE=CELL:01712901122
EMAIL:nadia.i@gmail.com
ORG:Grameenphone Ltd
END:VCARD`

describe('contacts: pure mapping & matching', () => {
  it('normPhone ignores formatting and country codes', () => {
    expect(normPhone('+880 1712-901122')).toBe('1712901122')
    expect(normPhone('01712901122')).toBe('1712901122')
    expect(normPhone('(017) 129-01122')).toBe('1712901122')
    expect(normPhone('12345')).toBe('12345')
  })

  it('mapNativeContact flattens the plugin payload', () => {
    const row = mapNativeContact({
      name: { display: 'Nadia Islam', given: 'Nadia', family: 'Islam' },
      phones: [{ number: '+8801712901122', type: 'mobile' }],
      emails: [{ address: 'nadia@gmail.com', type: 'home' }],
      organization: { company: 'Grameenphone', jobTitle: null },
      birthday: { year: 1994, month: 3, day: 8 },
    })
    expect(row).toEqual({ name: 'Nadia Islam', phone: '+8801712901122', email: 'nadia@gmail.com', org: 'Grameenphone', bday: '1994-03-08' })
  })

  it('mapNativeContact keeps yearless birthdays as 0000-MM-DD', () => {
    expect(mapNativeContact({ name: { display: 'X Y' }, birthday: { month: 12, day: 25 } }).bday).toBe('0000-12-25')
  })

  it('mapPickerContact flattens Chrome picker payloads', () => {
    expect(mapPickerContact({ name: ['Omar', 'Faruk'], tel: ['+8801555776655'], email: ['o@x.com'], org: ['Robi'] }))
      .toEqual({ name: 'Omar Faruk', phone: '+8801555776655', email: 'o@x.com', org: 'Robi', bday: null })
  })

  it('toNativeContactInput round-trips a row (and skips yearless bday)', () => {
    const input = toNativeContactInput({ name: 'Nadia Islam', phone: '01712901122', email: 'n@x.com', org: 'GP', bday: '1994-03-08' })
    expect(input.name.given).toBe('Nadia')
    expect(input.name.family).toBe('Islam')
    expect(input.phones[0].number).toBe('01712901122')
    expect(input.birthday).toEqual({ year: 1994, month: 3, day: 8 })
    expect(toNativeContactInput({ name: 'X', bday: '0000-12-25' }).birthday).toBeUndefined()
  })

  it('matchExisting: phone → email → name priority, normalized', () => {
    const contacts = [
      { id: '1', name: 'Nadia Islam', phone: '+880 1712-901122', email: 'old@x.com' },
      { id: '2', name: 'Omar Faruk', phone: '', email: 'Omar@X.com' },
    ]
    expect(matchExisting(contacts, { name: 'Someone Else', phone: '01712901122' })?.id).toBe('1')
    expect(matchExisting(contacts, { name: 'Other Person', email: 'omar@x.com' })?.id).toBe('2')
    expect(matchExisting(contacts, { name: 'nadia  islam' })?.id).toBe('1')
    expect(matchExisting(contacts, { name: 'Brand New', phone: '999' })).toBe(null)
  })
})

describe('contacts: import pipeline UI', () => {
  it('boots the Import page with the phone card + honest hint', async () => {
    renderApp()
    const skip = screen.queryByRole('button', { name: /Skip for now/i })
    if (skip) fireEvent.click(skip)
    await screen.findByText("From your phone")
    expect(screen.getByText('From your phone')).toBeTruthy()
    /* jsdom has no native plugin and no contact picker → honest fallback copy */
    expect(screen.getByText(/requires the Android app/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Import from phone/ }).disabled).toBe(true)
  })

  it('?phone=1 deep link explains itself when no phone access exists', async () => {
    renderApp('#/import?phone=1')
    await screen.findByText(/No phone contact access here/)
  })

  it('uploads a .vcf → diff preview → commit adds the contact', async () => {
    renderApp()
    await screen.findByText("From your phone")
    uploadVcf(VCF_A, 'phones.vcf')
    /* FileReader is async in jsdom */
    await waitFor(() => expect(screen.getByPlaceholderText(/Paste vCard/).value).toContain('BEGIN:VCARD'))
    fireEvent.click(screen.getByRole('button', { name: /Scan/ }))
    await screen.findByText('Preview diff')
    expect(screen.getByText('Nadia Islam')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Import 1 contact/ }))
    await waitFor(() => {
      const st = getState()
      const c = st.contacts.find(x => x.name === 'Nadia Islam')
      expect(c).toBeTruthy()
      expect(c.phone).toBe('+880 1712-901122')
      expect(c.rel).toBe('lead')                       // vcf imports keep the existing default
    })
    const batch = getState().imports[0]
    expect(batch.added).toBe(1)
    expect(batch.source).toContain('phones.vcf')
  })

  it('re-import dedupes by normalized phone even when the name differs', async () => {
    renderApp()
    await screen.findByText("From your phone")
    const before = getState().contacts.length
    uploadVcf(VCF_B, 'again.vcf')
    await waitFor(() => expect(screen.getByPlaceholderText(/Paste vCard/).value).toContain('BEGIN:VCARD'))
    fireEvent.click(screen.getByRole('button', { name: /Scan/ }))
    await screen.findByText('Preview diff')
    /* matched via phone → Update/Skip, never New */
    expect(screen.getByText('Update')).toBeTruthy()
    expect(screen.queryByText('New')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Import 1 contact/ }))
    await waitFor(() => {
      const st = getState()
      expect(st.contacts.length).toBe(before)          // no duplicate person
      const c = st.contacts.find(x => x.name === 'Nadia Islam')
      expect(c.company).toBe('Grameenphone Ltd')       // updated in place
    })
    const batch = getState().imports[0]
    expect(batch.added).toBe(0)
    expect(batch.updated).toBe(1)
  })
})
