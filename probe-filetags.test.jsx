/**
 * Files organization probe — Tags & Set Categories in Files + the Pro/Advanced
 * Settings section. Contract: every file row can carry a category (folder) and
 * free tags; both are editable in the Tags & category modal, filterable from
 * the toolbar chips, and searchable — all persisted to the synced index.
 */
import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { CrmProvider } from './src/store'
import App from './src/App'

afterEach(() => cleanup())

const iso = () => new Date().toISOString()
const file = (id, name, tags = [], folder = 'Inbox') => ({
  id, name, mime: 'application/pdf', size: 2048, sha256: 'abc123', folder, tags,
  contactIds: [], starred: false, origin: 'import', storedAt: iso(),
  deviceId: 'dev1', deviceName: 'Web · dev1',
})

function seed(files) {
  window.localStorage.clear()
  window.localStorage.setItem('pcrm-v1', JSON.stringify({
    contacts: [], tasks: [], events: [], notes: [], noteLabels: [], files, devices: [],
    reminders: [], kbArticles: [], kbCollections: [], kbViews: {}, tags: [], groups: [], rules: [],
    audit: [], activity: [], imports: [], relFreq: {}, snoozes: {}, carddav: null,
    gcal: { connected: false, email: null, lastSync: null }, notifState: {},
    notifPrefs: { task: true, 'follow-up': true, birthday: true, event: true, system: true, note: true, remind: true },
    reminderPrefs: { sound: 'bell', volume: 0.7, vibrate: true, enabled: true, leadDefault: 10 },
    lock: { hash: null, skipped: true },
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

describe('Files: tags', () => {
  it('adds a tag from the modal and persists it', async () => {
    seed([file('f1', 'invoice-march.pdf')])
    await mount('#/files')
    fireEvent.click(await screen.findByTestId('tagedit-f1'))
    fireEvent.change(await screen.findByTestId('tag-input'), { target: { value: 'invoice' } })
    fireEvent.click(screen.getByTestId('tag-add'))
    // chip shows inside the modal (the row pill behind it renders the same text)
    await waitFor(() => expect(screen.getAllByText('#invoice').length).toBeGreaterThan(0))
    // persisted
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.files.find(f => f.id === 'f1').tags).toContain('invoice')
    })
  })

  it('a tag chip in the toolbar filters the list', async () => {
    seed([
      file('f1', 'alpha.pdf', ['invoice']),
      file('f2', 'beta.pdf', ['contract']),
    ])
    await mount('#/files')
    await screen.findByText('alpha.pdf')
    expect(screen.getByText('beta.pdf')).toBeTruthy()
    fireEvent.click(await screen.findByTestId('tagf-invoice'))
    await waitFor(() => {
      expect(screen.queryByText('beta.pdf')).toBeNull()
      expect(screen.getByText('alpha.pdf')).toBeTruthy()
    })
  })

  it('search matches tags', async () => {
    seed([
      file('f1', 'alpha.pdf', ['invoice']),
      file('f2', 'beta.pdf', ['contract']),
    ])
    await mount('#/files')
    fireEvent.change(await screen.findByPlaceholderText('Search files…'), { target: { value: 'contract' } })
    await waitFor(() => {
      expect(screen.queryByText('alpha.pdf')).toBeNull()
      expect(screen.getByText('beta.pdf')).toBeTruthy()
    })
  })

  it('removes a tag with the ×', async () => {
    seed([file('f1', 'alpha.pdf', ['invoice', 'paid'])])
    await mount('#/files')
    fireEvent.click(await screen.findByTestId('tagedit-f1'))
    const removeBtn = await screen.findByTitle('Remove invoice')
    fireEvent.click(removeBtn)
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.files.find(f => f.id === 'f1').tags).toEqual(['paid'])
    })
  })
})

describe('Files: categories', () => {
  it('assigns an existing category from the modal', async () => {
    seed([file('f1', 'alpha.pdf', [], 'Inbox')])
    await mount('#/files')
    fireEvent.click(await screen.findByTestId('tagedit-f1'))
    // create a second category first via the new-category input
    fireEvent.change(await screen.findByPlaceholderText('New category…'), { target: { value: 'Finance' } })
    fireEvent.click(screen.getByTestId('cat-add'))
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
      expect(saved.files.find(f => f.id === 'f1').folder).toBe('Finance')
    })
  })

  it('category chips filter the list', async () => {
    seed([
      file('f1', 'alpha.pdf', [], 'Finance'),
      file('f2', 'beta.pdf', [], 'Inbox'),
    ])
    await mount('#/files')
    fireEvent.click(await screen.findByRole('button', { name: /finance/i }))
    await waitFor(() => {
      expect(screen.getByText('alpha.pdf')).toBeTruthy()
      expect(screen.queryByText('beta.pdf')).toBeNull()
    })
  })
})

describe('Settings: Pro / Advanced section', () => {
  it('exists and contains the File storage location card', async () => {
    seed([])
    await mount('#/settings')
    const heads = await screen.findAllByText('Pro / Advanced')  // SectionHead renders the title twice
    expect(heads.length).toBeGreaterThan(0)
    // the storage-location card (first item of the section) is right there
    expect(await screen.findByTestId('loc-data')).toBeTruthy()
  })
})
