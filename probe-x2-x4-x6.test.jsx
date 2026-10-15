/**
 * X2 QR business cards + X4 contact timeline + X6 বাংলা toggle probe.
 */
import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { CrmProvider } from './src/store'
import App from './src/App'
import { toVCF, parseVCF } from './src/lib/vcard'
import { STRINGS, t, setI18nLang, getLang } from './src/lib/i18n'

afterEach(() => {
  cleanup()
  setI18nLang('en')
  try { sessionStorage.clear() } catch { /* noop */ }
})

const iso = () => new Date().toISOString()

function seed(extra = {}) {
  window.localStorage.clear()
  window.localStorage.setItem('pcrm-v1', JSON.stringify({
    contacts: [], tasks: [], events: [], notes: [], noteLabels: [], files: [], devices: [],
    reminders: [], kbArticles: [], kbCollections: [], kbViews: {}, tags: [], groups: [], rules: [],
    audit: [], activity: [], imports: [], relFreq: {}, snoozes: {}, carddav: null,
    gcal: { connected: false, email: null, lastSync: null }, notifState: {},
    notifPrefs: { task: true, 'follow-up': true, birthday: true, event: true, system: true, note: true, remind: true },
    reminderPrefs: { sound: 'bell', volume: 0.7, vibrate: true, enabled: true, leadDefault: 10 },
    lock: { hash: null, skipped: true },
    ...extra,
  }))
}

async function mount(hash) {
  window.location.hash = hash
  return render(
    <HashRouter>
      <CrmProvider>
        <App />
      </CrmProvider>
    </HashRouter>
  )
}

const contact = (id, name) => ({
  id, name, role: 'Engineer', company: 'BiTsCol', phone: '+8801711000000', email: 'a@b.co',
  birthday: null, anniversary: null, tags: [], rel: 'friend', starred: false, introducedBy: null,
  interests: [], socials: {}, lastContact: '2026-10-01', createdAt: '2026-01-01',
})

describe('X4 contact timeline', () => {
  it('merges touchpoints, notes, tasks, events and reminders into one stream', async () => {
    seed({
      contacts: [contact('c1', 'Rahim Uddin')],
      activity: [
        { id: 'a1', ts: iso(), text: 'Logged contact with Rahim Uddin', contactId: 'c1' },
        { id: 'a2', ts: '2026-01-01T10:00:00.000Z', text: 'Created contact', contactId: 'c1' },
      ],
      notes: [{ id: 'n1', title: 'Lunch notes', body: 'x', contactIds: ['c1'], labels: [], pinned: false, trashedAt: null, archived: false, color: '#818cf8', createdAt: iso(), updatedAt: iso() }],
      tasks: [{ id: 't1', title: 'Send proposal', column: 'todo', priority: 'high', due: '2026-11-01', contactId: 'c1', tags: [], repeat: 'none', createdAt: iso(), doneAt: null }],
      events: [{ id: 'e1', title: 'Coffee meeting', date: '2026-10-20', time: '10:00', contactId: 'c1', type: 'meeting' }],
      reminders: [{ id: 'r1', refType: 'contact', refId: 'c1', title: 'Call Rahim', at: iso(), repeat: 'none', status: 'scheduled' }],
    })
    await mount('#/contacts')
    const [row] = await screen.findAllByText('Rahim Uddin')   // table + mobile cards
    fireEvent.click(row)
    const tl = await screen.findByTestId('contact-timeline')
    expect(within(tl).getByText(/Logged contact with Rahim/)).toBeTruthy()
    expect(within(tl).getByText(/Note: Lunch notes/)).toBeTruthy()
    expect(within(tl).getByText(/Task: Send proposal/)).toBeTruthy()
    expect(within(tl).getByText(/Event: Coffee meeting/)).toBeTruthy()
    expect(within(tl).getByText(/Reminder: Call Rahim/)).toBeTruthy()
  })

  it('shows a friendly empty state when nothing is logged', async () => {
    seed({ contacts: [contact('c1', 'Rahim Uddin')] })
    await mount('#/contacts')
    const [row] = await screen.findAllByText('Rahim Uddin')
    fireEvent.click(row)
    const tl = await screen.findByTestId('contact-timeline')
    expect(within(tl).getByText(/Nothing logged yet/)).toBeTruthy()
  })
})

describe('X2 QR business cards', () => {
  it('my-card fields persist and feed a vCard', async () => {
    seed()
    await mount('#/contacts')
    fireEvent.click(await screen.findByTestId('qr-card-btn'))
    fireEvent.change(await screen.findByTestId('mycard-name'), { target: { value: 'Rahim Uddin' } })
    fireEvent.change(screen.getByTestId('mycard-phone'), { target: { value: '+8801711000000' } })
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.myCard.name).toBe('Rahim Uddin')
      expect(saved.myCard.phone).toBe('+8801711000000')
    })
  })

  it('vCard roundtrip through toVCF → parseVCF keeps identity fields', () => {
    const vcf = toVCF({ name: 'Rahim Uddin', phone: '+8801711000000', email: 'a@b.co', company: 'BiTsCol' })
    const rows = parseVCF(vcf)
    expect(rows.length).toBe(1)
    expect(rows[0].name).toBe('Rahim Uddin')
    expect(rows[0].phone).toBe('+8801711000000')
    expect(rows[0].email).toBe('a@b.co')
    expect(rows[0].org).toBe('BiTsCol')
  })

  it('the import page picks up a scanned vCard from the handoff', async () => {
    seed()
    const vcf = toVCF({ name: 'Scanned Person', phone: '+8801811000000' })
    sessionStorage.setItem('pcrm-vcard-in', vcf)
    await mount('#/import')
    await waitFor(() => {
      const ta = document.querySelector('textarea')
      expect(ta.value).toContain('Scanned Person')
    })
    // handoff is single-shot
    expect(sessionStorage.getItem('pcrm-vcard-in')).toBeNull()
  })

  it('scanner degrades gracefully without a camera', async () => {
    seed()
    await mount('#/contacts')
    fireEvent.click(await screen.findByTestId('qr-card-btn'))
    fireEvent.click(await screen.findByTestId('qr-tab-scan'))
    fireEvent.click(await screen.findByTestId('qr-scan-start'))
    await waitFor(() => expect(screen.getByText(/Camera unavailable/)).toBeTruthy())
  })
})

describe('X6 language toggle', () => {
  it('switching to বাংলা translates the navigation chrome and persists', async () => {
    seed()
    await mount('#/settings')
    fireEvent.click(await screen.findByTestId('lang-bn'))
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.lang).toBe('bn')
    })
    // sidebar nav is translated (multiple chrome places may render the label)
    expect((await screen.findAllByText('কন্টাক্টস')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('সেটিংস').length).toBeGreaterThan(0)
    // and back to English
    fireEvent.click(screen.getByTestId('lang-en'))
    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /Contacts/ }).length).toBeGreaterThan(0)
    })
  })

  it('the lock screen speaks the selected language', () => {
    setI18nLang('bn')
    expect(t('lock.choose')).toBe('পিন নির্বাচন করুন')
    expect(t('nav.dashboard')).toBe('ড্যাশবোর্ড')
    expect(getLang()).toBe('bn')
    setI18nLang('en')
    expect(t('lock.choose')).toBe('Choose pincode')
    // unknown keys fall back to a provided default
    expect(t('nope.key', 'Fallback')).toBe('Fallback')
    // both tables cover the same keys
    const en = Object.keys(STRINGS.en).sort()
    const bn = Object.keys(STRINGS.bn).sort()
    expect(bn).toEqual(en)
  })
})
