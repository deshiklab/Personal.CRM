import { useEffect, useRef, useState } from 'react'
import { Send, Download, Copy, QrCode, Check, Loader2, X, Radio, AlertTriangle } from 'lucide-react'
import QRCode from 'qrcode'
import { useCrm } from '../store'
import { Modal, Pill } from './ui'
import { createSenderSession, createReceiverSession } from '../lib/nearby'
import { saveBlob, fmtSize } from '../lib/filestore'
import { cn } from '../lib'

/* SHAREit-style send/receive. Pairing = copyable code + QR (no server).
 * Files stream over a WebRTC DataChannel, SHA-256 verified on arrival. */
export default function NearbyTransfer({ open, onClose, mode: initialMode = 'send', files = [] }) {
  const crm = useCrm()
  const [mode, setMode] = useState(initialMode)
  const [qr, setQr] = useState(null)
  const [myCode, setMyCode] = useState('')
  const [peerCode, setPeerCode] = useState('')
  const [status, setStatus] = useState('idle')     // idle|preparing|pairing|connected|sending|receiving|done|error|aborted
  const [progress, setProgress] = useState({ received: 0, total: 0, name: '' })
  const [fileStates, setFileStates] = useState([])  // {id, name, size, state}
  const [err, setErr] = useState(null)
  const [received, setReceived] = useState([])
  const sessionRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setMode(initialMode)
    setErr(null); setReceived([]); setPeerCode(''); setMyCode(''); setQr(null); setStatus('idle')
    setFileStates(files.map(f => ({ id: f.id, name: f.name, size: f.size, state: 'queued' })))
    return () => { sessionRef.current?.close?.(); sessionRef.current = null }
  }, [open, initialMode])

  const makeQr = async text => {
    try { setQr(await QRCode.toDataURL(text.slice(0, 2200), { margin: 1, width: 220 })) } catch { setQr(null) }
  }

  const copy = async text => {
    try { await navigator.clipboard.writeText(text); crm.toast('Pairing code copied') } catch { crm.toast('Copy failed — select and copy manually', 'warn') }
  }

  /* ── send ── */
  const startSend = async () => {
    setErr(null); setStatus('preparing')
    try {
      const session = await createSenderSession({
        manifest: {
          id: Math.random().toString(36).slice(2, 10),
          ts: new Date().toISOString(),
          files: files.map(f => ({ id: f.id, name: f.name, size: f.size, mime: f.mime, sha256: f.sha256 })),
        },
        loadBytes: async f => {
          const { readBlob } = await import('../lib/filestore')
          return (await readBlob(f.id)) || new Uint8Array()
        },
        onState: s => setStatus(s),
        onAck: id => setFileStates(fs => fs.map(x => x.id === id ? { ...x, state: 'sent' } : x)),
        onDone: () => { setStatus('done'); crm.toast('📡 All files sent') },
        onError: m => { setErr(m); setStatus('error') },
      })
      sessionRef.current = session
      setMyCode(session.code)
      makeQr(session.code)
      setStatus('pairing')
    } catch (e) {
      setErr(e.message || 'Could not start the session'); setStatus('error')
    }
  }

  const connectSend = async () => {
    if (!sessionRef.current || !peerCode.trim()) return
    try {
      await sessionRef.current.acceptAnswer(peerCode.trim())
      crm.toast('Connected — sending…')
      setFileStates(fs => fs.map(x => ({ ...x, state: 'sending' })))
    } catch (e) {
      setErr(e.message || 'Bad answer code'); setStatus('error')
    }
  }

  /* ── receive ── */
  const startReceive = async () => {
    if (!peerCode.trim()) return
    setErr(null); setStatus('preparing')
    try {
      const session = await createReceiverSession({
        offerCode: peerCode.trim(),
        onManifest: m => {
          setFileStates((m.files || []).map(f => ({ id: f.id, name: f.name, size: f.size, state: 'receiving' })))
          setStatus('receiving')
        },
        onProgress: (got, total, meta) => setProgress({ received: got, total, name: meta?.name || '' }),
        onFile: async ({ meta, bytes }) => {
          const f = crm.addFileMeta({
            id: meta.id, name: meta.name, mime: meta.mime, size: meta.size || bytes.length,
            sha256: meta.sha256, folder: 'Received', origin: 'transfer',
          })
          await saveBlob(f.id, bytes)
          setFileStates(fs => fs.map(x => x.id === meta.id ? { ...x, state: 'received' } : x))
          setReceived(rs => [...rs, meta.name])
        },
        onDone: () => { setStatus('done'); crm.toast(`📥 Received ${received.length || ''} file(s)`) },
        onError: m => { setErr(m); setStatus('error') },
      })
      sessionRef.current = session
      setMyCode(session.code)
      makeQr(session.code)
    } catch (e) {
      setErr(e.message || 'Could not join — is the offer code complete?'); setStatus('error')
    }
  }

  const busy = ['preparing', 'sending', 'receiving'].includes(status)

  return (
    <Modal open={open} onClose={() => { sessionRef.current?.close?.(); onClose() }} size="xl"
      title={
        <span className="flex items-center gap-2">
          <Radio size={16} style={{ color: '#34d399' }} />
          Nearby transfer
          <span className="seg ml-2">
            <button className={mode === 'send' ? 'on' : ''} onClick={() => !busy && setMode('send')}>Send</button>
            <button className={mode === 'receive' ? 'on' : ''} onClick={() => !busy && setMode('receive')}>Receive</button>
          </span>
        </span>
      }>
      <div data-testid="nearby-panel" className="flex flex-col gap-3">
        <div className="text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          {mode === 'send'
            ? 'Creates a pairing code. Show the QR to the receiving device (or paste the code there), then paste their answer code below. Files stream directly between the two devices — nothing passes through a server.'
            : 'Paste the sender\'s pairing code (or type their code), then hand your answer code back to them. Accepted files land in your Files list under “Received”.'}
        </div>

        {/* status */}
        <div className="flex items-center gap-2 flex-wrap">
          <Pill color={status === 'error' ? '#fb7185' : status === 'done' ? '#34d399' : '#818cf8'}>
            {busy && <Loader2 size={10} className="animate-spin" />} {status}
          </Pill>
          {mode === 'send' && <span className="text-[11px]" style={{ color: 'var(--faint)' }}>{files.length} file(s) · {fmtSize(files.reduce((s, f) => s + (f.size || 0), 0))}</span>}
          {(progress.total > 0 && busy) && (
            <span className="text-[11px]" style={{ color: 'var(--faint)' }}>
              {progress.name} · {fmtSize(progress.received)} / {fmtSize(progress.total)}
            </span>
          )}
        </div>

        {/* per-file list */}
        {fileStates.length > 0 && (
          <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto">
            {fileStates.map(f => (
              <div key={f.id} className="flex items-center gap-2 text-[11.5px] py-1 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,.03)' }}>
                <span className="flex-1 truncate">{f.name}</span>
                <span style={{ color: 'var(--faint)' }}>{fmtSize(f.size)}</span>
                {f.state === 'sent' || f.state === 'received'
                  ? <Check size={12} className="text-emerald-400" />
                  : f.state === 'queued' ? <span style={{ color: 'var(--faint)' }}>queued</span>
                  : <Loader2 size={12} className="animate-spin" style={{ color: '#818cf8' }} />}
              </div>
            ))}
          </div>
        )}

        {/* pairing */}
        {myCode && (
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 items-start">
            {qr
              ? <img src={qr} alt="Pairing QR code" width={180} height={180} className="rounded-xl border" style={{ borderColor: 'var(--border)' }} />
              : <div className="w-[180px] h-[180px] rounded-xl border grid place-items-center text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--faint)' }}><QrCode size={28} /></div>}
            <div>
              <div className="label">Your pairing code — {mode === 'send' ? 'show this to the receiver' : 'send this back to the sender'}</div>
              <textarea className="input font-mono" readOnly rows={4} value={myCode} data-testid="my-code" />
              <button className="btn btn-ghost btn-sm mt-1.5" onClick={() => copy(myCode)}><Copy size={12} /> Copy code</button>
            </div>
          </div>
        )}

        {/* peer code */}
        <div>
          <div className="label">{mode === 'send' ? 'Answer code from the receiver' : 'Offer code from the sender'}</div>
          <textarea className="input font-mono" rows={3} placeholder="Paste the other device's pairing code here (PCRM1.…)"
            value={peerCode} onChange={e => setPeerCode(e.target.value)} data-testid="peer-code" />
          <div className="flex gap-2 mt-2">
            {mode === 'send'
              ? <>
                  {!myCode
                    ? <button className="btn btn-primary btn-sm" disabled={!files.length || busy} onClick={startSend}><Send size={13} /> Create send session</button>
                    : <button className="btn btn-primary btn-sm" disabled={!peerCode.trim() || busy} onClick={connectSend}><Radio size={13} /> Connect & send</button>}
                  {myCode && !busy && status !== 'done' && <button className="btn btn-ghost btn-sm" onClick={startSend}>New code</button>}
                </>
              : <button className="btn btn-primary btn-sm" disabled={!peerCode.trim() || busy || !!myCode} onClick={startReceive}>
                  <Download size={13} /> Join & generate answer
                </button>}
            {busy && <button className="btn btn-danger btn-sm" onClick={() => { sessionRef.current?.abort?.(); sessionRef.current?.close?.(); setStatus('aborted') }}><X size={13} /> Cancel</button>}
          </div>
        </div>

        {err && (
          <div className="text-[12px] inline-flex items-center gap-1.5" style={{ color: '#fb7185' }}>
            <AlertTriangle size={13} /> {err}
          </div>
        )}
        {status === 'done' && received.length > 0 && (
          <div className="text-[12px]" style={{ color: '#34d399' }}>Received: {received.join(', ')}</div>
        )}
      </div>
    </Modal>
  )
}
