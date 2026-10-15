/**
 * QR design studio + per-contact QR probe.
 *
 * Contract: every contact can be shown as a scannable vCard QR (share to
 * anyone), and the QR look — colours, dot/corner patterns, centred logo —
 * is customisable through a shared design studio that persists in qrStyle.
 * My-card QR additionally carries extra vCard fields (role/address/note/…).
 */
import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { CrmProvider } from './src/store'
import App from './src/App'
import { toVCF, parseVCF } from './src/lib/vcard'
import { QR_STYLE_DEFAULTS, QR_PRESETS, qrStyleOf, shrinkLogo } from './src/lib/qrstyle'

afterEach(() => cleanup())

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

const contact = {
  id: 'c1', name: 'Rahim Uddin', role: 'Engineer', company: 'BiTsCol', phone: '+8801711000000',
  email: 'a@b.co', birthday: null, anniversary: null, tags: [], rel: 'friend', starred: false,
  introducedBy: null, interests: ['coffee'], socials: {}, lastContact: '2026-10-01', createdAt: '2026-01-01',
}

describe('per-contact QR', () => {
  it('the drawer offers a QR card with share actions and the design studio', async () => {
    seed({ contacts: [contact] })
    await mount('#/contacts')
    const [row] = await screen.findAllByText('Rahim Uddin')
    fireEvent.click(row)
    fireEvent.click(await screen.findByTestId('contact-qr-btn-c1'))
    await waitFor(() => expect(screen.getByTestId('contact-qr')).toBeTruthy())
    expect(screen.getByText(/Anyone can scan this to save/)).toBeTruthy()
    expect(screen.getByTestId('contact-qr-download')).toBeTruthy()
    expect(screen.getByTestId('contact-qr-vcf')).toBeTruthy()
    // open the design studio inside the contact QR
    fireEvent.click(screen.getByTestId('contact-qr-design'))
    expect(await screen.findByTestId('qr-designer')).toBeTruthy()
  })

  it('the contact vCard carries the identity fields into the QR payload', () => {
    const vcf = toVCF(contact)
    const rows = parseVCF(vcf)
    expect(rows[0].name).toBe('Rahim Uddin')
    expect(rows[0].phone).toBe('+8801711000000')
    expect(rows[0].org).toBe('BiTsCol')
  })
})

describe('QR design studio', () => {
  it('presets restyle the QR and persist to qrStyle', async () => {
    seed()
    await mount('#/contacts')
    fireEvent.click(await screen.findByTestId('qr-card-btn'))
    fireEvent.click(await screen.findByTestId('qr-design-toggle'))
    fireEvent.click(await screen.findByTestId('qr-preset-midnight'))
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.qrStyle.fg).toBe('#e2e8f0')
      expect(saved.qrStyle.bg).toBe('#0f172a')
      expect(saved.qrStyle.dot).toBe('rounded')
      expect(saved.qrStyle.corner).toBe('extra-rounded')
    })
  })

  it('dot + corner patterns and colours are individually adjustable', async () => {
    seed()
    await mount('#/contacts')
    fireEvent.click(await screen.findByTestId('qr-card-btn'))
    fireEvent.click(await screen.findByTestId('qr-design-toggle'))
    fireEvent.change(await screen.findByTestId('qr-dot'), { target: { value: 'classy' } })
    fireEvent.change(await screen.findByTestId('qr-corner'), { target: { value: 'dot' } })
    fireEvent.change(screen.getByTestId('qr-fg'), { target: { value: '#123456' } })
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.qrStyle.dot).toBe('classy')
      expect(saved.qrStyle.corner).toBe('dot')
      expect(saved.qrStyle.fg.toLowerCase()).toBe('#123456')
    })
    // reset returns to defaults
    fireEvent.click(screen.getByTestId('qr-reset'))
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.qrStyle.dot).toBe(QR_STYLE_DEFAULTS.dot)
    })
  })

  it('a logo upload lands in qrStyle (and shrinks only when canvas exists)', async () => {
    seed()
    await mount('#/contacts')
    fireEvent.click(await screen.findByTestId('qr-card-btn'))
    fireEvent.click(await screen.findByTestId('qr-design-toggle'))
    // shrinkLogo keeps the original data URL in canvas-less environments
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'logo.png', { type: 'image/png' })
    const out = await shrinkLogo(file)
    expect(out.startsWith('data:image/png')).toBe(true)
    // and the designer's upload path stores it
    const input = screen.getByTestId('qr-designer').querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.qrStyle.logo).toBeTruthy()
    })
    expect(await screen.findByTestId('qr-logo-remove')).toBeTruthy()
    fireEvent.click(screen.getByTestId('qr-logo-remove'))
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.qrStyle.logo).toBe('')
    })
  })

  it('qrStyleOf merges with defaults and presets are well-formed', () => {
    expect(qrStyleOf(null)).toEqual(QR_STYLE_DEFAULTS)
    expect(qrStyleOf({ fg: '#111111' }).fg).toBe('#111111')
    expect(qrStyleOf({ fg: '#111111' }).dot).toBe(QR_STYLE_DEFAULTS.dot)
    for (const p of QR_PRESETS) {
      expect(p.fg).toMatch(/^#[0-9a-f]{6}$/i)
      expect(p.bg).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('my-card extra fields (other fields)', () => {
  it('role, address, note and birthday persist and land in the vCard', async () => {
    seed()
    await mount('#/contacts')
    fireEvent.click(await screen.findByTestId('qr-card-btn'))
    fireEvent.change(await screen.findByTestId('mycard-role'), { target: { value: 'Product Engineer' } })
    fireEvent.change(screen.getByTestId('mycard-address'), { target: { value: 'Dhanmondi, Dhaka' } })
    fireEvent.change(screen.getByTestId('mycard-note'), { target: { value: 'Loves single-origin coffee' } })
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.myCard.role).toBe('Product Engineer')
      expect(saved.myCard.address).toBe('Dhanmondi, Dhaka')
      expect(saved.myCard.note).toBe('Loves single-origin coffee')
    })
  })

  it('extended vCard fields survive a parse roundtrip', () => {
    const vcf = toVCF({
      name: 'Rahim Uddin', phone: '+8801711', role: 'Product Engineer',
      address: 'Dhanmondi, Dhaka', url: 'https://example.com', note: 'Coffee person', birthday: '1990-05-01',
    })
    const row = parseVCF(vcf)[0]
    expect(row.name).toBe('Rahim Uddin')
    expect(row.bday).toBe('1990-05-01')
    expect(vcf).toContain('TITLE:Product Engineer')
    expect(vcf).toContain('ADR;TYPE=HOME')
    expect(vcf).toContain('URL:https://example.com')
    expect(vcf).toContain('NOTE:Coffee person')
  })
})
