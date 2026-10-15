/* Nearby send/receive — SHAREit-style device-to-device transfer.
 *
 * Pairing: the sender's WebRTC offer is encoded into a copyable code + QR
 * (deflate + base64url). The receiver answers with their own code. No
 * server, no accounts — files stream over an RTCDataChannel in 16 KB
 * chunks, each file verified by SHA-256 on arrival.
 *
 * The protocol layer (manifest / chunking / reassembly) is pure and unit
 * tested; the RTC wiring below is a thin shell around it. */
import { sha256Hex } from './hash'

export const CHUNK = 16 * 1024
const MAX_BUFFERED = 1 << 20
const RTC_CFG = { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] }

/* ── base64url ── */
const b64urlFromBytes = bytes => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const bytesFromB64url = s => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/* ── signal codec: RTCSessionDescription ⇄ copyable code ─────── */
const textEnc = new TextEncoder()
const textDec = new TextDecoder()

async function deflate(bytes) {
  try {
    const CS = globalThis.CompressionStream
    if (!CS) return null
    const stream = new Blob([bytes]).stream().pipeThrough(new CS('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch { return null }
}
async function inflate(bytes) {
  const DS = globalThis.DecompressionStream
  if (!DS) return null
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DS('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch { return null }
}

export async function encodeSignal(desc) {
  const raw = textEnc.encode(JSON.stringify({ type: desc.type, sdp: desc.sdp }))
  const z = await deflate(raw)
  return (z ? 'PCRM1z.' : 'PCRM1.') + b64urlFromBytes(z || raw)
}

export async function decodeSignal(code) {
  const t = String(code || '').trim()
  const m = t.match(/^PCRM1(z?)\.(.+)$/)
  if (!m) throw new Error('Not a Personal CRM pairing code')
  let bytes = bytesFromB64url(m[2])
  if (m[1]) {
    const plain = await inflate(bytes)
    if (!plain) throw new Error('Compressed code needs a newer browser')
    bytes = plain
  }
  const obj = JSON.parse(textDec.decode(bytes))
  if (!obj || !obj.sdp) throw new Error('Malformed pairing code')
  return { type: obj.type || 'offer', sdp: obj.sdp }
}

/* ── protocol layer (pure) ───────────────────────────────────── */
export function buildManifest(files) {
  return {
    id: Math.random().toString(36).slice(2, 10),
    ts: new Date().toISOString(),
    files: files.map(f => ({ id: f.id, name: f.name, size: f.size, mime: f.mime, sha256: f.sha256 })),
  }
}

export function* chunkBuffer(bytes, size = CHUNK) {
  for (let i = 0; i < bytes.length; i += size) yield bytes.subarray(i, i + size)
}

/* sender side: turn manifest + bytes into a stream of wire messages */
export class TransferSource {
  /* loadBytes: (fileMeta) => Promise<Uint8Array> */
  constructor(manifest, loadBytes) {
    this.manifest = manifest
    this.loadBytes = loadBytes
  }
  async *wire() {
    yield JSON.stringify({ k: 'manifest', manifest: this.manifest })
    for (const f of this.manifest.files) {
      yield JSON.stringify({ k: 'file-start', id: f.id })
      const bytes = await this.loadBytes(f)
      for (const chunk of chunkBuffer(bytes)) yield chunk
      yield JSON.stringify({ k: 'file-end', id: f.id, sha256: f.sha256 || (await sha256Hex(bytes)) })
    }
    yield JSON.stringify({ k: 'done' })
  }
}

/* receiver side: feed wire messages, get verified files */
export class TransferSink {
  /* { onManifest, onFile({meta, bytes}), onProgress(received, total), onDone, onError } */
  constructor(hooks = {}) {
    this.hooks = hooks
    this.manifest = null
    this.current = null          // { meta, parts: Uint8Array[], received }
    this.finished = new Map()
    this.total = 0
    this.received = 0
    this.aborted = false
  }

  async feed(data) {
    if (this.aborted) return
    if (typeof data === 'string') {
      let msg
      try { msg = JSON.parse(data) } catch { return }
      return this._control(msg)
    }
    return this._chunk(data instanceof Uint8Array ? data : new Uint8Array(data))
  }

  async _control(msg) {
    const h = this.hooks
    if (msg.k === 'manifest') {
      this.manifest = msg.manifest
      this.total = (msg.manifest?.files || []).reduce((s, f) => s + (f.size || 0), 0)
      h.onManifest?.(msg.manifest)
    } else if (msg.k === 'file-start') {
      const meta = this.manifest?.files?.find(f => f.id === msg.id)
      this.current = { meta: meta || { id: msg.id, name: 'file' }, parts: [], received: 0 }
    } else if (msg.k === 'file-end') {
      if (!this.current) return
      const bytes = concatBytes(this.current.parts)
      const hash = await sha256Hex(bytes)
      if (msg.sha256 && hash !== msg.sha256) {
        h.onError?.(`Checksum mismatch on ${this.current.meta.name} — file dropped`)
      } else {
        const out = { meta: { ...this.current.meta, sha256: hash }, bytes }
        this.finished.set(this.current.meta.id, out)
        await h.onFile?.(out)
      }
      this.current = null
    } else if (msg.k === 'done') {
      h.onDone?.({ files: [...this.finished.values()] })
    } else if (msg.k === 'abort') {
      this.aborted = true
      h.onError?.(msg.reason || 'Transfer aborted by the other device')
    } else if (msg.k === 'ack') {
      h.onAck?.(msg.id)
    }
  }

  async _chunk(bytes) {
    if (!this.current) return
    this.current.parts.push(bytes)
    this.current.received += bytes.length
    this.received += bytes.length
    this.hooks.onProgress?.(Math.min(this.received, this.total), this.total, this.current.meta)
  }
}

export function concatBytes(parts) {
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) { out.set(p, off); off += p.length }
  return out
}

/* ── RTC wiring ──────────────────────────────────────────────── */
export function waitIceComplete(pc, timeoutMs = 2500) {
  return new Promise(res => {
    if (pc.iceGatheringState === 'complete') return res()
    const done = () => { clearTimeout(t); pc.removeEventListener('icegatheringstatechange', check); res() }
    const check = () => { if (pc.iceGatheringState === 'complete') done() }
    const t = setTimeout(done, timeoutMs)
    pc.addEventListener('icegatheringstatechange', check)
  })
}

const sendWithBackpressure = (dc, data) => new Promise((resolve, reject) => {
  try {
    if (dc.readyState !== 'open') return resolve(false)
    const pump = () => {
      if (dc.readyState !== 'open') return resolve(false)
      if (dc.bufferedAmount > MAX_BUFFERED) { setTimeout(pump, 30); return }
      dc.send(data)
      resolve(true)
    }
    pump()
  } catch (e) { reject(e) }
})

/* ── sender ──────────────────────────────────────────────────── */
export async function createSenderSession({ manifest, loadBytes, onState, onProgress, onAck, onDone, onError }) {
  const pc = new RTCPeerConnection(RTC_CFG)
  const dc = pc.createDataChannel('pcrm-files', { ordered: true })
  let source = null
  let sending = false

  const state = s => onState?.(s)
  state('preparing')

  dc.onopen = () => { state('connected'); if (!sending && source) start() }
  dc.onclose = () => state('closed')
  pc.onconnectionstatechange = () => state(pc.connectionState)
  dc.onmessage = async ev => {
    if (typeof ev.data === 'string') {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.k === 'ack') onAck?.(msg.id)
      } catch { /* ignore */ }
    }
  }

  async function start() {
    sending = true
    state('sending')
    try {
      for await (const msg of source.wire()) {
        const ok = await sendWithBackpressure(dc, msg)
        if (!ok) throw new Error('Connection closed during send')
        if (typeof msg !== 'string' && onProgress) {
          /* coarse progress: byte counts are tracked by the receiver view */
        }
      }
      state('done'); onDone?.()
    } catch (e) {
      state('error'); onError?.(e.message || 'Send failed')
    }
  }

  source = new TransferSource(manifest, loadBytes)
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  await waitIceComplete(pc)
  const code = await encodeSignal(pc.localDescription)

  return {
    code,
    pc,
    async acceptAnswer(answerCode) {
      const desc = await decodeSignal(answerCode)
      await pc.setRemoteDescription(desc)
      state('answering')
    },
    abort() {
      try { dc.send(JSON.stringify({ k: 'abort', reason: 'cancelled' })) } catch { /* closed */ }
      try { pc.close() } catch { /* noop */ }
      state('aborted')
    },
    close() { try { pc.close() } catch { /* noop */ } },
  }
}

/* ── receiver ────────────────────────────────────────────────── */
export async function createReceiverSession({ offerCode, onManifest, onFile, onProgress, onDone, onError, onState }) {
  const pc = new RTCPeerConnection(RTC_CFG)
  const sink = new TransferSink({ onManifest, onFile, onProgress, onDone, onError })
  const state = s => onState?.(s)
  state('joining')

  pc.ondatachannel = ev => {
    const dc = ev.channel
    dc.onmessage = async msgEv => {
      await sink.feed(msgEv.data)
      if (typeof msgEv.data === 'string') {
        try {
          const m = JSON.parse(msgEv.data)
          if (m.k === 'file-end') dc.send(JSON.stringify({ k: 'ack', id: m.id }))
        } catch { /* ignore */ }
      }
    }
    dc.onopen = () => state('connected')
    dc.onclose = () => state('closed')
  }
  pc.onconnectionstatechange = () => state(pc.connectionState)

  const desc = await decodeSignal(offerCode)
  await pc.setRemoteDescription(desc)
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  await waitIceComplete(pc)
  const code = await encodeSignal(pc.localDescription)

  return {
    code,
    pc,
    close() { try { pc.close() } catch { /* noop */ } },
  }
}
