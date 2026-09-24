/* Visiting-card scan → confirm → save as a new contact (or apply to an existing one). */
import { useEffect, useRef, useState } from 'react'
import {
  ScanLine, Camera, ImagePlus, Loader2, Check, X, RotateCcw, UserPlus, Sparkles,
} from 'lucide-react'
import { Modal, Field, Avatar } from './ui'
import { scanVisitingCard, disposeScanner, onScanProgress } from '../lib/cardscan'
import { compressImage, pickImage } from '../lib/media'
import { useCrm } from '../store'

const blankDraft = () => ({
  name: '', role: '', company: '', phone: '', email: '', website: '', address: '',
})

export default function CardScanModal({ open, onClose, contact = null }) {
  /* contact=null → create new; contact set → fill missing fields on that person */
  const { addContact, updateContact, toast, groups } = useCrm()
  const [step, setStep] = useState('pick')          // pick | scanning | review
  const [preview, setPreview] = useState(null)      // compressed data-URL of the card
  const [draft, setDraft] = useState(blankDraft())
  const [progress, setProgress] = useState({ status: '', progress: 0 })
  const [err, setErr] = useState('')
  const busy = useRef(false)

  useEffect(() => {
    if (!open) {
      setStep('pick'); setPreview(null); setDraft(blankDraft()); setErr(''); setProgress({ status: '', progress: 0 })
      busy.current = false
      return
    }
    const off = onScanProgress(setProgress)
    return () => { off(); /* keep worker warm across opens */ }
  }, [open])

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))

  const runScan = async file => {
    if (!file || busy.current) return
    busy.current = true
    setErr('')
    setStep('scanning')
    try {
      const { dataUrl } = await compressImage(file, { maxEdge: 1600, quality: 0.85 })
      setPreview(dataUrl)
      const result = await scanVisitingCard(dataUrl)
      setDraft({
        name: result.name || '',
        role: result.role || '',
        company: result.company || '',
        phone: result.phone || '',
        email: result.email || '',
        website: result.website || '',
        address: result.address || '',
      })
      setStep('review')
    } catch (e) {
      console.error(e)
      setErr(String(e?.message || e))
      setStep('pick')
    } finally {
      busy.current = false
    }
  }

  const pick = async capture => {
    try {
      const file = await pickImage({ accept: 'image/*', capture: capture || undefined })
      await runScan(file)
    } catch { /* cancelled */ }
  }

  const onDrop = async e => {
    e.preventDefault()
    const f = e.dataTransfer?.files?.[0]
    if (f && /^image\//.test(f.type)) await runScan(f)
  }

  const save = () => {
    const name = draft.name.trim()
    if (!name) { setErr('A name is required — type what the card says if the scan missed it.'); return }
    const payload = {
      name,
      role: draft.role.trim(),
      company: draft.company.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim().toLowerCase(),
      cardImage: preview || null,
      socials: draft.website.trim()
        ? { website: draft.website.trim() }
        : undefined,
    }
    /* stash the address as a note-ish field on giftIdeas only if empty — better: put in a dedicated field.
       We keep address on the contact as `address` (new optional field). */
    if (draft.address.trim()) payload.address = draft.address.trim()

    if (contact) {
      /* fill blanks only — never clobber what the user already typed */
      const patch = { cardImage: preview || contact.cardImage || null }
      ;['role', 'company', 'phone', 'email', 'address'].forEach(k => {
        if (!contact[k] && payload[k]) patch[k] = payload[k]
      })
      if (payload.socials?.website && !(contact.socials || {}).website) {
        patch.socials = { ...(contact.socials || {}), website: payload.socials.website }
      }
      if (!contact.name && name) patch.name = name
      updateContact(contact.id, patch)
      toast(`📇 Card saved on ${contact.name || name}`)
    } else {
      addContact({
        ...payload,
        groupIds: groups[0] ? [groups[0].id] : [],
        rel: 'acquaintance',
        source: 'visiting-card',
      })
      toast(`📇 Added ${name.split(' ')[0]} from a visiting card`)
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={() => { disposeScanner(); onClose() }}
      title={contact ? `Scan a card for ${contact.name}` : 'Scan visiting card'} wide>
      {step === 'pick' && (
        <div
          className="rounded-2xl p-6 sm:p-8 text-center"
          style={{ border: '1.5px dashed var(--border)', background: 'var(--cardbg2)' }}
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}>
          <div className="w-14 h-14 rounded-2xl grid place-items-center mx-auto mb-3"
            style={{ background: 'linear-gradient(140deg,var(--i1),var(--i2))', color: '#0b0e17' }}>
            <ScanLine size={26} />
          </div>
          <div className="text-[15px] font-bold tracking-tight">Snap or drop a visiting card</div>
          <p className="text-[12.5px] mt-1.5 leading-relaxed max-w-[420px] mx-auto" style={{ color: 'var(--muted)' }}>
            The scan runs entirely on this device — nothing is uploaded. You will review every field before it is saved.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button type="button" className="btn btn-primary" onClick={() => pick('environment')}>
              <Camera size={15} /> Take photo
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => pick()}>
              <ImagePlus size={15} /> Choose image
            </button>
          </div>
          {err && <div className="mt-4 text-[12.5px] font-semibold" style={{ color: 'var(--t-red)' }}>{err}</div>}
          <div className="mt-5 text-[11px] leading-snug" style={{ color: 'var(--faint)' }}>
            Tip: lay the card flat under even light. A sharp, upright photo reads best.
          </div>
        </div>
      )}

      {step === 'scanning' && (
        <div className="py-10 text-center">
          {preview && (
            <img src={preview} alt="Card preview" className="mx-auto mb-4 rounded-xl"
              style={{ maxHeight: 160, maxWidth: '100%', objectFit: 'contain', border: '1px solid var(--border)' }} />
          )}
          <Loader2 size={22} className="mx-auto mb-3 animate-spin" style={{ color: 'var(--t-indigo)' }} />
          <div className="text-[14px] font-semibold">Reading the card…</div>
          <div className="text-[12px] mt-1" style={{ color: 'var(--muted)' }}>
            {progress.status || 'starting'} · {Math.round((progress.progress || 0) * 100)}%
          </div>
          <div className="mx-auto mt-4 h-1.5 rounded-full overflow-hidden" style={{ width: 220, background: 'var(--chipbg)' }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${Math.round((progress.progress || 0) * 100)}%`, background: 'linear-gradient(90deg,var(--i1),var(--i2))' }} />
          </div>
        </div>
      )}

      {step === 'review' && (
        <div>
          <div className="flex items-start gap-3 mb-4 p-3 rounded-xl"
            style={{ background: 'rgba(52,211,153,.08)', border: '1px solid rgba(52,211,153,.28)' }}>
            <Sparkles size={16} className="flex-none mt-0.5" style={{ color: 'var(--t-green)' }} />
            <div className="text-[12.5px] leading-snug" style={{ color: 'var(--muted)' }}>
              <b style={{ color: 'var(--text)' }}>Check every field.</b> OCR guesses — fix anything it got wrong before saving.
              The card image is kept on this contact so you can re-read it later.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4 mb-4">
            <div className="rounded-xl overflow-hidden flex items-center justify-center"
              style={{ background: 'var(--cardbg2)', border: '1px solid var(--border)', minHeight: 120 }}>
              {preview
                ? <img src={preview} alt="Scanned card" style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: 160 }} />
                : <ScanLine size={28} style={{ color: 'var(--faint)' }} />}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Name *"><input className="input" value={draft.name} onChange={e => set('name', e.target.value)} placeholder="Full name" autoFocus /></Field>
              <Field label="Phone"><input className="input" value={draft.phone} onChange={e => set('phone', e.target.value)} placeholder="+880 …" /></Field>
              <Field label="Role"><input className="input" value={draft.role} onChange={e => set('role', e.target.value)} placeholder="e.g. Managing Director" /></Field>
              <Field label="Company"><input className="input" value={draft.company} onChange={e => set('company', e.target.value)} placeholder="e.g. Harbourline Logistics" /></Field>
              <Field label="Email"><input className="input" type="email" value={draft.email} onChange={e => set('email', e.target.value)} placeholder="name@email.com" /></Field>
              <Field label="Website"><input className="input" value={draft.website} onChange={e => set('website', e.target.value)} placeholder="https://…" /></Field>
            </div>
          </div>
          <Field label="Address (optional)">
            <input className="input" value={draft.address} onChange={e => set('address', e.target.value)} placeholder="Street, city" />
          </Field>

          {err && <div className="mt-3 text-[12.5px] font-semibold" style={{ color: 'var(--t-red)' }}>{err}</div>}

          <div className="flex flex-wrap justify-end gap-2 mt-6">
            <button type="button" className="btn btn-ghost" onClick={() => { setStep('pick'); setPreview(null); setDraft(blankDraft()); setErr('') }}>
              <RotateCcw size={14} /> Rescan
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}><X size={14} /> Cancel</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={!draft.name.trim()}>
              {contact
                ? <><Check size={15} /> Save onto contact</>
                : <><UserPlus size={15} /> Add contact</>}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* Tiny presentational preview used in drawers and lists. */
export function CardThumb({ src, size = 56, onClick, title = 'Visiting card' }) {
  if (!src) return null
  return (
    <button type="button" onClick={onClick} title={title}
      className="rounded-lg overflow-hidden flex-none"
      style={{ width: size, height: Math.round(size * 0.64), border: '1px solid var(--border)', background: 'var(--cardbg2)' }}>
      <img src={src} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </button>
  )
}
