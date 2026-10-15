/**
 * probe-qr-modal — redesigned QR business-card modal
 *
 * 1. identity strip (avatar + name + role·org) + QR hero + details in one modal
 * 2. every mycard field and the full action/scan contract survives the redesign
 * 3. responsive structure: stacked below sm, two-pane at sm+ (layout + field grid)
 * 4. editing a field updates the identity strip live
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { CrmProvider, ToastHost } from './src/store'
import MyQrCard from './src/components/MyQrCard'

const CARD = { name: 'Ada Byron', phone: '15551234567', email: 'ada@ex.com', org: 'Analytical Engines', role: 'Countess', url: 'https://ada.ex', address: 'London', birthday: '1815-12-10', note: 'First programmer' }

const mount = () => {
  localStorage.clear()
  localStorage.setItem('pcrm-v1', JSON.stringify({ lock: { hash: null, skipped: true }, myCard: { ...CARD } }))
  return render(<HashRouter><CrmProvider><ToastHost /><MyQrCard open onClose={() => {}} /></CrmProvider></HashRouter>)
}

afterEach(cleanup)

describe('probe-qr-modal — redesigned my-card modal', () => {
  it('1. shows the identity strip + QR hero + details together', async () => {
    mount()
    await screen.findByTestId('my-qr')
    expect(screen.getByTestId('mycard-strip')).toBeTruthy()
    expect(screen.getByTestId('mycard-avatar').textContent).toBe('AB')
    expect(screen.getByTestId('mycard-layout')).toBeTruthy()
    expect(screen.getByTestId('mycard-qr-col')).toBeTruthy()
    expect(screen.getByTestId('mycard-fields')).toBeTruthy()
    // strip shows name + role · org
    expect(screen.getByTestId('mycard-strip').textContent).toContain('Ada Byron')
    expect(screen.getByTestId('mycard-strip').textContent).toContain('Countess · Analytical Engines')
  })

  it('2. keeps the full field + action + scan contract', async () => {
    mount()
    await screen.findByTestId('my-qr')
    for (const k of ['name', 'phone', 'email', 'org', 'role', 'url', 'address', 'birthday', 'note']) {
      expect(screen.getByTestId(`mycard-${k}`)).toBeTruthy()
    }
    expect(screen.getByTestId('qr-tab-card')).toBeTruthy()
    expect(screen.getByTestId('qr-tab-scan')).toBeTruthy()
    expect(screen.getByTestId('qr-design-toggle')).toBeTruthy()
    expect(screen.getByTestId('qr-download')).toBeTruthy()
    expect(screen.getByTestId('share-my-card')).toBeTruthy()
    expect(screen.getByTestId('mycard-copy')).toBeTruthy()
    // scan tab still reaches the scanner
    fireEvent.click(screen.getByTestId('qr-tab-scan'))
    await screen.findByTestId('qr-scan-start')
  })

  it('3. responsive structure: stacked below sm, two-pane at sm+', async () => {
    mount()
    const layout = await screen.findByTestId('mycard-layout')
    expect(layout.className).toContain('flex-col')
    expect(layout.className).toContain('sm:flex-row')
    const fields = screen.getByTestId('mycard-fields')
    const grid = fields.querySelector('.grid')
    expect(grid.className).toContain('grid-cols-1')
    expect(grid.className).toContain('sm:grid-cols-2')
    const qrCol = screen.getByTestId('mycard-qr-col')
    expect(qrCol.className).toContain('sm:w-[300px]')
  })

  it('4. editing a field updates the identity strip live', async () => {
    mount()
    fireEvent.change(await screen.findByTestId('mycard-name'), { target: { value: 'Grace Hopper' } })
    await waitFor(() => expect(screen.getByTestId('mycard-strip').textContent).toContain('Grace Hopper'))
    fireEvent.change(screen.getByTestId('mycard-role'), { target: { value: 'Rear Admiral' } })
    await waitFor(() => expect(screen.getByTestId('mycard-strip').textContent).toContain('Rear Admiral'))
  })
})
