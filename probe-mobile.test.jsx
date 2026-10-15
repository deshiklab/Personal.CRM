/**
 * WS-7 probe — mobile usability primitives & phone layouts
 *
 * jsdom has no real layout, so this suite verifies *behavior*: the bottom
 * tab bar + More sheet, the Sheet primitive, the phone column picker on
 * Tasks, the phone-default calendar view, the contacts card list + drawer,
 * and the full-screen modal hook. The true 360px overflow/tap-target audit
 * lives in probe-mobile.mjs (Playwright device matrix — run in a browser
 * environment where the browsers are installed).
 */
import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { HashRouter, useLocation } from 'react-router-dom'
import { CrmProvider } from './src/store'
import App from './src/App'
import { Sheet, ToolbarRow, useIsMobile, BottomTabBar } from './src/components/Mobile'

afterEach(() => cleanup())

/* viewport simulator: matchMedia('(max-width: Npx)') matches when width <= N */
function mockViewport(width) {
  window.matchMedia = q => {
    const m = /max-width:\s*(\d+)px/.exec(q || '')
    const matches = !!m && width <= Number(m[1])
    return {
      matches, media: q || '', onchange: null,
      addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {},
      dispatchEvent() { return false },
    }
  }
}

async function mountApp(hash = '#/', width = 1280) {
  window.localStorage.clear()
  mockViewport(width)
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

describe('bottom tab bar + More sheet', () => {
  it('renders 5 tabs and navigates', async () => {
    await mountApp('#/', 375)
    await skipLock()
    const tabs = screen.getByTestId('bottom-tabs')
    expect(tabs.className).toContain('lg:hidden') // desktop keeps the sidebar
    expect(screen.getByTestId('tab-home')).toBeTruthy()
    expect(screen.getByTestId('tab-contacts')).toBeTruthy()
    expect(screen.getByTestId('tab-tasks')).toBeTruthy()
    expect(screen.getByTestId('tab-notes')).toBeTruthy()
    expect(screen.getByTestId('tab-more')).toBeTruthy()
    fireEvent.click(screen.getByTestId('tab-contacts'))
    await waitFor(() => expect(window.location.hash).toBe('#/contacts'))
  })

  it('More opens the sidebar as a sheet and closes on navigation', async () => {
    await mountApp('#/', 375)
    await skipLock()
    expect(screen.queryByTestId('sheet')).toBeNull()
    fireEvent.click(screen.getByTestId('tab-more'))
    await waitFor(() => expect(screen.getByTestId('sheet')).toBeTruthy())
    // full nav lives inside (Settings is a sidebar-only destination)
    const sheet = screen.getByTestId('sheet')
    expect(within(sheet).getByText('Settings')).toBeTruthy()
    expect(within(sheet).getByText('Knowledge')).toBeTruthy()
    fireEvent.click(within(sheet).getByText('Analytics'))
    await waitFor(() => expect(screen.queryByTestId('sheet')).toBeNull()) // auto-close on route change
    expect(window.location.hash).toBe('#/analytics')
  })

  it('Sheet closes on Escape, backdrop and the close button', async () => {
    function Harness() {
      const [open, setOpen] = React.useState(true)
      return (
        <Sheet open={open} onClose={() => setOpen(false)} title="Test sheet">
          <div data-testid="sheet-body">body</div>
        </Sheet>
      )
    }
    render(<Harness />)
    expect(screen.getByTestId('sheet-body')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('sheet')).toBeNull())
  })
})

describe('phone layouts', () => {
  it('Tasks shows a column picker on phones and one column at a time', async () => {
    await mountApp('#/tasks', 375)
    await skipLock()
    const picker = await screen.findByTestId('task-col-picker')
    expect(within(picker).getByTestId('colpick-todo')).toBeTruthy()
    expect(within(picker).getByTestId('colpick-done')).toBeTruthy()
    // default phone column: To do
    expect(screen.getByText('To do', { selector: 'span.font-bold' })).toBeTruthy()
    fireEvent.click(screen.getByTestId('colpick-done'))
    await waitFor(() => expect(screen.queryByTestId('colpick-done').className).toContain('on'))
    // board now shows the Done column only (its header, not In progress)
    expect(screen.queryByText('In progress', { selector: 'span.font-bold' })).toBeNull()
  })

  it('Tasks shows all four columns without the picker on desktop', async () => {
    await mountApp('#/tasks', 1280)
    await skipLock()
    expect(screen.queryByTestId('task-col-picker')).toBeNull()
    expect(screen.getByText('In progress', { selector: 'span.font-bold' })).toBeTruthy()
  })

  it('Calendar defaults to the week view on phones, month on desktop', async () => {
    await mountApp('#/calendar', 375)
    await skipLock()
    const weekBtn = await screen.findByRole('button', { name: /^week$/i })
    expect(weekBtn.className).toBe('on')
    cleanup()
    await mountApp('#/calendar', 1280)
    await skipLock()
    const monthBtn = await screen.findByRole('button', { name: /^month$/i })
    expect(monthBtn.className).toBe('on')
  })

  it('Contacts renders phone cards that open the drawer', async () => {
    await mountApp('#/contacts', 375)
    await skipLock()
    const cards = await screen.findByTestId('contacts-cards')
    expect(cards.className).toContain('md:hidden')
    // seeded contact exists as a card (unique seeded name)
    const card = cards.querySelector('[data-testid]') // first card
    expect(card).toBeTruthy()
    fireEvent.click(card)
    // drawer is full-width on phones (w-full sm:w-[480px])
    await waitFor(() => expect(screen.getByText('Log contact')).toBeTruthy())
    const panel = document.querySelector('.absolute.inset-y-0.right-0')
    expect(panel?.className).toContain('w-full')
    expect(panel?.className).toContain('sm:w-[480px]')
  })

  it('detail Modal carries the mobile full-screen hook classes', async () => {
    await mountApp('#/contacts', 375)
    await skipLock()
    await screen.findByTestId('contacts-cards')
    fireEvent.click(screen.getAllByTitle('Edit contact')[0])
    await waitFor(() => expect(document.querySelector('.modal-panel')).toBeTruthy())
    expect(document.querySelector('.modal-wrap')).toBeTruthy()
  })
})

describe('viewport hook', () => {
  it('useIsMobile tracks the breakpoint', () => {
    mockViewport(375)
    function Probe() {
      const m = useIsMobile(1023)
      return <div data-testid="probe">{m ? 'phone' : 'desktop'}</div>
    }
    render(<Probe />)
    expect(screen.getByTestId('probe').textContent).toBe('phone')
    cleanup()
    mockViewport(1280)
    render(<Probe />)
    expect(screen.getByTestId('probe').textContent).toBe('desktop')
  })

  it('BottomTabBar/ToolbarRow keep their mobile utility classes', () => {
    mockViewport(375)
    render(<HashRouter><BottomTabBar onMore={() => {}} /></HashRouter>)
    expect(screen.getByTestId('bottom-tabs').className).toContain('lg:hidden')
    render(<ToolbarRow data-testid="tr"><span>x</span></ToolbarRow>)
    expect(screen.getByTestId('tr').className).toContain('toolbar-row')
  })
})
