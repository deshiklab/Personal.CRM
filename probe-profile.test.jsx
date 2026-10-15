/**
 * probe-profile — Settings → User Profile (manage your profile)
 *
 * 1. shows the seeded profile (name, initials avatar, role · org, completeness)
 * 2. editor modal opens prefilled and saves all 9 my-card fields to the store
 * 3. Share my card opens the QR business-card modal (my-qr)
 * 4. Copy vCard puts the vCard on the clipboard and confirms with a toast
 * 5. Clear is two-step (Really clear?) and wipes the profile to the empty state
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { CrmProvider, ToastHost } from './src/store'
import SettingsSync from './src/pages/SettingsSync'

const SEED_CARD = {
  name: 'Ada Byron', phone: '15551234567', email: '', org: '', role: '', url: '', address: '', birthday: '', note: '',
}

const mountSettings = (myCard = SEED_CARD) => {
  localStorage.clear()
  localStorage.setItem('pcrm-v1', JSON.stringify({ lock: { hash: null, skipped: true }, myCard }))
  render(<HashRouter><CrmProvider><SettingsSync /><ToastHost /></CrmProvider></HashRouter>)
}

const readCard = () => JSON.parse(localStorage.getItem('pcrm-v1') || '{}').myCard || {}

beforeAll(() => {
  // jsdom gaps used by the settings page — keep quiet where features are optional
  window.matchMedia = window.matchMedia || (q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }))
})
afterEach(cleanup)

describe('probe-profile — Settings → User Profile', () => {
  it('1. shows the seeded profile with initials avatar and completeness', async () => {
    mountSettings()
    await screen.findByText('User Profile')
    // name renders in header + detail row (multiple matches are expected)
    expect(screen.getAllByText('Ada Byron').length).toBeGreaterThan(0)
    expect(screen.getByTestId('profile-avatar').textContent).toBe('AB')
    expect(screen.getByTestId('profile-complete').textContent).toBe('2 of 9 fields')
    expect(screen.getByTestId('profile-detail-name').textContent).toBe('Ada Byron')
    expect(screen.getByTestId('profile-detail-phone').textContent).toBe('15551234567')
    expect(screen.getByTestId('profile-detail-email').textContent).toBe('—')
  })

  it('2. editor opens prefilled and saves all 9 fields to the store', async () => {
    mountSettings()
    fireEvent.click(await screen.findByTestId('profile-edit'))
    const name = await screen.findByTestId('profile-f-name')
    expect(name.value).toBe('Ada Byron')
    const next = {
      name: 'Grace Hopper', phone: '15559876543', email: 'grace@navy.example', org: 'US Navy',
      role: 'Rear Admiral', url: 'https://grace.example', address: '1 Navy Way', birthday: '1906-12-09',
      note: 'First programmer · COBOL',
    }
    for (const [k, v] of Object.entries(next)) {
      fireEvent.change(screen.getByTestId(`profile-f-${k}`), { target: { value: v } })
    }
    fireEvent.click(screen.getByTestId('profile-save'))
    await waitFor(() => expect(readCard().name).toBe('Grace Hopper'))
    expect(readCard().email).toBe('grace@navy.example')
    expect(readCard().note).toBe('First programmer · COBOL')
    // view reflects the save (header + detail row both show it)
    await waitFor(() => expect(screen.getAllByText('Grace Hopper').length).toBeGreaterThan(0))
    expect(screen.getByTestId('profile-complete').textContent).toBe('9 of 9 fields')
    expect(screen.getByTestId('profile-avatar').textContent).toBe('GH')
  })

  it('3. Share my card opens the QR business-card modal', async () => {
    mountSettings()
    fireEvent.click(await screen.findByTestId('profile-share'))
    await screen.findByTestId('my-qr')
    expect(screen.getByTestId('qr-tab-card')).toBeTruthy()
    expect(screen.getByTestId('qr-tab-scan')).toBeTruthy()
  })

  it('4. Copy vCard copies the card and confirms with a toast', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    mountSettings()
    fireEvent.click(await screen.findByTestId('profile-copy'))
    await screen.findByText(/vCard copied/)
    expect(writeText).toHaveBeenCalledTimes(1)
    const copied = writeText.mock.calls[0][0]
    expect(copied).toContain('BEGIN:VCARD')
    expect(copied).toContain('FN:Ada Byron')
    expect(copied).toContain('TEL;TYPE=CELL:15551234567')
  })

  it('5. Clear is two-step and wipes the profile to the empty state', async () => {
    mountSettings()
    fireEvent.click(await screen.findByTestId('profile-clear'))
    // first click arms the confirm — nothing cleared yet
    const yes = await screen.findByTestId('profile-clear-yes')
    expect(readCard().name).toBe('Ada Byron')
    fireEvent.click(yes)
    await screen.findByText(/No profile yet/)
    await waitFor(() => expect(readCard().name).toBe(''))
    expect(readCard().phone).toBe('')
    expect(screen.getByTestId('profile-complete').textContent).toBe('0 of 9 fields')
  })
})
