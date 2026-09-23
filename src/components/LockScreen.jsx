import { useState, useRef, useEffect } from 'react'
import { Lock, Unlock, ShieldCheck, Trash2, Loader2, Zap } from 'lucide-react'
import { useCrm } from '../store'

/* Full-screen gate shown before the app:
 *   mode 'setup'  — first launch: offer a pin (option + skip link)
 *   mode 'unlock' — subsequent loads: require the pin for this session
 */
export default function LockScreen({ mode }) {
  const { setupPin, skipPinSetup, unlockWithPin, factoryReset } = useCrm()
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [mode])

  const PinField = ({ value, set, label, innerRef, onEnter }) => (
    <label className="block">
      <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{label}</span>
      <input
        ref={innerRef}
        className="input mt-1.5 text-center"
        style={{ fontSize: 22, letterSpacing: 10, fontFamily: 'monospace', padding: '12px 14px' }}
        type="password" inputMode="numeric" autoComplete="off" maxLength={6}
        placeholder="••••"
        value={value}
        onChange={e => { set(e.target.value.replace(/\D/g, '')); setErr('') }}
        onKeyDown={e => { if (e.key === 'Enter') onEnter?.() }}
      />
    </label>
  )

  const doSetup = async () => {
    if (pin.length < 4) return setErr('At least 4 digits')
    if (pin !== pin2) return setErr('The two pincodes do not match')
    setBusy(true)
    await setupPin(pin)
    setBusy(false)
  }

  const doUnlock = async () => {
    if (!pin) return
    setBusy(true)
    const okPin = await unlockWithPin(pin)
    setBusy(false)
    if (!okPin) { setAttempts(a => a + 1); setErr('Wrong pincode'); setPin(''); ref.current?.focus() }
  }

  const doForgot = () => {
    if (!confirm('Forgot pincode?\n\nThe ONLY way back in is wiping this app — ALL contacts, tasks, notes, events and settings are erased. Continue?')) return
    if (!confirm('Really erase everything and start blank? This cannot be undone.')) return
    /* bypasses verify (you forgot it) — wipe local state and reload */
    try { localStorage.clear() } catch {}
    location.reload()
  }

  return (
    <div className="h-screen w-full grid place-items-center p-4" style={{ background: 'linear-gradient(160deg, var(--bg), var(--cardbg2))' }}>
      <div className="card w-[360px] p-7 fadein" style={{ borderRadius: 20 }}>
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-2xl grid place-items-center mb-3"
            style={{ background: 'linear-gradient(140deg,#6366f1,#2dd4bf)', color: '#0b0e17' }}>
            <Zap size={26} />
          </div>
          <h1 className="text-[18px] font-extrabold">Personal CRM</h1>
          <p className="text-[12.5px] mt-1 leading-snug" style={{ color: 'var(--muted)' }}>
            {mode === 'setup'
              ? 'Set a 4–6 digit pincode. Every start on this device will ask for it.'
              : 'This app is locked. Enter your pincode to continue.'}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {mode === 'setup' ? (
            <>
              <PinField value={pin} set={setPin} label="Choose pincode" innerRef={ref} />
              <PinField value={pin2} set={setPin2} label="Repeat pincode" onEnter={doSetup} />
            </>
          ) : (
            <PinField value={pin} set={setPin} label="Pincode" innerRef={ref} onEnter={doUnlock} />
          )}

          {!!err && (
            <div className="text-[12.5px] font-semibold text-center" style={{ color: '#f87171' }}>
              {err}{mode === 'unlock' && attempts >= 2 ? ` · ${attempts} failed attempts` : ''}
            </div>
          )}

          <button
            className="btn btn-primary w-full mt-1 justify-center"
            disabled={busy || (mode === 'setup' ? pin.length < 4 || pin2.length < 4 : pin.length < 4)}
            onClick={mode === 'setup' ? doSetup : doUnlock}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : mode === 'setup' ? <ShieldCheck size={15} /> : <Unlock size={15} />}
            {mode === 'setup' ? 'Set pincode & start' : 'Unlock'}
          </button>

          {mode === 'setup' ? (
            <button className="text-[12px] font-semibold text-center hover:underline" style={{ color: 'var(--faint)' }} onClick={skipPinSetup}>
              Skip for now — set it later in Settings
            </button>
          ) : (
            <button className="text-[11.5px] font-semibold text-center inline-flex items-center gap-1 justify-center mt-1"
              style={{ color: '#f8717188' }} onClick={doForgot}>
              <Trash2 size={12} /> Forgot pincode? Wipe app & start blank
            </button>
          )}
        </div>

        <p className="text-[10.5px] text-center mt-5 leading-snug" style={{ color: 'var(--faint)' }}>
          <Lock size={10} className="inline -mt-[2px] mr-1" />
          Locks this app's screen on this device only. Your data lives on-device — for deeper secrecy, keep the device itself locked.
        </p>
      </div>
    </div>
  )
}
