/**
 * X5 — auto-backup nudge probe. When the local copy hasn't been backed up in
 * 7+ days (or never), the app surfaces one passive warn toast per start;
 * `markBackup()` (any backup path) refreshes the clock.
 */
import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { CrmProvider, useCrm } from './src/store'
import App from './src/App'
import { backupNudgeText, BACKUP_NUDGE_DAYS } from './src/lib/backup-nudge'

afterEach(() => cleanup())

const day = 86400000

describe('backupNudgeText', () => {
  it('never-backed-up nudges, fresh backs stay quiet, old backs nudge with the count', () => {
    expect(backupNudgeText(null, 1e12)).toMatch(/No backup yet/)
    expect(backupNudgeText(new Date(1e12 - 2 * day).toISOString(), 1e12)).toBeNull()
    const txt = backupNudgeText(new Date(1e12 - 20 * day).toISOString(), 1e12)
    expect(txt).toMatch(/20 days ago/)
    expect(backupNudgeText(new Date(1e12 - BACKUP_NUDGE_DAYS * day).toISOString(), 1e12)).toMatch(/7 days ago/)
  })
})

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
  window.location.hash = '#/'
}

describe('nudge in the app', () => {
  it('shows the stale-backup toast after the grace delay', async () => {
    seed({ driveState: { fileId: null, lastBackup: new Date(Date.now() - 20 * day).toISOString(), lastRestore: null, lastContactsSync: null } })
    render(<HashRouter><CrmProvider><App /></CrmProvider></HashRouter>)
    await waitFor(() => expect(screen.getAllByText(/20 days ago/).length).toBeGreaterThan(0), { timeout: 4000 })
  }, 6000)

  it('markBackup refreshes the persisted clock', async () => {
    seed()
    function Harness() {
      const { markBackup } = useCrm()
      return <button onClick={markBackup}>mark it</button>
    }
    render(<HashRouter><CrmProvider><Harness /></CrmProvider></HashRouter>)
    fireEvent.click(screen.getByText('mark it'))
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.driveState?.lastBackup).toBeTruthy()
    })
  })
})
