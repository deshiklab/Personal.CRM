/**
 * WS-5 probe — Reminders & notification bells/rings
 *
 * Covers: reminder engine (lead times, repeat advance, due collection),
 * the in-app ring overlay (fires with NO AudioContext/Notification — the
 * graceful path every degraded environment takes), task-modal "Remind me",
 * the topbar bell, the notifications schedule panel + create modal,
 * and the Settings ring-prefs card.
 */
import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { CrmProvider } from './src/store'
import App from './src/App'
import { makeReminder, minutesBefore, nextOccurrence, isDue, collectDue, afterFire, snoozePatch, dueSoonLabel } from './src/lib/reminders'
import { notifId } from './src/lib/native-notify'

afterEach(() => cleanup())

/* ── deterministic env: fixed TZ-independent strings, no audio/notification ── */
const NOW = '2026-02-10T10:00' // local-naive strings throughout the engine

async function mountApp(hash = '#/') {
  window.location.hash = hash
  return render(
    <HashRouter>
      <CrmProvider>
        <App />
      </CrmProvider>
    </HashRouter>
  )
}

async function skipLock() {
  const skip = screen.queryByRole('button', { name: /skip for now/i })
  if (skip) fireEvent.click(skip)
}

/* seed the persisted store with reminders/notes/tasks before boot.
 * Empty arrays are truthy so listed slices stick; anything omitted falls
 * back to the store's demo-seed defaults. */
function seed(mutate) {
  window.localStorage.clear()
  const state = {
    contacts: [], tasks: [], events: [], notes: [], noteLabels: [], files: [], devices: [],
    reminders: [], tags: [], groups: [], rules: [], audit: [], activity: [], imports: [],
    relFreq: {}, snoozes: {}, carddav: null,
    gcal: { connected: false, email: null, lastSync: null },
    notifState: {},
    notifPrefs: { msg: true, task: true, 'follow-up': true, birthday: true, event: true, note: true, system: true, digest: true, remind: true },
    reminderPrefs: { sound: 'bell', volume: 0.7, vibrate: true, enabled: true, leadDefault: 10 },
  }
  mutate(state)
  window.localStorage.setItem('pcrm-v1', JSON.stringify(state))
}

describe('reminder engine (pure)', () => {
  it('minutesBefore builds a local-naive lead timestamp', () => {
    expect(minutesBefore('2026-02-20', '10:00', 60)).toBe('2026-02-20T09:00')
    expect(minutesBefore('2026-02-20', '10:00', 0)).toBe('2026-02-20T10:00')
    // 10 min before 00:05 crosses midnight backwards
    expect(minutesBefore('2026-02-20', '00:05', 10)).toBe('2026-02-19T23:55')
    expect(minutesBefore('', '10:00', 10)).toBeNull()
  })

  it('nextOccurrence advances the repeat cycle with month-end clamping', () => {
    expect(nextOccurrence('2026-02-10T10:00', 'daily')).toBe('2026-02-11T10:00')
    expect(nextOccurrence('2026-02-10T10:00', 'weekly')).toBe('2026-02-17T10:00')
    expect(nextOccurrence('2026-01-31T09:00', 'monthly')).toBe('2026-02-28T09:00')
    expect(nextOccurrence('2026-02-10T10:00', 'yearly')).toBe('2027-02-10T10:00')
    expect(nextOccurrence('2026-02-10T10:00', 'none')).toBeNull()
    expect(nextOccurrence(null, 'daily')).toBeNull()
  })

  it('isDue + collectDue merge slice reminders and note.remindAt', () => {
    const now = new Date('2026-02-10T10:00')
    const data = {
      reminders: [
        makeReminder({ id: 'r1', title: 'Slice one', at: '2026-02-10T09:00' }), // due (past)
        makeReminder({ id: 'r2', title: 'Future one', at: '2026-02-10T12:00' }), // not due
        makeReminder({ id: 'r3', title: 'Done one', at: '2026-02-10T09:30', status: 'done' }), // excluded
      ],
      notes: [
        { id: 'n1', title: 'Note nag', trashedAt: null, remindAt: '2026-02-10T08:00' },
        { id: 'n2', title: 'Trashed note', trashedAt: '2026-02-01T00:00', remindAt: '2026-02-10T08:30' },
      ],
    }
    expect(isDue(data.reminders[0], now)).toBe(true)
    expect(isDue(data.reminders[1], now)).toBe(false)
    const due = collectDue(data, now)
    expect(due.map(d => d.key)).toEqual(['note-n1', 'rem-r1']) // sorted by at: 08:00 note first
    expect(due[0].kind).toBe('note')
    expect(due[1].kind).toBe('reminder')
    expect(due[1].title).toBe('Slice one')
  })

  it('afterFire advances repeats and latches one-shots', () => {
    const rep = afterFire(makeReminder({ id: 'a', at: '2026-02-10T09:00', repeat: 'daily' }))
    expect(rep.status).toBe('scheduled')
    expect(rep.at).toBe('2026-02-11T09:00')
    expect(typeof rep.firedAt).toBe('string') // real clock stamps the run

    const one = afterFire(makeReminder({ id: 'b', at: '2026-02-10T09:00' }))
    expect(one.status).toBe('fired') // latched — no `at` advance, collectDue won't re-fire
    expect(one.at).toBeUndefined()
  })

  it('snoozePatch re-arms the reminder later', () => {
    const s = snoozePatch(makeReminder({ id: 'c', at: '2026-02-10T10:00' }), 10)
    expect(s.status).toBe('scheduled')
    expect(s.at).toBe('2026-02-10T10:10')
  })

  it('dueSoonLabel speaks human + notifId is a stable positive int32', () => {
    expect(dueSoonLabel('2020-01-01T10:00')).toMatch(/overdue/i)   // always past
    expect(dueSoonLabel('2099-01-01T10:00')).toMatch(/^in \d+d$/)  // always future
    expect(dueSoonLabel(null)).toBe('')
    const a = notifId('rem-abc123')
    expect(a).toBe(notifId('rem-abc123')) // stable
    expect(Number.isInteger(a) && a > 0).toBe(true)
  })
})

describe('in-app ring overlay (graceful without AudioContext/Notification)', () => {
  it('fires a latched past reminder on mount and can be done / snoozed', async () => {
    seed(s => {
      s.reminders = [makeReminder({
        id: 'ring1', title: 'Ring-a-ding test', body: 'probe body',
        at: '2026-01-01T09:00', status: 'scheduled', sound: 'bell',
      })]
    })
    await mountApp('#/')
    await skipLock()
    // ReminderHost ticks immediately on mount → overlay with the title
    await waitFor(() => expect(screen.getByTestId('alert-overlay')).toBeTruthy(), { timeout: 4000 })
    expect(screen.getByText('Ring-a-ding test')).toBeTruthy()
    expect(screen.getByText('probe body')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^done$/i }))
    await waitFor(() => expect(screen.queryByTestId('alert-overlay')).toBeNull())

    // persisted as completed
    const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
    expect((saved.reminders || []).find(r => r.id === 'ring1')?.status).toBe('done')
  })

  it('snooze 10m re-arms for later instead of completing', async () => {
    seed(s => {
      s.reminders = [makeReminder({ id: 'ring2', title: 'Snoozy', at: '2026-01-01T09:00', status: 'scheduled' })]
    })
    await mountApp('#/')
    await skipLock()
    await waitFor(() => expect(screen.getByTestId('alert-overlay')).toBeTruthy(), { timeout: 4000 })
    fireEvent.click(screen.getByRole('button', { name: /^10m$/i }))
    await waitFor(() => expect(screen.queryByTestId('alert-overlay')).toBeNull())
    const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
    const r = (saved.reminders || []).find(x => x.id === 'ring2')
    expect(r?.status).toBe('scheduled')
    expect(r?.at > '2026-01-01T09:00').toBe(true) // pushed forward
  })

  it('note remindAt rings too and clears when done', async () => {
    seed(s => {
      s.notes = [{
        id: 'note-nag', title: 'Water plants', body: '', color: 'yellow', pinned: false, archived: false,
        trashed: false, labels: [], createdAt: '2026-01-01T00:00', updatedAt: '2026-01-01T00:00', remindAt: '2026-01-01T08:00',
      }]
    })
    await mountApp('#/')
    await skipLock()
    await waitFor(() => expect(screen.getByTestId('alert-overlay')).toBeTruthy(), { timeout: 4000 })
    expect(screen.getByText('Water plants')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^done$/i }))
    await waitFor(() => expect(screen.queryByTestId('alert-overlay')).toBeNull())
    const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
    expect(saved.notifState?.['note-note-nag']?.read).toBe(true)
    expect((saved.notes || [])[0]?.remindAt).toBeNull() // CTA completed → nag cleared
  })

  it('silent sound + disabled vibrate crash nothing', async () => {
    seed(s => {
      s.reminders = [makeReminder({ id: 'ring3', title: 'Quiet one', at: '2026-01-01T09:00', status: 'scheduled', sound: 'silent' })]
      s.reminderPrefs = { sound: 'silent', volume: 0, vibrate: false, enabled: true, leadDefault: 10 }
    })
    await mountApp('#/')
    await skipLock()
    await waitFor(() => expect(screen.getByTestId('alert-overlay')).toBeTruthy(), { timeout: 4000 })
    fireEvent.click(screen.getByTitle('Dismiss'))
    await waitFor(() => expect(screen.queryByTestId('alert-overlay')).toBeNull())
    expect(window.location.hash).toBe('#/') // nothing exploded
  })
})

describe('attach points + bell + schedule panel', () => {
  it('task detail modal gets a reminder via quick chip and shows it', async () => {
    seed(s => {
      s.tasks = [{ id: 't1', title: 'Probe task for reminders', description: '', column: 'todo', priority: 'med', due: '2026-12-01', contactId: null, tags: [], subtasks: [], repeat: 'none', createdAt: '2026-01-01T00:00', completedAt: null, order: 0 }]
    })
    await mountApp('#/tasks')
    await skipLock()
    fireEvent.click(await screen.findByText('Probe task for reminders'))
    // quick chip: 1h before the due date at 09:00 → 2026-12-01T08:00
    await waitFor(() => expect(screen.getByRole('button', { name: /1h before/i })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /1h before/i }))
    await waitFor(() => expect(screen.getByText(/2026-12-01T08:00/)).toBeTruthy())
    const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
    expect((saved.reminders || [])[0]?.refType).toBe('task')
    expect((saved.reminders || [])[0]?.refId).toBe('t1')
    expect((saved.reminders || [])[0]?.at).toBe('2026-12-01T08:00')
  })

  it('topbar bell lists upcoming and deep-links to the center', async () => {
    seed(s => {
      s.reminders = [
        makeReminder({ id: 'b1', title: 'Bell item one', at: '2026-12-01T09:00' }),
        makeReminder({ id: 'b2', title: 'Bell item two', at: '2026-12-02T09:00' }),
      ]
    })
    await mountApp('#/')
    await skipLock()
    fireEvent.click(screen.getByTitle('Upcoming reminders'))
    // the dashboard's Upcoming-reminders widget echoes the same titles
    expect(screen.getAllByText('Bell item one').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Bell item two').length).toBeGreaterThan(0)
    // done from the dropdown
    fireEvent.click(screen.getAllByTitle('Mark done')[0])
    await waitFor(() => expect(screen.queryByText('Bell item one')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /all reminders/i }))
    await waitFor(() => expect(screen.getAllByRole('heading', { name: /notification center/i }).length).toBeGreaterThan(0))
  })

  it('notifications page schedules a new reminder and lists it', async () => {
    window.localStorage.clear()
    await mountApp('#/notifications')
    await skipLock()
    await waitFor(() => expect(screen.getAllByRole('heading', { name: /notification center/i }).length).toBeGreaterThan(0))
    fireEvent.click(screen.getByTestId('new-reminder-btn'))
    fireEvent.change(screen.getByPlaceholderText(/call the dentist/i), { target: { value: 'Probe reminder entry' } })
    fireEvent.change(screen.getByPlaceholderText(/extra detail/i), { target: { value: 'with detail' } })
    // datetime-local: fill ISO-ish value
    fireEvent.change(document.querySelector('input[type=datetime-local]'), { target: { value: '2026-12-05T14:30' } })
    fireEvent.click(screen.getByRole('button', { name: /set reminder/i }))
    await waitFor(() => expect(screen.getByText('Probe reminder entry')).toBeTruthy())
    const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
    expect((saved.reminders || [])[0]?.title).toBe('Probe reminder entry')
    expect((saved.reminders || [])[0]?.at).toBe('2026-12-05T14:30')
    expect((saved.reminders || [])[0]?.refType).toBe('custom')
  })

  it('settings shows the ring prefs card with a test ring', async () => {
    window.localStorage.clear()
    await mountApp('#/settings')
    await skipLock()
    await screen.findByText(/reminder bells & rings/i)
    expect(screen.getByTestId('test-ring')).toBeTruthy()
    // change sound
    const selects = screen.getAllByRole('combobox')
    const soundSel = selects.find(s => (s.value === 'bell') && Array.from(s.options).some(o => o.value === 'chime'))
    expect(soundSel).toBeTruthy()
    fireEvent.change(soundSel, { target: { value: 'chime' } })
    const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
    expect(saved.reminderPrefs?.sound).toBe('chime')
  })
})
