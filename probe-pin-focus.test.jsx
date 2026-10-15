/**
 * PIN focus regression probe.
 *
 * Bug: PinField (LockScreen) and PinRow (Settings app-lock) were defined
 * INSIDE their parent components, so every keystroke re-render gave them a
 * new component identity → React remounted the input → focus dropped after
 * each digit ("the field needs to be selected every time I input one digit").
 *
 * These tests type a pin digit-by-digit and assert the SAME input node keeps
 * focus after every keystroke — they fail on the old code and pass on the fix.
 */
import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { CrmProvider } from './src/store'
import App from './src/App'
import LockScreen from './src/components/LockScreen'

afterEach(() => cleanup())

function mountLock(mode) {
  window.localStorage.clear()
  return render(
    <HashRouter>
      <CrmProvider>
        <LockScreen mode={mode} />
      </CrmProvider>
    </HashRouter>
  )
}

/* type digit-by-digit and assert focus never leaves the same DOM node */
function typeDigits(input, digits) {
  input.focus()
  let value = ''
  for (const d of digits) {
    value += d
    fireEvent.change(input, { target: { value } })
    expect(document.activeElement).toBe(input) // the heart of the regression
  }
}

describe('LockScreen pin inputs keep focus per digit', () => {
  it('unlock mode: the pin field never loses focus while typing', () => {
    mountLock('unlock')
    const input = screen.getByPlaceholderText('••••')
    typeDigits(input, '1234')
    expect(input.value).toBe('1234')
  })

  it('setup mode: BOTH pin fields keep focus while typing', () => {
    mountLock('setup')
    const [first, second] = screen.getAllByPlaceholderText('••••')
    typeDigits(first, '1234')
    typeDigits(second, '1234')
    expect(first.value).toBe('1234')
    expect(second.value).toBe('1234')
    // non-digits are still scrubbed (focus explicitly first — change() doesn't move it)
    first.focus()
    fireEvent.change(first, { target: { value: '12ab34' } })
    expect(first.value).toBe('1234')
    expect(document.activeElement).toBe(first)
  })
})

describe('Settings app-lock pin inputs keep focus per digit', () => {
  async function mountSettings() {
    window.localStorage.clear()
    // lock exists but is skipped → app opens, no LockScreen gate
    window.localStorage.setItem('pcrm-v1', JSON.stringify({
      contacts: [], tasks: [], events: [], notes: [], noteLabels: [], files: [], devices: [],
      reminders: [], kbArticles: [], kbCollections: [], kbViews: {}, tags: [], groups: [], rules: [],
      audit: [], activity: [], imports: [], relFreq: {}, snoozes: {}, carddav: null,
      gcal: { connected: false, email: null, lastSync: null }, notifState: {},
      notifPrefs: { task: true, 'follow-up': true, birthday: true, event: true, system: true, note: true, remind: true },
      reminderPrefs: { sound: 'bell', volume: 0.7, vibrate: true, enabled: true, leadDefault: 10 },
      lock: { hash: null, skipped: true },
    }))
    window.location.hash = '#/settings'
    return render(
      <HashRouter>
        <CrmProvider>
          <App />
        </CrmProvider>
      </HashRouter>
    )
  }

  it('"Set pincode" modal fields keep focus while typing', async () => {
    await mountSettings()
    fireEvent.click(await screen.findByRole('button', { name: /set pincode/i }))
    const fields = await screen.findAllByPlaceholderText('••••')
    expect(fields.length).toBe(2) // new + repeat
    typeDigits(fields[0], '9876')
    typeDigits(fields[1], '9876')
    expect(fields[0].value).toBe('9876')
    expect(fields[1].value).toBe('9876')
  })
})

describe('Setup wizard pin step keeps focus per digit', () => {
  it('wiz-pin / wiz-pin2 never lose focus or remount while typing', async () => {
    window.localStorage.clear()   // truly fresh → welcome wizard
    window.location.hash = '#/'
    render(
      <HashRouter>
        <CrmProvider>
          <App />
        </CrmProvider>
      </HashRouter>
    )
    fireEvent.click(await screen.findByTestId('wiz-path-new'))
    fireEvent.change(await screen.findByTestId('wiz-name'), { target: { value: 'Focus Tester' } })
    fireEvent.click(screen.getByTestId('wiz-profile-next'))
    const first = await screen.findByTestId('wiz-pin')
    const second = screen.getByTestId('wiz-pin2')
    typeDigits(first, '1234')
    typeDigits(second, '1234')
    // same DOM nodes — a remount would hand back fresh elements
    expect(screen.getByTestId('wiz-pin')).toBe(first)
    expect(screen.getByTestId('wiz-pin2')).toBe(second)
    expect(first.value).toBe('1234')
    expect(second.value).toBe('1234')
  })
})
