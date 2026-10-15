import { useEffect, useMemo, useRef, useState } from 'react'
import { QrCode, Camera, Upload, Share2, Copy, ScanLine, X, Download, Sliders, ShieldCheck, Sparkles } from 'lucide-react'
import jsQR from 'jsqr'
import { useNavigate } from 'react-router-dom'
import { useCrm } from '../store'
import { Modal } from './ui'
import Avatar from './Avatar'
import QrDesigner from './QrDesigner'
import { toVCF, downloadVCF } from '../lib/vcard'
import { copyText } from '../lib/share'
import { renderStyledQr, styledQrDataUrl, qrStyleOf } from '../lib/qrstyle'

/* X2 — QR business-card mode (redesigned modal).
 *  My card: live vCard-QR of your identity (edit fields → QR updates).
 *  Scan:    camera (jsQR) or QR-image upload → straight into the
 *           WS-2 import pipeline with the decoded vCard prefilled.
 *  Layout:  identity strip + QR hero | details, single column below sm.
 */
export default function MyQrCard({ open, onClose }) {
  const { myCard, updateMyCard, toast, qrStyle } = useCrm()
  const [tab, setTab] = useState('card')
  const [designOpen, setDesignOpen] = useState(false)
  const [qrMode, setQrMode] = useState(null)   // 'styled' | 'plain' | null
  const qrBoxRef = useRef(null)
  const nav = useNavigate()
  const card = myCard || {}
  const set = (k, v) => updateMyCard({ [k]: v })

  const vcf = useMemo(() => toVCF({
    name: card.name || 'Me',
    phone: card.phone || '',
    email: card.email || '',
    company: card.org || '',
    role: card.role || '',
    birthday: card.birthday || null,
    address: card.address || '',
    url: card.url || '',
    note: card.note || '',
    interests: [],
    introducedBy: null,
  }), [card.name, card.phone, card.email, card.org, card.role, card.birthday, card.address, card.url, card.note])

  useEffect(() => {
    if (!open || tab !== 'card' || !qrBoxRef.current) return
    let dead = false
    renderStyledQr(qrBoxRef.current, vcf, qrStyle).then(mode => { if (!dead) setQrMode(mode) })
    return () => { dead = true }
  }, [open, tab, vcf, qrStyle, designOpen])

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
    <Modal open={open} onClose={onClose} title="QR business card" wide>
      {/* tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto toolbar-row">
        <button className={`chip chip-btn shrink-0 ${tab === 'card' ? 'on' : ''}`} data-testid="qr-tab-card" onClick={() => setTab('card')}>
          <QrCode size={11} /> My card
        </button>
        <button className={`chip chip-btn shrink-0 ${tab === 'scan' ? 'on' : ''}`} data-testid="qr-tab-scan" onClick={() => setTab('scan')}>
          <ScanLine size={11} /> Scan a card
        </button>
      </div>

      {tab === 'card' ? (
        <div className="flex flex-col gap-4">
          {/* identity strip */}
          <div data-testid="mycard-strip" className="flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl"
            style={{ background: 'linear-gradient(120deg, rgba(129,140,248,.10), rgba(56,189,248,.06))', border: '1px solid rgba(129,140,248,.18)' }}>
            <Avatar name={card.name} size={46} testid="mycard-avatar" />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[14.5px] truncate">{(card.name || '').trim() || 'Your name here'}</div>
              <div className="text-[11.5px] truncate" style={{ color: 'var(--muted)' }}>
                {[card.role, card.org].filter(Boolean).join(' · ') || 'Add your details below — the QR updates live'}
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[10.5px] font-semibold px-2.5 py-1 rounded-full shrink-0"
              style={{ background: 'rgba(52,211,153,.12)', color: '#34d399' }}>
              <Sparkles size={11} /> Live vCard
            </div>
          </div>

          {/* QR hero | details */}
          <div data-testid="mycard-layout" className="flex flex-col sm:flex-row gap-5">
            {/* QR column */}
            <div data-testid="mycard-qr-col" className="flex flex-col items-center gap-2.5 sm:w-[300px] flex-none">
              <div className="w-full max-w-[300px] rounded-2xl p-3.5 grid place-items-center"
                style={{ background: 'linear-gradient(160deg, rgba(129,140,248,.10), rgba(56,189,248,.05))', border: '1px solid var(--line, rgba(148,163,184,.14))' }}>
                <div ref={qrBoxRef} data-testid="my-qr" className="rounded-xl overflow-hidden w-full"
                  style={{ background: qrStyleOf(qrStyle).bg, maxWidth: 260, width: '100%', aspectRatio: '1 / 1', display: 'grid', placeItems: 'center' }} />
              </div>
              {qrMode === null && (
                <div className="w-full max-w-[280px] text-[11px] text-center px-2" style={{ color: 'var(--faint)' }}>
                  QR rendering needs a canvas-capable browser — the fields and .vcf share still work.
                </div>
              )}
              <div className="flex gap-1.5 flex-wrap justify-center">
                <button className="btn btn-ghost btn-sm" data-testid="qr-design-toggle"
                  onClick={() => setDesignOpen(o => !o)}>
                  <Sliders size={13} /> {designOpen ? 'Hide design' : 'Design'}
                </button>
                <button className="btn btn-ghost btn-sm" data-testid="qr-download"
                  onClick={async () => {
                    const url = await styledQrDataUrl(vcf, qrStyle)
                    if (!url) return toast('QR rendering unavailable here', 'warn')
                    const a = document.createElement('a')
                    a.href = url; a.download = `${(card.name || 'my-card').replace(/\s+/g, '-')}-qr.png`
                    document.body.appendChild(a); a.click(); a.remove()
                    toast('🖼️ QR downloaded as PNG')
                  }}>
                  <Download size={13} /> PNG
                </button>
                <button className="btn btn-ghost btn-sm" data-testid="share-my-card" onClick={async () => {
                  const file = new File([vcf], `${(card.name || 'my-card').replace(/\s+/g, '-')}.vcf`, { type: 'text/vcard' })
                  if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try { await navigator.share({ files: [file], title: 'My card' }); return } catch { /* cancelled */ return }
                  }
                  downloadVCF([{ name: card.name || 'Me', phone: card.phone, email: card.email, company: card.org }], 'my-card.vcf')
                  toast('📇 my-card.vcf downloaded')
                }}><Share2 size={13} /> Share .vcf</button>
                <button className="btn btn-ghost btn-sm" data-testid="mycard-copy" onClick={async () => {
                  const ok = await copyText(vcf)
                  toast(ok ? '📋 vCard copied' : 'Copy failed', ok ? 'ok' : 'warn')
                }}><Copy size={13} /> Copy</button>
              </div>
            </div>

            {/* details column */}
            <div data-testid="mycard-fields" className="flex-1 min-w-0 flex flex-col gap-2.5">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--faint)' }}>
                Your details
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  ['name', 'Full name', 'e.g. Rahim Uddin'],
                  ['phone', 'Phone', '+8801…'],
                  ['email', 'Email', 'you@example.com'],
                  ['org', 'Company', 'e.g. BiTsCol'],
                  ['role', 'Role / title', 'e.g. Product Engineer'],
                  ['url', 'Website', 'https://…'],
                  ['address', 'Address', 'e.g. Dhanmondi, Dhaka'],
                  ['birthday', 'Birthday', ''],
                ].map(([k, label, ph]) => (
                  <label key={k} className="block">
                    <span className="label">{label}</span>
                    <input className="input mt-1" data-testid={`mycard-${k}`} value={card[k] || ''} placeholder={ph}
                      type={k === 'birthday' ? 'date' : 'text'}
                      onChange={e => set(k, e.target.value.slice(0, 120))} />
                  </label>
                ))}
                <label className="block sm:col-span-2">
                  <span className="label">Note (lands in the contact's notes field)</span>
                  <textarea className="input mt-1" rows={2} data-testid="mycard-note" value={card.note || ''}
                    placeholder="e.g. Founder — loves single-origin coffee"
                    onChange={e => set('note', e.target.value.slice(0, 200))} />
                </label>
              </div>
              {designOpen && (
                <div className="card p-4">
                  <QrDesigner />
                </div>
              )}
              <div className="flex items-start gap-1.5 text-[11px] leading-snug" style={{ color: 'var(--faint)' }}>
                <ShieldCheck size={13} className="mt-[1px] shrink-0" />
                <span>This QR encodes a standard vCard — any phone camera reads it and saves you as a contact. Nothing leaves this device.</span>
              </div>
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
      <div className="rounded-2xl overflow-hidden grid place-items-center"
        style={{ background: 'rgba(129,140,248,.06)', border: '1px solid var(--line, rgba(148,163,184,.14))', minHeight: 220 }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} playsInline muted style={{ width: '100%', maxHeight: 320, display: live ? 'block' : 'none' }} />
        <canvas ref={canvasRef} className="hidden" />
        {!live && (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <Camera size={28} style={{ color: 'var(--faint)' }} />
            <div className="text-[12px] font-semibold">Point the camera at the other person's card QR</div>
            <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
              Or upload a screenshot — decoded cards land in Import for review
            </div>
          </div>
        )}
      </div>
      {err && <div className="text-[11.5px] font-semibold" style={{ color: '#fbbf24' }}>{err}</div>}
      <div className="flex flex-col sm:flex-row gap-2">
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
