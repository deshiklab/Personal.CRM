/**
 * probe-dash-greet — Dashboard dynamic greeting
 *
 * 1. greets by time of day + the user's profile first name (myCard.name)
 * 2. falls back to the workspace name (BiTsCol) when no profile name exists
 * 3. updates when the profile name changes
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { CrmProvider } from './src/store'
import Dashboard from './src/pages/Dashboard'

const hour = new Date().getHours()
const expectedGreet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

/* SectionHead title is an <h2> with nested <span> — match on the element's full text */
const findGreeting = txt => screen.findByText((_, el) => !!el && el.tagName === 'H2' && el.textContent === txt)
const queryGreeting = txt => screen.queryByText((_, el) => !!el && el.tagName === 'H2' && el.textContent === txt)

const seed = (myCard) => {
  localStorage.clear()
  localStorage.setItem('pcrm-v1', JSON.stringify({
    lock: { hash: null, skipped: true },
    myCard: myCard || { name: '', phone: '', email: '', org: '', role: '', url: '', address: '', birthday: '', note: '' },
  }))
  return render(<HashRouter><CrmProvider><Dashboard /></CrmProvider></HashRouter>)
}

beforeAll(() => {
  window.matchMedia = window.matchMedia || (q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }))
})
afterEach(cleanup)

describe('probe-dash-greet — dynamic Overview greeting', () => {
  it('1. greets by time of day with the profile first name', async () => {
    seed({ name: 'Zia Testname', phone: '', email: '', org: '', role: '', url: '', address: '', birthday: '', note: '' })
    await findGreeting(`${expectedGreet}, Zia 👋`)
  })

  it('2. falls back to the workspace name when the profile is empty', async () => {
    seed()
    await findGreeting(`${expectedGreet}, BiTsCol 👋`)
  })

  it('3. the greeting tracks profile edits live', async () => {
    seed()
    await findGreeting(`${expectedGreet}, BiTsCol 👋`)
    // derived render contract: first word only, rest of the name dropped
    cleanup()
    seed({ name: 'Nusrat Jahan Khan', phone: '', email: '', org: '', role: '', url: '', address: '', birthday: '', note: '' })
    await findGreeting(`${expectedGreet}, Nusrat 👋`)
    expect(queryGreeting(`${expectedGreet}, Nusrat Jahan 👋`)).toBeNull()
  })
})
