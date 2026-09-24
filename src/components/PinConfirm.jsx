import { useEffect, useRef, useState } from 'react'
import { KeyRound, Trash2 } from 'lucide-react'
import { useCrm } from '../store'
import { Modal } from './ui'

/* Destructive-action gate.
 * If a pincode is set on this device, the action cannot proceed without it —
 * the PIN is verified locally against its salted hash (never stored anywhere).
 * With no pincode set it degrades to a plain "Cancel / Confirm" prompt. */
export default function PinConfirm({
  open, onClose, onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  icon: Icon = Trash2,
}) {
  const { lock, verifyPin } = useCrm()
  const needPin = !!lock?.hash
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    setPin(''); setErr(''); setBusy(false)
    const t = setTimeout(() => ref.current?.focus(), 90)
    return () => clearTimeout(t)
  }, [open])

  const submit = async () => {
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      if (needPin) {
        const ok = await verifyPin(pin)
        if (!ok) {
          setErr('Wrong pincode — nothing was changed')
          setPin('')
          ref.current?.focus()
          return
        }
      }
      await onConfirm?.()
      onClose?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex gap-3 items-start">
        <div className="w-10 h-10 rounded-xl grid place-items-center flex-none"
          style={{ background: '#fb71851f', color: 'var(--t-rose)' }}>
          <Icon size={18} />
        </div>
        <div className="text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>{message}</div>
      </div>

      {needPin && (
        <div className="mt-4">
          <div className="label">Enter your pincode to confirm</div>
          <input
            ref={ref}
            className="input"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            placeholder="••••"
            aria-label="Pincode"
            value={pin}
            onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setErr('') }}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            style={{ letterSpacing: 10, fontSize: 20, textAlign: 'center', maxWidth: 210 }}
          />
          <div className="text-[11px] mt-1.5" style={{ color: 'var(--faint)' }}>
            The same pincode you unlock the app with — checked on this device only.
          </div>
        </div>
      )}

      {err && <div className="text-[12.5px] font-semibold mt-3" style={{ color: 'var(--t-rose)' }}>{err}</div>}

      <div className="flex justify-end gap-2 mt-6">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" disabled={busy || (needPin && pin.length < 4)} onClick={submit}>
          {needPin && <KeyRound size={14} />} {busy ? 'Checking…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
