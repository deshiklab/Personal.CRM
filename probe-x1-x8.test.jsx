/**
 * X1 recurring tasks + X8 dashboard widgets probe.
 *
 * X1: tasks can repeat (daily / weekdays / weekly / monthly); completing one
 * spawns the next occurrence with a fresh due date and unchecked subtasks.
 * X8: the dashboard cockpit gains Storage usage, Upcoming reminders and
 * KB recents widgets.
 */
import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { CrmProvider } from './src/store'
import App from './src/App'
import { nextTaskDue, TASK_REPEATS } from './src/lib/reminders'

afterEach(() => cleanup())

describe('nextTaskDue', () => {
  it('advances daily / weekly / monthly (clamped) and skips weekends for weekdays', () => {
    expect(nextTaskDue('2026-10-16', 'daily')).toBe('2026-10-17')
    expect(nextTaskDue('2026-10-16', 'weekly')).toBe('2026-10-23')
    expect(nextTaskDue('2026-01-31', 'monthly')).toBe('2026-02-28')   // clamped
    // Fri 2026-10-16 → Mon 2026-10-19 ; Sat 2026-10-17 → Mon 2026-10-19
    expect(nextTaskDue('2026-10-16', 'weekday')).toBe('2026-10-19')
    expect(nextTaskDue('2026-10-17', 'weekday')).toBe('2026-10-19')
    expect(nextTaskDue('2026-10-19', 'weekday')).toBe('2026-10-20')
    expect(nextTaskDue('2026-10-16', 'none')).toBeNull()
  })
})

const iso = () => new Date(Date.now() + 3600000).toISOString()

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

const task = (id, extra = {}) => ({
  id, title: 'Water plants', column: 'todo', priority: 'med', due: '2026-10-16',
  contactId: null, tags: [], repeat: 'none', desc: '', subtasks: [], ...extra,
})

describe('X1 recurring tasks', () => {
  it('completing a daily task spawns tomorrow\'s copy (subtasks reset)', async () => {
    seed({
      tasks: [task('t1', {
        repeat: 'daily',
        subtasks: [{ id: 's1', text: 'kitchen', done: true }, { id: 's2', text: 'balcony', done: false }],
      })],
    })
    await mount('#/tasks')
    fireEvent.click(await screen.findByText('Water plants'))
    await screen.findByTestId('repeat-select')
    // move to done via the Column select
    const colSel = screen.getAllByRole('combobox').find(el => el.value === 'todo')
    fireEvent.change(colSel, { target: { value: 'done' } })
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.tasks.length).toBe(2)
    })
    const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
    const old = saved.tasks.find(t => t.id === 't1')
    const next = saved.tasks.find(t => t.id !== 't1')
    expect(old.column).toBe('done')
    expect(next.column).toBe('todo')
    expect(next.due).toBe('2026-10-17')
    expect(next.repeat).toBe('daily')
    expect(next.title).toBe('Water plants')
    expect(next.subtasks.every(s => !s.done)).toBe(true)   // fresh checklist
  })

  it('a task without repeat completes without a successor', async () => {
    seed({ tasks: [task('t1')] })
    await mount('#/tasks')
    fireEvent.click(await screen.findByText('Water plants'))
    const colSel = screen.getAllByRole('combobox').find(el => el.value === 'todo')
    fireEvent.change(colSel, { target: { value: 'done' } })
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.tasks.length).toBe(1)
    })
  })

  it('the detail modal can set the repeat cadence', async () => {
    seed({ tasks: [task('t1')] })
    await mount('#/tasks')
    fireEvent.click(await screen.findByText('Water plants'))
    fireEvent.change(await screen.findByTestId('repeat-select'), { target: { value: 'weekly' } })
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.tasks.find(t => t.id === 't1').repeat).toBe('weekly')
    })
    expect(Object.keys(TASK_REPEATS)).toEqual(['none', 'daily', 'weekday', 'weekly', 'monthly'])
  })

  it('repeating card shows its cadence badge', async () => {
    seed({ tasks: [task('t1', { repeat: 'weekday' })] })
    await mount('#/tasks')
    await screen.findByText('Water plants')
    expect(screen.getAllByText('Weekdays').length).toBeGreaterThan(0)
  })
})

describe('X8 dashboard widgets', () => {
  it('storage usage, upcoming reminders and KB recents all render with data', async () => {
    seed({
      files: [{ id: 'f1', name: 'report.pdf', mime: 'application/pdf', size: 5120, folder: 'Inbox', tags: [], deviceId: 'd1', storedAt: iso() }],
      devices: [{ id: 'd1', name: 'My Phone', kind: 'web', lastSeen: iso() }],
      reminders: [{ id: 'r1', refType: 'custom', title: 'Dentist', at: iso(), repeat: 'none', status: 'scheduled' }],
      kbArticles: [{ id: 'a1', title: 'Trip plan', body: 'x', summary: '', collectionId: null, tags: [], contactIds: [], favorite: false, createdAt: iso(), updatedAt: iso() }],
    })
    await mount('#/')
    // titles
    await screen.findByText('Storage usage')
    expect(screen.getByText('Upcoming reminders')).toBeTruthy()
    expect(screen.getByText('KB recents')).toBeTruthy()
    // content
    expect(screen.getByText('My Phone')).toBeTruthy()          // storage per-device bar
    expect(screen.getByText('Dentist')).toBeTruthy()            // next reminder row
    fireEvent.click(screen.getByText('Trip plan'))               // kb recents link targets the article
    await waitFor(() => expect(window.location.hash).toContain('#/kb/'))
  })
})
