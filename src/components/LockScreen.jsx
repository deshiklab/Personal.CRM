import { useState, useRef, useEffect } from 'react'
import { Lock, Unlock, ShieldCheck, Trash2, Loader2, Zap, Timer } from 'lucide-react'
import { useCrm } from '../store'

/* Full-screen gate shown before the app:
 *   mode 'setup'  — first launch: offer a pin (option + skip link)
 *   mode 'unlock' — subsequent loads: require the pin for this session
 */
/* Hoisted to module scope ON PURPOSE: a component defined inside another
 * component gets a new identity on every render, so React remounts the <input>
 * on each keystroke and the field loses focus — that is why every digit needed
 * another tap. Keep this outside the component body. */
function PinField({ value, set, label, innerRef, onEnter, onError = () => {}, nextRef, disabled = false }) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{label}</span>
      <input
        ref={innerRef}
        className="input mt-1.5 text-center"
        style={{ fontSize: 22, letterSpacing: 10, fontFamily: 'monospace', padding: '12px 14px' }}
        type="password" inputMode="numeric" autoComplete="off" maxLength={6}
        placeholder="••••" disabled={disabled}
        value={value}
        onChange={e => {
          const v = e.target.value.replace(/\D/g, '')
          set(v)
          onError('')
          /* once a full-length pin is typed, hop to the next field so the
             on-screen keyboard stays put instead of needing a second tap */
          if (nextRef && v.length >= 4) nextRef.current?.focus()
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') onEnter?.()
          if (e.key === 'Backspace' && !value && nextRef === undefined) e.preventDefault()
        }}
      />
    </label>
  )
}

export default function LockScreen({ mode }) {
  const { setupPin, skipPinSetup, unlockWithPin, factoryReset, pinStatus } = useCrm()
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const ref = useRef(null)
  const ref2 = useRef(null)
  useEffect(() => { ref.current?.focus() }, [mode])

  /* live countdown while a lockout is running */
  const [now, setNow] = useState(Date.now())
  const st = pinStatus ? pinStatus() : { locked: false, msLeft: 0, fails: 0, attemptsLeft: 4 }
  useEffect(() => {
    if (!st.locked) return
    const iv = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(iv)
  }, [st.locked])
  const secsLeft = st.locked ? Math.max(1, Math.ceil((st.until - now) / 1000)) : 0

  const doSetup = async () => {
    if (pin.length < 4) return setErr('At least 4 digits')
    if (pin !== pin2) return setErr('The two pincodes do not match')
    setBusy(true)
    await setupPin(pin)
    setBusy(false)
  }

  const doUnlock = async () => {
    if (!pin || st.locked) return
    setBusy(true)
    const okPin = await unlockWithPin(pin)
    setBusy(false)
    if (!okPin) {
      setAttempts(a => a + 1); setPin('')
      const after = pinStatus ? pinStatus() : { locked: false, attemptsLeft: 0 }
      setErr(!after.locked && after.attemptsLeft > 0
        ? `Wrong pincode — ${after.attemptsLeft} attempt${after.attemptsLeft === 1 ? '' : 's'} left before a lockout`
        : 'Wrong pincode')
      ref.current?.focus()
    }
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
      <div className="card w-full max-w-[360px] p-6 sm:p-7 fadein" style={{ borderRadius: 20 }}>
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
              <PinField value={pin} set={setPin} label="Choose pincode" innerRef={ref} nextRef={ref2} onError={setErr} />
              <PinField value={pin2} set={setPin2} label="Repeat pincode" innerRef={ref2} onEnter={doSetup} onError={setErr} />
            </>
          ) : (
            <PinField value={pin} set={setPin} label="Pincode" innerRef={ref} onEnter={doUnlock} onError={setErr} disabled={st.locked} />
          )}

          {!!err && (
            <div className="text-[12.5px] font-semibold text-center" style={{ color: '#f87171' }}>
              {err}{mode === 'unlock' && attempts >= 2 ? ` · ${attempts} failed attempts` : ''}
            </div>
          )}

          {mode === 'unlock' && st.locked && (
            <div className="flex items-start gap-2 rounded-xl p-3 mb-1"
              style={{ background: 'rgba(251,113,133,.10)', border: '1px solid rgba(251,113,133,.32)' }}>
              <Timer size={15} className="flex-none mt-0.5" style={{ color: '#fb7185' }} />
              <div className="text-[12.5px] leading-snug">
                <b style={{ color: '#fb7185' }}>Too many wrong pincodes.</b>{' '}
                <span style={{ color: 'var(--muted)' }}>
                  Try again in {secsLeft}s. Waiting gets longer with each wrong guess — that is what keeps a
                  4-digit pincode from being guessed by a machine.
                </span>
              </div>
            </div>
          )}

          <button
            className="btn btn-primary w-full mt-1 justify-center"
            disabled={busy || st.locked || (mode === 'setup' ? pin.length < 4 || pin2.length < 4 : pin.length < 4)}
            onClick={mode === 'setup' ? doSetup : doUnlock}>
            {mode === 'unlock' && st.locked ? <Timer size={15} /> : null}
            {busy ? <Loader2 size={15} className="animate-spin" /> : mode === 'setup' ? <ShieldCheck size={15} /> : <Unlock size={15} />}
            {mode === 'setup' ? 'Set pincode & start' : 'Unlock'}
          </button>

          {mode === 'setup' ? (
            <button className="text-[12px] font-semibold text-center hover:underline py-2.5 sm:py-0" style={{ color: 'var(--faint)' }} onClick={skipPinSetup}>
              Skip for now — set it later in Settings
            </button>
          ) : (
            <button className="text-[11.5px] font-semibold text-center inline-flex items-center gap-1 justify-center mt-1 py-2.5 sm:py-1 w-full sm:w-auto"
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
