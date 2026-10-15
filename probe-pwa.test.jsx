/**
 * PWA probe — installability plumbing, offline worker, share-into-app.
 *
 * Verifies the manifest contract (fs), the service worker's dev-safe
 * caching rules (fs), share_target ingestion (the WS-4 remainder: WhatsApp
 * & friends → Save as note / Create task / Copy), and the install-button
 * flow via beforeinstallprompt.
 */
import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { HashRouter } from 'react-router-dom'
import { CrmProvider } from './src/store'
import App from './src/App'

afterEach(() => cleanup())

const read = f => readFileSync(resolve(process.cwd(), f), 'utf8')
const manifest = JSON.parse(read('public/manifest.webmanifest'))

async function mountApp(hash = '#/') {
  window.localStorage.clear()
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

describe('manifest contract', () => {
  it('is a valid installable manifest with current features', () => {
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('./')
    expect(manifest.scope).toBe('./')
    expect(manifest.theme_color).toBeTruthy()
    const sizes = manifest.icons.map(i => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    expect(manifest.icons.some(i => (i.purpose || '').includes('maskable'))).toBe(true)
    // shortcuts reach the newer modules
    const urls = manifest.shortcuts.map(s => s.url).join(' ')
    expect(urls).toContain('#/kb')
    expect(urls).toContain('#/notes?new=1')
    expect(manifest.description).toMatch(/knowledge base|reminders|files/i)
  })

  it('declares a GET share_target with title/text/url params', () => {
    const st = manifest.share_target
    expect(st).toBeTruthy()
    expect(st.method).toBe('GET')
    expect(st.params).toEqual({ title: 'title', text: 'text', url: 'url' })
  })
})

describe('service worker source', () => {
  it('registers outside production and passes dev modules through', () => {
    const main = read('src/main.jsx')
    expect(main).toContain("navigator.serviceWorker.register('./sw.js')")
    expect(main).not.toContain('import.meta.env.PROD &&')  // registered in dev too
    const sw = read('public/sw.js')
    expect(sw).toContain("const VERSION = 'pcrm-v3'")
    // dev-safe guard: live modules must never be cache-served
    expect(sw).toMatch(/@vite\|src\|node_modules/)
    expect(sw).toContain('navigate') // offline navigation fallback exists
  })
})

describe('share-into-app (PWA share_target)', () => {
  it('shared text becomes a note in one tap', async () => {
    window.history.replaceState({}, '', '/?title=Lunch%20idea&text=Try%20the%20new%20place%20in%20Dhanmondi&url=https%3A%2F%2Fmaps.example%2Fx#/')
    await mountApp('#/')
    await skipLock()
    await screen.findByTestId('share-target-modal')
    expect(screen.getByText('Lunch idea')).toBeTruthy()
    expect(screen.getByText(/Dhanmondi/)).toBeTruthy()
    fireEvent.click(screen.getByTestId('share-as-note'))
    await waitFor(() => expect(screen.queryByTestId('share-target-modal')).toBeNull())
    const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
    const note = (saved.notes || []).find(n => n.title === 'Lunch idea')
    expect(note).toBeTruthy()
    expect(note.body).toContain('Dhanmondi')
    expect(note.body).toContain('https://maps.example/x')
    // URL was cleaned so a refresh won't re-trigger
    expect(window.location.search).toBe('')
  })

  it('shared text can become a task instead', async () => {
    window.history.replaceState({}, '', '/?text=Call%20the%20landlord%20about%20the%20lease#/')
    await mountApp('#/')
    await skipLock()
    await screen.findByTestId('share-target-modal')
    fireEvent.click(screen.getByTestId('share-as-task'))
    await waitFor(() => expect(screen.queryByTestId('share-target-modal')).toBeNull())
    const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
    const task = (saved.tasks || []).find(t => /landlord/i.test(t.title))
    expect(task).toBeTruthy()
    expect(task.column).toBe('todo')
  })

  it('no shared params → no modal', async () => {
    window.history.replaceState({}, '', '/#/')
    await mountApp('#/')
    await skipLock()
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByTestId('share-target-modal')).toBeNull()
  })
})

describe('install flow', () => {
  it('beforeinstallprompt surfaces the Install button; appinstalled clears it', async () => {
    await mountApp('#/')
    await skipLock()
    expect(screen.queryByRole('button', { name: /install/i })).toBeNull()
    const promptEvt = new Event('beforeinstallprompt')
    promptEvt.prompt = () => {}
    promptEvt.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(promptEvt)
    await waitFor(() => expect(screen.getByRole('button', { name: /install/i })).toBeTruthy())
    window.dispatchEvent(new Event('appinstalled'))
    await waitFor(() => expect(screen.queryByRole('button', { name: /install/i })).toBeNull())
  })
})
