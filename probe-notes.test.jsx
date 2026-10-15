/* Keep-class Notes — end-to-end flows against the real app (jsdom).
 * State carries across tests via localStorage, like the playwright probes. */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { CrmProvider } from './src/store'
import App from './src/App'

const getState = () => JSON.parse(localStorage.getItem('pcrm-v1') || '{}')
const findNote = title => (getState().notes || []).find(n => n.title === title)

const renderApp = (hash = '#/notes') => {
  window.location.hash = hash
  return render(<HashRouter><CrmProvider><App /></CrmProvider></HashRouter>)
}

const typeIn = (el, text) => {
  fireEvent.change(el, { target: { value: text } })
}

beforeAll(() => {
  window.confirm = vi.fn(() => true)
})
afterEach(cleanup)   // vitest runs without globals — register RTL cleanup ourselves

describe('Notes 2.0', () => {
  it('boots, skips pin setup, and shows the Keep-style shell', async () => {
    renderApp('#/notes')
    const skip = screen.queryByRole('button', { name: /Skip for now/i })
    if (skip) fireEvent.click(skip)
    await waitFor(() => expect(screen.getByPlaceholderText(/Take a note/)).toBeTruthy())
    expect(screen.getByTestId('view-all')).toBeTruthy()
    expect(screen.getByTestId('view-pinned')).toBeTruthy()
    expect(screen.getByTestId('view-reminders')).toBeTruthy()
    expect(screen.getByTestId('view-archive')).toBeTruthy()
    expect(screen.getByTestId('view-trash')).toBeTruthy()
    /* seed notes render as cards */
    expect(document.querySelectorAll('.note-card').length).toBeGreaterThanOrEqual(5)
  })

  it('quick-add: Enter creates a titled note', async () => {
    renderApp()
    const qa = screen.getByPlaceholderText(/Take a note/)
    typeIn(qa, 'Probe quick note')
    fireEvent.keyDown(qa, { key: 'Enter' })
    await waitFor(() => expect(findNote('Probe quick note')).toBeTruthy())
    const n = findNote('Probe quick note')
    expect(n.kind).toBe('text')
    expect(Array.isArray(n.checklist)).toBe(true)
    expect(n.trashedAt).toBe(null)
    expect(n.archivedAt).toBe(null)
  })

  it('quick-add: multi-line paste splits into title + body', async () => {
    renderApp()
    const qa = screen.getByPlaceholderText(/Take a note/)
    const pasteEvt = new Event('paste', { bubbles: true, cancelable: true })
    pasteEvt.clipboardData = { getData: () => 'Probe paste note\nPasted body line' }
    fireEvent(qa, pasteEvt)
    await waitFor(() => expect(findNote('Probe paste note')).toBeTruthy())
    const n = findNote('Probe paste note')
    expect(n.body).toBe('Pasted body line')
  })

  it('editor: checklist conversion, items, toggle done', async () => {
    renderApp()
    fireEvent.click(screen.getByText('Probe quick note'))
    const ed = await screen.findByTestId('note-editor')
    fireEvent.click(within(ed).getByRole('button', { name: /Turn into checklist/ }))
    const item = await screen.findByPlaceholderText(/List item/)
    typeIn(item, 'buy milk')
    fireEvent.keyDown(item, { key: 'Enter' })
    await waitFor(() => {
      const n = findNote('Probe quick note')
      expect(n.checklist).toHaveLength(1)
      expect(n.checklist[0].text).toBe('buy milk')
    })
    fireEvent.click(within(ed).getByTitle('Mark done'))
    await waitFor(() => expect(findNote('Probe quick note').checklist[0].done).toBe(true))
  })

  it('editor: color + label create/apply', async () => {
    renderApp()
    fireEvent.click(screen.getByText('Probe quick note'))
    const ed = await screen.findByTestId('note-editor')
    fireEvent.click(within(ed).getByTitle('amber'))
    await waitFor(() => expect(findNote('Probe quick note').color).toBe('amber'))
    const lab = within(ed).getByPlaceholderText(/New label/)
    typeIn(lab, 'probetag')
    fireEvent.keyDown(lab, { key: 'Enter' })
    await waitFor(() => {
      const st = getState()
      const n = st.notes.find(x => x.title === 'Probe quick note')
      expect(n.labels).toHaveLength(1)
      expect(st.noteLabels.some(l => l.name === 'probetag' && l.id === n.labels[0])).toBe(true)
    })
  })

  it('editor: reminder quick chip writes remindAt', async () => {
    renderApp()
    fireEvent.click(screen.getByText('Probe quick note'))
    const ed = await screen.findByTestId('note-editor')
    fireEvent.click(within(ed).getByRole('button', { name: /In 1 hour/ }))
    await waitFor(() => {
      const n = findNote('Probe quick note')
      expect(n.remindAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    })
  })

  it('note reminder appears in the Notification center under its own category', async () => {
    renderApp('#/notifications')
    expect(await screen.findByRole('button', { name: /Note reminders/ })).toBeTruthy()
    /* the derived feed includes our reminder */
    await waitFor(() => expect(screen.getAllByText('Probe quick note').length).toBeGreaterThan(0))
    /* prefs carry the note category */
    expect(getState().notifPrefs.note).toBe(true)
  })

  it('card: pin from hover toolbar, shows in Pinned section', async () => {
    renderApp()
    const card = screen.getByText('Probe quick note').closest('.note-card')
    fireEvent.click(within(card).getByTitle('Pin'))
    await waitFor(() => expect(findNote('Probe quick note').pinned).toBe(true))
    /* pinned group header */
    expect(screen.getByTestId('pinned-section')).toBeTruthy()
  })

  it('card: archive hides from All, appears in Archive view, unarchive', async () => {
    renderApp()
    let card = screen.getByText('Probe quick note').closest('.note-card')
    fireEvent.click(within(card).getByTitle('Archive'))
    await waitFor(() => {
      expect(findNote('Probe quick note').archivedAt).toBeTruthy()
      expect(findNote('Probe quick note').pinned).toBe(false)   // archiving unpins
    })
    expect(screen.queryByText('Probe quick note')).toBeNull()
    fireEvent.click(screen.getByTestId('view-archive'))
    await screen.findByText('Probe quick note')
    card = screen.getByText('Probe quick note').closest('.note-card')
    fireEvent.click(within(card).getByTitle('Unarchive'))
    await waitFor(() => expect(findNote('Probe quick note').archivedAt).toBeFalsy())
  })

  it('card: trash (soft) → restore → trash → delete forever', async () => {
    renderApp()
    fireEvent.click(screen.getByTestId('view-all'))
    let card = await screen.findByText('Probe quick note')
    card = card.closest('.note-card')
    fireEvent.click(within(card).getByTitle('Move to trash'))
    await waitFor(() => {
      const n = findNote('Probe quick note')
      expect(n.trashedAt).toBeTruthy()
      expect(n.remindAt).toBe(null)   // trashing clears the reminder
    })
    fireEvent.click(screen.getByTestId('view-trash'))
    await screen.findByText('Probe quick note')
    card = screen.getByText('Probe quick note').closest('.note-card')
    fireEvent.click(within(card).getByTitle('Restore'))
    await waitFor(() => expect(findNote('Probe quick note').trashedAt).toBeFalsy())

    /* again → delete forever (window.confirm mocked true) */
    fireEvent.click(screen.getByTestId('view-all'))
    card = (await screen.findByText('Probe quick note')).closest('.note-card')
    fireEvent.click(within(card).getByTitle('Move to trash'))
    await waitFor(() => expect(findNote('Probe quick note').trashedAt).toBeTruthy())
    fireEvent.click(screen.getByTestId('view-trash'))
    card = (await screen.findByText('Probe quick note')).closest('.note-card')
    fireEvent.click(within(card).getByTitle('Delete forever'))
    await waitFor(() => expect(findNote('Probe quick note')).toBeUndefined())
  })

  it('editor: markdown preview + duplicate', async () => {
    renderApp()
    fireEvent.click(screen.getByText('Gift ideas', { selector: '.note-card div' }))
    const ed = await screen.findByTestId('note-editor')
    /* checklist renders in the editor */
    expect(within(ed).getByDisplayValue(/Ayesha/)).toBeTruthy()
    fireEvent.click(within(ed).getByRole('button', { name: 'Preview' }))
    await waitFor(() => expect(ed.querySelector('.md-tasks, .md')).toBeTruthy())
    fireEvent.click(within(ed).getByRole('button', { name: 'Write' }))
    fireEvent.click(within(ed).getByRole('button', { name: /Duplicate/ }))
    await waitFor(() => {
      const st = getState()
      expect(st.notes.some(n => /\(copy\)$/.test(n.title || ''))).toBe(true)
    })
  })

  it('repeating note reminder advances on dismiss', async () => {
    renderApp()
    const target = getState().notes.find(n => n.title === 'Gift ideas')
    expect(target).toBeTruthy()
    /* open editor and set reminder + weekly repeat */
    fireEvent.click(screen.getByText('Gift ideas', { selector: '.note-card div' }))
    const ed = await screen.findByTestId('note-editor')
    /* the seed note already has a future reminder — clear it to reach the quick chips */
    const clearBtn = within(ed).queryByTitle('Clear reminder')
    if (clearBtn) fireEvent.click(clearBtn)
    fireEvent.click(within(ed).getByRole('button', { name: /In 1 hour/ }))
    await waitFor(() => expect(findNote('Gift ideas').remindAt).toBeTruthy())
    const repeat = within(ed).getByDisplayValue('No repeat')
    fireEvent.change(repeat, { target: { value: 'weekly' } })
    await waitFor(() => expect(findNote('Gift ideas').repeat).toBe('weekly'))
    const before = findNote('Gift ideas').remindAt

    /* dismiss via the notification center — targeted by notif key */
    window.location.hash = '#/notifications'
    await waitFor(() => expect(document.querySelector(`[data-notif-key="note-${target.id}"]`)).toBeTruthy())
    const card = document.querySelector(`[data-notif-key="note-${target.id}"]`)
    fireEvent.click(within(card).getByTitle('Dismiss'))
    await waitFor(() => {
      const after = findNote('Gift ideas').remindAt
      expect(after).toBeTruthy()
      expect(after > before).toBe(true)   // advanced by a week
    })
  })

  it('legacy notes (old shape) load through normalizeNote', async () => {
    const s = getState()
    s.notes.push({ id: 'legacy1', title: 'Legacy note', body: 'old shape', contactIds: [], pinned: false, updated: new Date().toISOString() })
    localStorage.setItem('pcrm-v1', JSON.stringify(s))
    renderApp()
    await screen.findByText('Legacy note')
    const ln = getState().notes.find(n => n.id === 'legacy1')
    expect(ln.kind).toBe('text')
    expect(Array.isArray(ln.checklist)).toBe(true)
    expect(ln.trashedAt).toBe(null)
    expect(Array.isArray(ln.labels)).toBe(true)
  })

  it('search filters across title, body and checklist text', async () => {
    renderApp()
    await screen.findByText('Legacy note')
    typeIn(screen.getByPlaceholderText(/Search notes/), 'old shape')
    await waitFor(() => {
      expect(screen.getByText('Legacy note')).toBeTruthy()
      expect(screen.queryByText('Gift ideas', { selector: '.note-card div' })).toBeNull()
    })
  })
})
