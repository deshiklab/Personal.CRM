/**
 * X3 biometric unlock + X7 home-screen shortcuts probe.
 *
 * X3: a WebAuthn platform authenticator (fingerprint/face) can be enrolled
 * alongside the pincode; the unlock screen offers it; PIN remains fallback;
 * changing the PIN keeps enrollments, removing it clears them.
 * X7: launcher shortcuts map pcrm://quick/<x> deep links to in-app routes.
 */
import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { HashRouter } from 'react-router-dom'
import { CrmProvider, useCrm } from './src/store'
import App from './src/App'
import { biometricAvailable, registerBiometric, verifyBiometric, B64U_TEST } from './src/lib/biometric'
import { parseQuickLink, QUICK_LINKS } from './src/lib/quicklinks'

afterEach(() => {
  cleanup()
  delete window.PublicKeyCredential
  try { delete navigator.credentials } catch { /* noop */ }
})

/* same algorithm as the store (sha256, FNV fallback in jsdom) */
const hashPin = async (pin, salt) => {
  const raw = `${salt}|${pin}`
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    let h = 2166136261
    for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619) }
    return 'fnv:' + (h >>> 0).toString(16)
  }
}

function mockWebAuthn({ getFails = false } = {}) {
  window.PublicKeyCredential = {
    isUserVerifyingPlatformAuthenticatorAvailable: vi.fn(async () => true),
  }
  const raw = new Uint8Array([1, 2, 3, 4]).buffer
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: {
      create: vi.fn(async () => ({ rawId: raw })),
      get: vi.fn(async () => {
        if (getFails) throw new Error('not recognized')
        return { id: 'ok' }
      }),
    },
  })
}

async function seedAndMount(lockExtra = {}, hash = '#/settings') {
  window.localStorage.clear()
  window.localStorage.setItem('pcrm-v1', JSON.stringify({
    contacts: [], tasks: [], events: [], notes: [], noteLabels: [], files: [], devices: [],
    reminders: [], kbArticles: [], kbCollections: [], kbViews: {}, tags: [], groups: [], rules: [],
    audit: [], activity: [], imports: [], relFreq: {}, snoozes: {}, carddav: null,
    gcal: { connected: false, email: null, lastSync: null }, notifState: {},
    notifPrefs: { task: true, 'follow-up': true, birthday: true, event: true, system: true, note: true, remind: true },
    reminderPrefs: { sound: 'bell', volume: 0.7, vibrate: true, enabled: true, leadDefault: 10 },
    lock: { hash: null, skipped: true },
    ...lockExtra,
  }))
  window.location.hash = hash
  return render(
    <HashRouter>
      <CrmProvider>
        <App />
      </CrmProvider>
    </HashRouter>
  )
}

async function unlockWithPin1234() {
  fireEvent.change(await screen.findByPlaceholderText('••••'), { target: { value: '1234' } })
  fireEvent.click(screen.getByRole('button', { name: /unlock/i }))
}

describe('X3 biometric unlock', () => {
  it('hides the enroll option when no platform authenticator exists (jsdom default)', async () => {
    const hash = await hashPin('1234', 'salt1')
    await seedAndMount({ lock: { hash, salt: 'salt1', bioIds: [] } })
    await unlockWithPin1234()
    await screen.findByText('App lock (pincode)')
    expect(screen.getByTestId('bio-enable').disabled).toBe(true)
    expect(screen.getByText(/No fingerprint\/face authenticator detected/)).toBeTruthy()
  })

  it('enrolls via WebAuthn and stores the credential id in lock.bioIds', async () => {
    mockWebAuthn()
    const hash = await hashPin('1234', 'salt1')
    await seedAndMount({ lock: { hash, salt: 'salt1', bioIds: [] } })
    await unlockWithPin1234()
    fireEvent.click(await screen.findByTestId('bio-enable'))
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.lock.bioIds).toEqual(['AQIDBA'])   // b64url of 01020304
    })
    // flips to the off switch
    expect(await screen.findByTestId('bio-disable')).toBeTruthy()
  })

  it('the unlock screen offers fingerprint/face and it unlocks', async () => {
    mockWebAuthn()
    const hash = await hashPin('1234', 'salt1')
    await seedAndMount({ lock: { hash, salt: 'salt1', bioIds: ['AQIDBA'] } }, '#/')
    const btn = await screen.findByTestId('bio-unlock')
    fireEvent.click(btn)
    // app shell is up — the lock screen is gone
    await waitFor(() => expect(screen.queryByTestId('bio-unlock')).toBeNull())
    expect(await screen.findByTitle('Upcoming reminders')).toBeTruthy()
  })

  it('failed biometrics fall back to the pincode path', async () => {
    mockWebAuthn({ getFails: true })
    const hash = await hashPin('1234', 'salt1')
    await seedAndMount({ lock: { hash, salt: 'salt1', bioIds: ['AQIDBA'] } }, '#/')
    fireEvent.click(await screen.findByTestId('bio-unlock'))
    await waitFor(() => expect(screen.getByText(/Biometric unavailable — use your pincode/)).toBeTruthy())
    // still locked — pin field is there
    expect(screen.getByPlaceholderText('••••')).toBeTruthy()
  })

  it('changing the pin keeps enrollments; removing the pin clears them', async () => {
    mockWebAuthn()
    function Harness() {
      const { setupPin, enableBiometric, changePin, removePin, lock } = useCrm()
      return (
        <>
          <button onClick={() => setupPin('1234')}>setpin</button>
          <button onClick={() => enableBiometric()}>enroll</button>
          <button onClick={() => changePin('1234', '5678')}>chpin</button>
          <button onClick={() => removePin('5678')}>rmpin</button>
          <span data-testid="bio-count">{(lock?.bioIds || []).length}</span>
        </>
      )
    }
    window.localStorage.clear()
    render(<HashRouter><CrmProvider><Harness /></CrmProvider></HashRouter>)
    fireEvent.click(screen.getByText('setpin'))
    // the setup modal closes before the user can enroll — honor that order here
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.lock?.hash).toBeTruthy()
    })
    fireEvent.click(screen.getByText('enroll'))
    await waitFor(() => expect(screen.getByTestId('bio-count').textContent).toBe('1'))
    fireEvent.click(screen.getByText('chpin'))
    await waitFor(() => expect(screen.getByTestId('bio-count').textContent).toBe('1'))  // preserved
    fireEvent.click(screen.getByText('rmpin'))
    await waitFor(() => expect(screen.getByTestId('bio-count').textContent).toBe('0'))  // cleared
  })

  it('biometric lib: availability probe and b64url codec', async () => {
    expect(await biometricAvailable()).toBe(false)   // jsdom: no PublicKeyCredential
    mockWebAuthn()
    expect(await biometricAvailable()).toBe(true)
    const id = await registerBiometric()
    expect(id).toBe('AQIDBA')
    expect(B64U_TEST.to(B64U_TEST.from('AQIDBA').buffer)).toBe('AQIDBA')
    expect(await verifyBiometric([id])).toBe(true)
  })
})

describe('X7 home-screen shortcuts', () => {
  it('quick links map to in-app routes', () => {
    expect(parseQuickLink('pcrm://quick/note').hash).toBe('#/notes?new=1')
    expect(parseQuickLink('pcrm://quick/contact').hash).toBe('#/contacts?new=1')
    expect(parseQuickLink('pcrm://quick/kb').hash).toBe('#/kb')
    expect(parseQuickLink('pcrm://quick/files').hash).toBe('#/files')
    expect(parseQuickLink('pcrm://quick/tasks').hash).toBe('#/tasks')
    expect(parseQuickLink('pcrm://quick/unknown')).toBeNull()
    expect(parseQuickLink('https://example.com/x')).toBeNull()
    expect(QUICK_LINKS.note.label).toBe('New note')
  })

  it('shortcuts.xml declares the four launcher shortcuts', () => {
    const xml = readFileSync(resolve(process.cwd(), 'android/app/src/main/res/xml/shortcuts.xml'), 'utf8')
    for (const [id, label] of [
      ['new-note', 'shortcut_new_note'], ['new-contact', 'shortcut_new_contact'],
      ['knowledge-base', 'shortcut_kb'], ['files', 'shortcut_files'],
    ]) {
      expect(xml).toContain(`android:shortcutId="${id}"`)
      expect(xml).toContain(`@string/${label}`)
    }
    expect(xml).toContain('android:data="pcrm://quick/note"')
  })

  it('the AndroidManifest wires the scheme and the shortcuts metadata', () => {
    const xml = readFileSync(resolve(process.cwd(), 'android/app/src/main/AndroidManifest.xml'), 'utf8')
    expect(xml).toContain('android:name="android.app.shortcuts"')
    expect(xml).toContain('android:resource="@xml/shortcuts"')
    expect(xml).toContain('android:scheme="pcrm"')
    expect(xml).toContain('android:host="quick"')
  })
})
