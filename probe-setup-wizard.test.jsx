/**
 * First-run setup wizard probe — the guided new-device flow from the design:
 * welcome path picker (start fresh / restore / Google / Gist) + profile &
 * language, pincode, notification permission, and the keep-or-wipe finish.
 * Also locks in the grandfather rule: pre-wizard installs never see it.
 */
import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { CrmProvider } from './src/store'
import App from './src/App'
import { detectBackup, encryptBackup, decryptBackup, ENC_MARKER } from './src/lib/vault'

afterEach(() => cleanup())

const iso = () => new Date().toISOString()
const hasSubtle = !!globalThis.crypto?.subtle

function freshState(overrides = {}) {
  return {
    contacts: [], tasks: [], events: [], notes: [], noteLabels: [], files: [], devices: [],
    reminders: [], kbArticles: [], kbCollections: [], kbViews: {}, tags: [], groups: [], rules: [],
    audit: [], activity: [], imports: [], relFreq: {}, snoozes: {}, carddav: null,
    gcal: { connected: false, email: null, lastSync: null }, notifState: {},
    notifPrefs: { task: true, 'follow-up': true, birthday: true, event: true, system: true, note: true, remind: true },
    reminderPrefs: { sound: 'bell', volume: 0.7, vibrate: true, enabled: true, leadDefault: 10 },
    lock: { hash: null, skipped: true },
    ...overrides,
  }
}

async function mount() {
  window.location.hash = '#/'
  return render(
    <HashRouter>
      <CrmProvider>
        <App />
      </CrmProvider>
    </HashRouter>
  )
}

describe('welcome step (the design)', () => {
  it('shows the four paths, skip link and the privacy footer on a brand-new device', async () => {
    window.localStorage.clear()   // truly fresh — no pcrm-v1 at all
    await mount()
    await screen.findByText('Welcome to Personal CRM')
    expect(screen.getByText("I'm new — start fresh")).toBeTruthy()
    expect(screen.getByText('Restore a backup')).toBeTruthy()
    expect(screen.getByText('Connect with Google')).toBeTruthy()
    expect(screen.getByText('Multi-device sync via GitHub Gist')).toBeTruthy()
    expect(screen.getByText(/Skip setup — open with sample data/)).toBeTruthy()
    expect(screen.getByText(/no server and no account/)).toBeTruthy()
    // image copy: "Nothing leaves this phone unless you choose a sync path."
    expect(screen.getByText(/Nothing leaves this phone/)).toBeTruthy()
  })

  it('grandfather rule: existing installs (no onboard field) never see the wizard', async () => {
    window.localStorage.clear()
    window.localStorage.setItem('pcrm-v1', JSON.stringify(freshState()))   // pre-wizard install
    await mount()
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByText('Welcome to Personal CRM')).toBeNull()
    // app shell is up instead
    expect(screen.getByTitle('Upcoming reminders')).toBeTruthy()
  })
})

describe('the full new-device journey', () => {
  it('start fresh → profile+language → pin → notifications → keep samples → app opens', async () => {
    window.localStorage.clear()
    await mount()
    fireEvent.click(await screen.findByTestId('wiz-path-new'))
    // profile step — name + language
    fireEvent.change(await screen.findByTestId('wiz-name'), { target: { value: 'Rahim Uddin' } })
    fireEvent.click(screen.getByTestId('wiz-lang-bn'))
    fireEvent.click(screen.getByTestId('wiz-profile-next'))
    // pin step
    fireEvent.change(await screen.findByTestId('wiz-pin'), { target: { value: '1234' } })
    fireEvent.change(screen.getByTestId('wiz-pin2'), { target: { value: '1234' } })
    fireEvent.click(screen.getByTestId('wiz-pin-set'))
    // notifications step
    fireEvent.click(await screen.findByTestId('wiz-notify-skip'))
    // done — keep samples
    fireEvent.click(await screen.findByTestId('wiz-done-keep'))
    // app is open
    await waitFor(() => expect(screen.getByTitle('Upcoming reminders')).toBeTruthy())
    const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
    expect(saved.onboard.done).toBe(true)
    expect(saved.onboard.path).toBe('new')
    expect(saved.myCard.name).toBe('Rahim Uddin')
    expect(saved.lang).toBe('bn')
    expect(saved.lock.hash).toBeTruthy()        // pin was set
    expect((saved.contacts || []).length).toBeGreaterThan(0)   // samples kept
  })

  it('skip link opens straight away with sample data', async () => {
    window.localStorage.clear()
    await mount()
    fireEvent.click(await screen.findByTestId('wiz-skip'))
    await waitFor(() => expect(screen.getByTitle('Upcoming reminders')).toBeTruthy())
    const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
    expect(saved.onboard.done).toBe(true)
    expect(saved.onboard.path).toBe('skip')
    expect(saved.lock.skipped).toBe(true)   // never stranded on the lock screen
  })

  it('the done step can wipe the samples for a clean CRM', async () => {
    window.localStorage.clear()
    await mount()
    fireEvent.click(await screen.findByTestId('wiz-path-new'))
    fireEvent.click(await screen.findByTestId('wiz-profile-next'))
    fireEvent.click(await screen.findByTestId('wiz-pin-skip'))
    fireEvent.click(await screen.findByTestId('wiz-notify-skip'))
    fireEvent.click(await screen.findByTestId('wiz-done-wipe'))
    await waitFor(() => expect(screen.getByTitle('Upcoming reminders')).toBeTruthy())
    const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
    expect(saved.onboard.wiped).toBe(true)
    expect(saved.contacts).toEqual([])
    expect(saved.tasks).toEqual([])
  })
})

describe('restore path', () => {
  const backupText = JSON.stringify({
    app: 'personal-crm', version: 2, exportedAt: iso(),
    data: {
      contacts: [{ id: 'x1', name: 'Restored Person', phone: '+8801711', email: '', role: '', company: '', tags: [], rel: 'friend', starred: false, introducedBy: null, interests: [], socials: {}, lastContact: '2026-10-01', createdAt: '2026-01-01' }],
      tasks: [], events: [], notes: [],
    },
  })

  it('a plain .json backup restores and continues to the pin step', async () => {
    window.localStorage.clear()
    await mount()
    fireEvent.click(await screen.findByTestId('wiz-path-restore'))
    const input = document.querySelector('input[type="file"]')
    const file = new File([backupText], 'personal-crm-backup.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })
    await screen.findByText(/plain backup, ready to restore/)
    fireEvent.click(screen.getByTestId('wiz-restore-go'))
    await screen.findByTestId('wiz-pin')   // moved on to pin
  })

  it('detectBackup sorts plain / encrypted / junk', () => {
    expect(detectBackup(backupText)).toBe('plain')
    expect(detectBackup(JSON.stringify({ marker: ENC_MARKER, data: 'x' }))).toBe('encrypted')
    expect(detectBackup('<html>nope</html>')).toBe('unknown')
    expect(detectBackup('')).toBe('unknown')
  })

  it.skipIf(!hasSubtle)('encrypted .pcrm.json roundtrip — wrong password changes nothing', async () => {
    const enc = await encryptBackup(backupText, 'hunter42')
    expect(detectBackup(enc)).toBe('encrypted')
    const back = await decryptBackup(enc, 'hunter42')
    expect(back).toBe(backupText)
    await expect(decryptBackup(enc, 'wrong-pw')).rejects.toThrow(/Wrong password/)
    await expect(encryptBackup(backupText, 'ab')).rejects.toThrow(/at least 4/)
  })
})

describe('google + gist paths', () => {
  it('the google step accepts a Client ID and continues', async () => {
    window.localStorage.clear()
    await mount()
    fireEvent.click(await screen.findByTestId('wiz-path-google'))
    fireEvent.change(await screen.findByTestId('wiz-google-id'), { target: { value: 'abc.apps.googleusercontent.com' } })
    fireEvent.click(screen.getByTestId('wiz-google-save'))
    await screen.findByTestId('wiz-pin')
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.googleClientId).toBe('abc.apps.googleusercontent.com')
    })
  })

  it('the gist step continues even without a token', async () => {
    window.localStorage.clear()
    await mount()
    fireEvent.click(await screen.findByTestId('wiz-path-gist'))
    fireEvent.click(await screen.findByTestId('wiz-gist-save'))
    await screen.findByTestId('wiz-pin')
  })
})
