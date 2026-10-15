/**
 * File storage location probe — "Allow to set the file storing location".
 *
 * Contract: Settings has a File storage card listing the three Android roots
 * (app-private / Documents / External); picking one persists to
 * `pcrm-v1.filesPrefs.location` and every blob read/write honors it — with
 * reads falling back to older roots so a switch can never brick files.
 */
import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { CrmProvider } from './src/store'
import App from './src/App'
import {
  FILE_LOCATIONS, fileLocationInfo, fileLocationKey, nativeDirEnum, storageBackend, migrateBlobs,
} from './src/lib/filestore'

afterEach(() => cleanup())

async function mountSettings(seed = {}) {
  window.localStorage.clear()
  window.localStorage.setItem('pcrm-v1', JSON.stringify({
    contacts: [], tasks: [], events: [], notes: [], noteLabels: [], files: [], devices: [],
    reminders: [], kbArticles: [], kbCollections: [], kbViews: {}, tags: [], groups: [], rules: [],
    audit: [], activity: [], imports: [], relFreq: {}, snoozes: {}, carddav: null,
    gcal: { connected: false, email: null, lastSync: null }, notifState: {},
    notifPrefs: { task: true, 'follow-up': true, birthday: true, event: true, system: true, note: true, remind: true },
    reminderPrefs: { sound: 'bell', volume: 0.7, vibrate: true, enabled: true, leadDefault: 10 },
    lock: { hash: null, skipped: true },
    ...seed,
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

describe('filestore location registry', () => {
  it('exposes three Android roots with paths + native dir names', () => {
    expect(FILE_LOCATIONS.map(l => l.key)).toEqual(['data', 'documents', 'external'])
    expect(nativeDirEnum('data')).toBe('Data')
    expect(nativeDirEnum('documents')).toBe('Documents')
    expect(nativeDirEnum('external')).toBe('External')
    expect(fileLocationInfo('documents').where).toContain('Documents/PersonalCRM')
    expect(fileLocationInfo('data').label).toContain('private')
  })

  it('reads the location from pcrm-v1.filesPrefs with a data default', () => {
    expect(fileLocationKey()).toBe('data')                       // nothing saved yet
    window.localStorage.setItem('pcrm-v1', JSON.stringify({ filesPrefs: { location: 'documents' } }))
    expect(fileLocationKey()).toBe('documents')
    expect(fileLocationInfo().label).toBe('Documents folder')
    window.localStorage.setItem('pcrm-v1', JSON.stringify({ filesPrefs: { location: 'nope' } }))
    expect(fileLocationKey()).toBe('data')                       // unknown key → safe default
  })

  it('migrate is a counted no-op on web (browser storage is already one place)', async () => {
    expect(storageBackend()).not.toBe('filesystem')
    const r = await migrateBlobs(['a', 'b'])
    expect(r).toEqual({ moved: 2, failed: 0 })
  })
})

describe('Settings: File storage location card', () => {
  it('lists all locations and defaults to app-private', async () => {
    await mountSettings()
    const card = (await screen.findByTestId('loc-data')).closest('.card')
    expect(within(card).getByText('File storage location')).toBeTruthy()
    expect(within(card).getByText(/Documents folder/)).toBeTruthy()
    expect(within(card).getByText(/External app storage/)).toBeTruthy()
    // default selected
    const dataBtn = screen.getByTestId('loc-data')
    expect(dataBtn.getAttribute('style')).toContain('rgb(129, 140, 248)')
  })

  it('picking Documents persists to filesPrefs.location and re-renders selected', async () => {
    await mountSettings()
    fireEvent.click(await screen.findByTestId('loc-documents'))
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.filesPrefs?.location).toBe('documents')
    })
    await waitFor(() => {
      expect(screen.getByTestId('loc-documents').getAttribute('style')).toContain('rgb(129, 140, 248)')
      expect(screen.getByTestId('loc-data').getAttribute('style')).not.toContain('rgb(129, 140, 248)')
    })
  })

  it('the chosen location survives a reload (persistence round-trip)', async () => {
    await mountSettings({ filesPrefs: { location: 'external' } })
    await screen.findByTestId('loc-external')
    expect(screen.getByTestId('loc-external').getAttribute('style')).toContain('rgb(129, 140, 248)')
    expect(fileLocationKey()).toBe('external')   // live read matches the persisted pref
  })
})
