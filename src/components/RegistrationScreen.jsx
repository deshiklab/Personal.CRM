import { useState, useRef, useEffect } from 'react'
import { Zap, UserRound, Mail, Phone, ArrowRight, ShieldCheck } from 'lucide-react'
import { useCrm } from '../store'
import { notifyConfigured } from '../lib/notify'
import { BRAND } from '../brand'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/* First-launch registration window. Everything entered here stays on this
 * device; the optional checkbox below is the ONLY thing that ever leaves it. */
export default function RegistrationScreen() {
  const { registerProfile, skipRegistration, toast } = useCrm()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [share, setShare] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])

  const submit = async () => {
    const n = name.trim()
    const e = email.trim().toLowerCase()
    const m = mobile.trim()
    if (n.length < 2) return setErr('Please enter your name (at least 2 characters)')
    if (!EMAIL_RE.test(e)) return setErr('Please enter a valid email address')
    if (m && m.replace(/\D/g, '').length < 7) return setErr('Enter a full mobile number, or leave it empty')
    setErr(''); setBusy(true)
    await registerProfile({ name: n, email: e, mobile: m, notify: share })
    setBusy(false)
  }

  return (
    <div className="h-screen w-full grid place-items-center p-4"
      style={{ background: 'linear-gradient(160deg, var(--bg), var(--cardbg2))' }}>
      <div className="card w-full max-w-[400px] p-6 sm:p-7 fadein" style={{ borderRadius: 20 }}>
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-2xl grid place-items-center mb-3"
            style={{ background: 'linear-gradient(140deg,#6366f1,#2dd4bf)', color: '#0b0e17' }}>
            <Zap size={26} />
          </div>
          <h1 className="text-[18px] font-extrabold text-center px-2 break-any">Welcome to {BRAND.app}</h1>
          <p className="text-[12.5px] mt-1 leading-snug" style={{ color: 'var(--muted)' }}>
            Tell us who you are so the app can greet you properly. Your details are stored on this device.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
              Your name *
            </span>
            <div className="relative mt-1.5">
              <UserRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
              <input ref={ref} className="input" style={{ paddingLeft: 38 }} value={name} onChange={e => { setName(e.target.value); setErr('') }}
                onKeyDown={e => e.key === 'Enter' && submit()} placeholder="e.g. BiTsCol" autoComplete="name" />
            </div>
          </label>

          <label className="block">
            <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
              Email *
            </span>
            <div className="relative mt-1.5">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
              <input className="input" type="email" style={{ paddingLeft: 38 }} value={email} onChange={e => { setEmail(e.target.value); setErr('') }}
                onKeyDown={e => e.key === 'Enter' && submit()} placeholder="you@example.com" autoComplete="email" />
            </div>
          </label>

          <label className="block">
            <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
              Mobile <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional, for verification)</span>
            </span>
            <div className="relative mt-1.5">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
              <input className="input" type="tel" style={{ paddingLeft: 38 }} value={mobile} onChange={e => { setMobile(e.target.value); setErr('') }}
                onKeyDown={e => e.key === 'Enter' && submit()} placeholder="+880 1XXX-XXXXXX" autoComplete="tel" />
            </div>
          </label>

          {!!err && <div className="text-[12.5px] font-semibold text-center" style={{ color: '#f87171' }}>{err}</div>}

          <label className="flex items-start gap-2.5 mt-1 cursor-pointer">
            <input type="checkbox" checked={share} onChange={e => setShare(e.target.checked)}
              style={{ marginTop: 3, width: 15, height: 15, accentColor: 'var(--i1)', flex: 'none' }} />
            <span className="text-[11.5px] leading-snug" style={{ color: 'var(--muted)' }}>
              Also send my name and email to <b style={{ color: 'var(--text)' }}>{BRAND.publisher}</b> at{' '}
              <b style={{ color: 'var(--text)' }}>{BRAND.email}</b> so they can register my copy and help if I lose access.
              {!notifyConfigured() && <i> (not yet configured — nothing will be sent)</i>}
            </span>
          </label>

          <button className="btn btn-primary w-full mt-1 justify-center" disabled={busy || !name.trim() || !email.trim()}
            onClick={submit}>
            {busy ? 'Setting up…' : <><ArrowRight size={15} /> Continue</>}
          </button>

          <button className="text-[12px] font-semibold text-center hover:underline" style={{ color: 'var(--faint)' }}
            onClick={() => { skipRegistration(); toast('Skipped — you can register anytime from Settings → Identity', 'warn') }}>
            Skip for now — register later in Settings
          </button>
        </div>

        <p className="text-[10.5px] text-center mt-5 leading-snug" style={{ color: 'var(--faint)' }}>
          <ShieldCheck size={10} className="inline -mt-[2px] mr-1" />
          {BRAND.app} has no server and no account. These details are saved on this device only and are used for your
          greeting, verification and support.
        </p>
      </div>
    </div>
  )
}
