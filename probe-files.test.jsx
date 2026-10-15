/* Files & Documents + Nearby transfer protocol (jsdom).
 * fake-indexeddb exercises the real IndexedDB code path of filestore. */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { CrmProvider } from './src/store'
import App from './src/App'
import { saveBlob, readBlob, readBlobAsBlob, deleteBlob, storageBackend, fmtSize, b64FromBytes, bytesFromB64 } from './src/lib/filestore'
import { sha256Hex, sha256Pure } from './src/lib/hash'
import { encodeSignal, decodeSignal, chunkBuffer, buildManifest, TransferSource, TransferSink, CHUNK } from './src/lib/nearby'
import { fetchRemoteFile } from './src/lib/share'

const getState = () => JSON.parse(localStorage.getItem('pcrm-v1') || '{}')
const renderApp = (hash = '#/files') => {
  window.location.hash = hash
  return render(<HashRouter><CrmProvider><App /></CrmProvider></HashRouter>)
}

beforeAll(() => { window.confirm = vi.fn(() => true) })
afterEach(cleanup)

const enc = s => new TextEncoder().encode(s)

describe('filestore + hash', () => {
  it('uses the IndexedDB backend when available', () => {
    expect(storageBackend()).toBe('indexeddb')
  })

  it('round-trips blobs through IndexedDB', async () => {
    const bytes = enc('hello files')
    await saveBlob('f-test-1', bytes)
    const back = await readBlob('f-test-1')
    expect(new TextDecoder().decode(back)).toBe('hello files')
    await deleteBlob('f-test-1')
    expect(await readBlob('f-test-1')).toBe(null)
  })

  it('readBlobAsBlob carries the mime type', async () => {
    await saveBlob('f-test-2', enc('x'))
    const blob = await readBlobAsBlob({ id: 'f-test-2', mime: 'text/plain' })
    expect(blob.type).toBe('text/plain')
    await deleteBlob('f-test-2')
  })

  it('base64 helpers round-trip binary', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252])
    expect([...bytesFromB64(b64FromBytes(bytes))]).toEqual([...bytes])
  })

  it('sha256 matches the known vector and the pure fallback', async () => {
    const abc = enc('abc')
    expect(await sha256Hex(abc)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256Pure(abc)).toBe(await sha256Hex(abc))
    expect(await sha256Hex(new Uint8Array(0))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('fmtSize formats', () => {
    expect(fmtSize(512)).toBe('512 B')
    expect(fmtSize(2048)).toBe('2.0 KB')
    expect(fmtSize(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})

describe('nearby protocol (pure)', () => {
  it('encode/decode signal round-trips an RTC description', async () => {
    const desc = { type: 'offer', sdp: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\na=ice-ufrag:test\r\n' }
    const code = await encodeSignal(desc)
    expect(code.startsWith('PCRM1')).toBe(true)
    const back = await decodeSignal(code)
    expect(back.type).toBe('offer')
    expect(back.sdp).toContain('ice-ufrag:test')
    /* whitespace-tolerant, garbage-rejecting */
    expect((await decodeSignal(`  ${code}\n`)).sdp).toContain('ice-ufrag')
    await expect(decodeSignal('not-a-code')).rejects.toThrow(/pairing code/)
  })

  it('chunkBuffer splits at the chunk size', () => {
    const bytes = new Uint8Array(CHUNK * 2 + 100)
    const chunks = [...chunkBuffer(bytes)]
    expect(chunks.length).toBe(3)
    expect(chunks[0].length).toBe(CHUNK)
    expect(chunks[2].length).toBe(100)
  })

  it('source → sink reassembles files with verified checksums', async () => {
    const a = enc('file A content — '.repeat(50))
    const b = enc('file B')
    const manifest = buildManifest([
      { id: 'a', name: 'a.txt', size: a.length, mime: 'text/plain', sha256: await sha256Hex(a) },
      { id: 'b', name: 'b.txt', size: b.length, mime: 'text/plain', sha256: await sha256Hex(b) },
    ])
    const blobs = { a, b }
    const got = []
    let done = false
    let progressCalls = 0
    const sink = new TransferSink({
      onFile: f => got.push(f),
      onProgress: () => progressCalls++,
      onDone: () => { done = true },
      onError: e => { throw new Error('sink error: ' + e) },
    })
    const source = new TransferSource(manifest, async f => blobs[f.id])
    for await (const msg of source.wire()) await sink.feed(msg)
    expect(got.length).toBe(2)
    expect(new TextDecoder().decode(got[0].bytes)).toContain('file A content')
    expect(got[1].meta.name).toBe('b.txt')
    expect(done).toBe(true)
    expect(progressCalls).toBeGreaterThan(0)
  })

  it('sink drops a file whose checksum does not match', async () => {
    const bytes = enc('original')
    const manifest = buildManifest([{ id: 'x', name: 'x.txt', size: bytes.length, mime: 'text/plain', sha256: await sha256Hex(bytes) }])
    const errors = []
    const got = []
    const sink = new TransferSink({ onFile: f => got.push(f), onError: m => errors.push(m) })
    await sink.feed(JSON.stringify({ k: 'manifest', manifest }))
    await sink.feed(JSON.stringify({ k: 'file-start', id: 'x' }))
    await sink.feed(enc('corrupted'))
    await sink.feed(JSON.stringify({ k: 'file-end', id: 'x', sha256: 'deadbeef' }))
    expect(got.length).toBe(0)
    expect(errors[0]).toMatch(/Checksum mismatch/)
  })
})

describe('Files page', () => {
  it('uploads a file: index entry + device registration + search', async () => {
    renderApp()
    const wizSkip = screen.queryByTestId('wiz-skip')            // first-run wizard
    if (wizSkip) fireEvent.click(wizSkip)
    const skip = screen.queryByRole('button', { name: /Skip for now/i })
    if (skip) fireEvent.click(skip)
    await screen.findByText(/Files & Documents/)
    expect(screen.getByText('indexeddb')).toBeTruthy()     // backend card

    const input = document.querySelector('input[type="file"]')
    const file = new File([enc('hello from the test')], 'notes-from-phone.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => {
      const st = getState()
      expect(st.files.length).toBe(1)
      expect(st.files[0].name).toBe('notes-from-phone.txt')
      expect(st.files[0].size).toBe(19)
      expect(st.files[0].sha256).toMatch(/^[0-9a-f]{64}$/)
    })
    /* blob content really stored */
    const meta = getState().files[0]
    const back = await readBlob(meta.id)
    expect(new TextDecoder().decode(back)).toBe('hello from the test')
    /* device registered + shown */
    expect(getState().devices.length).toBe(1)
    expect(screen.getAllByText(/this device/).length).toBeGreaterThan(0)
    /* search filters */
    const search = screen.getByPlaceholderText(/Search files/)
    fireEvent.change(search, { target: { value: 'zzz-no-match' } })
    await waitFor(() => expect(screen.getByText(/No files match/)).toBeTruthy())
    fireEvent.change(search, { target: { value: 'notes-from' } })
    await waitFor(() => expect(screen.getByText('notes-from-phone.txt')).toBeTruthy())
  })

  it('stars, renames and deletes a file', async () => {
    renderApp()
    await screen.findByText('notes-from-phone.txt')
    const row = screen.getByText('notes-from-phone.txt').closest('div').parentElement.parentElement

    fireEvent.click(within(row).getByTitle('Star'))
    await waitFor(() => expect(getState().files[0].starred).toBe(true))

    fireEvent.click(within(row).getByTitle('Rename'))
    const input = await screen.findByDisplayValue('notes-from-phone.txt')
    fireEvent.change(input, { target: { value: 'renamed.txt' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(getState().files[0].name).toBe('renamed.txt'))

    fireEvent.click(within(row).getByTitle('Delete'))
    await waitFor(() => expect(getState().files.length).toBe(0))
  })

  it('adds a file from a remote link', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob([enc('remote content')], { type: 'text/plain' }),
    }))
    renderApp()
    await screen.findByText(/Files & Documents/)
    fireEvent.click(screen.getByRole('button', { name: /From link/ }))
    const input = await screen.findByPlaceholderText('https://…')
    fireEvent.change(input, { target: { value: 'https://raw.githubusercontent.com/x/y/main/remote-doc.txt' } })
    fireEvent.click(screen.getByRole('button', { name: /Fetch & save/ }))
    await waitFor(() => {
      const st = getState()
      expect(st.files.some(f => f.name === 'remote-doc.txt')).toBe(true)
    })
    global.fetch.mockRestore?.()
  })

  it('nearby transfer panel: send requires a session; receive explains pairing', async () => {
    renderApp()
    await screen.findByText(/Files & Documents/)
    fireEvent.click(screen.getByRole('button', { name: /Nearby receive/ }))
    const panel = await screen.findByTestId('nearby-panel')
    expect(within(panel).getByTestId('peer-code')).toBeTruthy()
    /* joining without RTCPeerConnection (jsdom) fails gracefully */
    fireEvent.change(within(panel).getByTestId('peer-code'), { target: { value: 'PCRM1.abc' } })
    fireEvent.click(within(panel).getByRole('button', { name: /Join & generate answer/ }))
    await waitFor(() => expect(panel.textContent).toMatch(/RTCPeerConnection|Could not join|Malformed|Unexpected|pairing code|not defined/i))
  })
})

describe('share lib', () => {
  it('fetchRemoteFile rejects non-http URLs and hard failures', async () => {
    expect((await fetchRemoteFile('ftp://x/y')).ok).toBe(false)
    global.fetch = vi.fn(async () => { throw new Error('cors') })
    expect((await fetchRemoteFile('https://example.com/a.pdf')).reason).toBe('network')
    global.fetch = vi.fn(async () => ({ ok: true, blob: async () => new Blob([enc('z')]) }))
    const res = await fetchRemoteFile('https://example.com/folder/a%20b.pdf')
    expect(res.ok).toBe(true)
    expect(res.name).toBe('a b.pdf')
  })
})
