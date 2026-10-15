import { useEffect, useMemo, useRef, useState } from 'react'
import { QrCode, Camera, Upload, Share2, Copy, ScanLine, X } from 'lucide-react'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { useNavigate } from 'react-router-dom'
import { useCrm } from '../store'
import { Modal } from './ui'
import { toVCF, downloadVCF } from '../lib/vcard'
import { copyText } from '../lib/share'

/* X2 — QR business-card mode.
 *  My card: live vCard-QR of your identity (edit fields → QR updates).
 *  Scan:    camera (jsQR) or QR-image upload → straight into the
 *           WS-2 import pipeline with the decoded vCard prefilled. */
export default function MyQrCard({ open, onClose }) {
  const { myCard, updateMyCard, toast } = useCrm()
  const [tab, setTab] = useState('card')
  const [qr, setQr] = useState(null)
  const nav = useNavigate()
  const card = myCard || {}
  const set = (k, v) => updateMyCard({ [k]: v })

  const vcf = useMemo(() => toVCF({
    name: card.name || 'Me',
    phone: card.phone || '',
    email: card.email || '',
    company: card.org || '',
    role: '',
    birthday: null,
    interests: [],
    introducedBy: null,
  }), [card.name, card.phone, card.email, card.org])

  useEffect(() => {
    if (!open || tab !== 'card') return
    QRCode.toDataURL(vcf, { margin: 1, width: 280, color: { dark: '#0a0c11', light: '#ffffff' } })
      .then(setQr).catch(() => setQr(null))
  }, [open, tab, vcf])

  const onDecoded = text => {
    if (/BEGIN:VCARD/i.test(text)) {
      try { sessionStorage.setItem('pcrm-vcard-in', text) } catch { /* private mode */ }
      onClose?.()
      nav('/import')
      toast('📇 Card captured — review the import diff before committing')
    } else {
      toast('That QR is not a business card (vCard)', 'warn')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="QR business card">
      <div className="flex gap-1.5 mb-4">
        <button className={`chip chip-btn ${tab === 'card' ? 'on' : ''}`} data-testid="qr-tab-card" onClick={() => setTab('card')}>
          <QrCode size={11} /> My card
        </button>
        <button className={`chip chip-btn ${tab === 'scan' ? 'on' : ''}`} data-testid="qr-tab-scan" onClick={() => setTab('scan')}>
          <ScanLine size={11} /> Scan a card
        </button>
      </div>

      {tab === 'card' ? (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex flex-col items-center gap-2 flex-none">
            {qr
              ? <img src={qr} alt="My vCard QR" data-testid="my-qr" width={220} height={220} className="rounded-2xl" style={{ background: '#fff', padding: 8 }} />
              : <div className="w-[220px] h-[220px] rounded-2xl grid place-items-center text-[11px] text-center px-6"
                  style={{ background: 'rgba(255,255,255,.05)', color: 'var(--faint)' }}>
                  QR rendering needs a canvas-capable browser — the fields and .vcf share still work.
                </div>}
            <div className="flex gap-1.5">
              <button className="btn btn-ghost btn-sm" data-testid="share-my-card" onClick={async () => {
                const file = new File([vcf], `${(card.name || 'my-card').replace(/\s+/g, '-')}.vcf`, { type: 'text/vcard' })
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                  try { await navigator.share({ files: [file], title: 'My card' }); return } catch { /* cancelled */ return }
                }
                downloadVCF([{ name: card.name || 'Me', phone: card.phone, email: card.email, company: card.org }], 'my-card.vcf')
                toast('📇 my-card.vcf downloaded')
              }}><Share2 size={13} /> Share .vcf</button>
              <button className="btn btn-ghost btn-sm" onClick={async () => {
                const ok = await copyText(vcf)
                toast(ok ? '📋 vCard copied' : 'Copy failed', ok ? 'ok' : 'warn')
              }}><Copy size={13} /> Copy</button>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2.5 min-w-0">
            {[
              ['name', 'Full name', 'e.g. Rahim Uddin'],
              ['phone', 'Phone', '+8801…'],
              ['email', 'Email', 'you@example.com'],
              ['org', 'Company / role', 'e.g. BiTsCol'],
              ['url', 'Website', 'https://…'],
            ].map(([k, label, ph]) => (
              <label key={k} className="block">
                <span className="label">{label}</span>
                <input className="input mt-1" data-testid={`mycard-${k}`} value={card[k] || ''} placeholder={ph}
                  onChange={e => set(k, e.target.value.slice(0, 80))} />
              </label>
            ))}
            <div className="text-[11px] leading-snug" style={{ color: 'var(--faint)' }}>
              This QR encodes a standard vCard — any phone camera reads it and saves you as a contact. Nothing leaves this device.
            </div>
          </div>
        </div>
      ) : (
        <QrScanner onResult={onDecoded} />
      )}
    </Modal>
  )
}

function QrScanner({ onResult }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(0)
  const [live, setLive] = useState(false)
  const [err, setErr] = useState('')

  const stop = () => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks?.().forEach(t => t.stop())
    streamRef.current = null
    setLive(false)
  }
  useEffect(() => stop, [])

  const scanOnce = () => {
    const v = videoRef.current, cv = canvasRef.current
    if (!v || !cv || v.readyState < 2) { rafRef.current = requestAnimationFrame(scanOnce); return }
    const w = v.videoWidth || 320, h = v.videoHeight || 240
    cv.width = w; cv.height = h
    const ctx = cv.getContext('2d')
    ctx.drawImage(v, 0, 0, w, h)
    const img = ctx.getImageData(0, 0, w, h)
    const code = jsQR(img.data, w, h)
    if (code?.data) { stop(); onResult(code.data); return }
    rafRef.current = requestAnimationFrame(scanOnce)
  }

  const start = async () => {
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setLive(true)
      rafRef.current = requestAnimationFrame(scanOnce)
    } catch {
      setErr('Camera unavailable — upload the QR image instead.')
    }
  }

  const onUpload = f => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const cv = document.createElement('canvas')
        cv.width = img.width; cv.height = img.height
        const ctx = cv.getContext('2d')
        ctx.drawImage(img, 0, 0)
        const data = ctx.getImageData(0, 0, cv.width, cv.height)
        const code = jsQR(data.data, cv.width, cv.height)
        if (code?.data) onResult(code.data)
        else setErr('No QR code found in that image.')
      }
      img.onerror = () => setErr('Could not read that image.')
      img.src = String(reader.result || '')
    }
    reader.readAsDataURL(f)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl overflow-hidden grid place-items-center" style={{ background: 'rgba(255,255,255,.04)', minHeight: 220 }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} playsInline muted style={{ width: '100%', maxHeight: 320, display: live ? 'block' : 'none' }} />
        <canvas ref={canvasRef} className="hidden" />
        {!live && (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <Camera size={28} style={{ color: 'var(--faint)' }} />
            <div className="text-[12px]" style={{ color: 'var(--muted)' }}>Point the camera at the other person's card QR</div>
          </div>
        )}
      </div>
      {err && <div className="text-[11.5px] font-semibold" style={{ color: '#fbbf24' }}>{err}</div>}
      <div className="flex gap-2">
        {live
          ? <button className="btn btn-ghost justify-center flex-1" onClick={stop}><X size={14} /> Stop camera</button>
          : <button className="btn btn-primary justify-center flex-1" data-testid="qr-scan-start" onClick={start}><Camera size={14} /> Start camera</button>}
        <label className="btn btn-ghost justify-center flex-1 cursor-pointer">
          <Upload size={14} /> Upload QR image
          <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }} />
        </label>
      </div>
    </div>
  )
}
