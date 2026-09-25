import { useState, useRef, useEffect } from 'react'
import {
  Zap, UserRound, Mail, Phone, ArrowRight, ShieldCheck, Upload, Cloud,
  CloudUpload, Sparkles, Lock, Loader2, ChevronLeft, HardDrive, KeyRound,
} from 'lucide-react'
import { useCrm } from '../store'
import { notifyConfigured } from '../lib/notify'
import { BRAND } from '../brand'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/* First-launch welcome. Identity is optional-later; setup paths let a returning
 * user restore or connect before they ever see the sample CRM. */
export default function RegistrationScreen() {
  const {
    registerProfile, skipRegistration, toast,
    restoreBackupFile, saveGoogleClientId, connectGoogleLive, saveGistToken, syncNow,
    clearDemoData,
  } = useCrm()

  /* panel: home | register | restore | google | gist */
  const [panel, setPanel] = useState('home')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [share, setShare] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  /* restore */
  const [pendingFile, setPendingFile] = useState(null)
  const [pass, setPass] = useState('')
  const fileRef = useRef(null)

  /* google */
  const [cid, setCid] = useState('')

  /* gist */
  const [tok, setTok] = useState('')

  const ref = useRef(null)
  useEffect(() => {
    if (panel === 'register') ref.current?.focus()
  }, [panel])

  const finishAsFresh = async () => {
    /* no identity yet — skip registration so App unlocks the pin gate */
    skipRegistration()
    toast('Welcome — sample data is loaded so you can explore', 'ok')
  }

  const submitRegister = async () => {
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

  const onPickFile = f => {
    if (!f) return
    const r = new FileReader()
    r.onload = async () => {
      let parsed
      try { parsed = JSON.parse(r.result) } catch { toast('Could not parse that backup file', 'warn'); return }
      if (parsed?.format === 'pcrm-enc-v1') {
        setPendingFile(parsed)
        setPass('')
        return
      }
      setBusy(true)
      const ok = await restoreBackupFile(parsed)
      setBusy(false)
      /* restoreAll always sets a profile (real or skipped) so the welcome gate lifts */
      if (!ok) toast('Could not restore that backup', 'warn')

    }
    r.readAsText(f)
  }

  const okEncImport = async () => {
    if (!pendingFile) return
    if (!pass || pass.length < 4) return toast('Enter the passphrase (at least 4 characters)', 'warn')
    setBusy(true)
    const ok = await restoreBackupFile(pendingFile, pass)
    setBusy(false)
    if (ok) setPendingFile(null)
    else toast('Wrong passphrase or corrupt file', 'warn')

  }

  const doGoogle = async () => {
    const id = cid.trim()
    if (!id) return toast('Paste your Google OAuth Client ID first', 'warn')
    setBusy(true)
    saveGoogleClientId(id)
    const ok = await connectGoogleLive()
    setBusy(false)
    if (ok) {
      toast('Google connected — finish identity next, or skip')
      setPanel('register')
    }
  }

  const doGist = async () => {
    const t = tok.trim()
    if (t.length < 20) return toast('Paste a GitHub personal access token with the gist scope', 'warn')
    setBusy(true)
    /* never push sample people into a brand-new gist — start empty, then pull */
    clearDemoData()
    const ok = await saveGistToken(t)
    if (ok) {
      await syncNow({ manual: true })
      skipRegistration()
    }
    setBusy(false)
  }

  const Shell = ({ title, sub, children, back }) => (
    <div className="h-screen w-full grid place-items-center p-4"
      style={{ background: 'linear-gradient(160deg, var(--bg), var(--cardbg2))' }}>
      <div className="card w-full max-w-[440px] p-6 sm:p-7 fadein" style={{ borderRadius: 20 }}>
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-2xl grid place-items-center mb-3"
            style={{ background: 'linear-gradient(140deg,#6366f1,#2dd4bf)', color: '#0b0e17' }}>
            <Zap size={26} />
          </div>
          <h1 className="text-[18px] font-extrabold text-center px-2 break-any">{title}</h1>
          {sub && (
            <p className="text-[12.5px] mt-1 leading-snug" style={{ color: 'var(--muted)' }}>{sub}</p>
          )}
        </div>
        {children}
        {back && (
          <button type="button" className="flex items-center justify-center gap-1.5 w-full mt-4 text-[12px] font-semibold hover:underline"
            style={{ color: 'var(--faint)' }} onClick={back} disabled={busy}>
            <ChevronLeft size={13} /> Back
          </button>
        )}
        <p className="text-[10.5px] text-center mt-5 leading-snug" style={{ color: 'var(--faint)' }}>
          <ShieldCheck size={10} className="inline -mt-[2px] mr-1" />
          {BRAND.app} has no server and no account. Everything stays on this device unless you connect a backend you control.
        </p>
      </div>
    </div>
  )

  /* ── HOME ── */
  if (panel === 'home') {
    const opts = [
      {
        id: 'fresh', icon: Sparkles, color: '#a78bfa',
        title: 'I’m new — start fresh',
        body: 'Explore with sample people, then keep or wipe them after the tour.',
        onClick: () => setPanel('register'),
        primary: true,
      },
      {
        id: 'restore', icon: HardDrive, color: '#38bdf8',
        title: 'Restore a backup',
        body: 'Plain .json or encrypted .pcrm.json from another install.',
        onClick: () => setPanel('restore'),
      },
      {
        id: 'google', icon: Cloud, color: '#34d399',
        title: 'Connect with Google',
        body: 'Your OAuth Client ID → Calendar, Contacts & Drive backup.',
        onClick: () => setPanel('google'),
      },
      {
        id: 'gist', icon: CloudUpload, color: '#f472b6',
        title: 'Multi-device sync via GitHub Gist',
        body: 'One private gist keeps phone, PWA and browser in sync.',
        onClick: () => setPanel('gist'),
      },
    ]
    return (
      <Shell
        title={`Welcome to ${BRAND.app}`}
        sub="Brand-new device? Pick how you want to begin. Nothing leaves this phone unless you choose a sync path."
      >
        <div className="flex flex-col gap-2.5">
          {opts.map(o => {
            const Icon = o.icon
            return (
              <button key={o.id} type="button"
                className="text-left rounded-2xl p-3.5 flex gap-3 items-start transition-transform active:scale-[.99]"
                style={{
                  background: o.primary ? 'linear-gradient(135deg, rgba(99,102,241,.18), rgba(45,212,191,.10))' : 'var(--cardbg2)',
                  border: `1px solid ${o.primary ? 'rgba(129,140,248,.45)' : 'var(--border)'}`,
                }}
                onClick={o.onClick}>
                <div className="w-10 h-10 rounded-xl grid place-items-center flex-none"
                  style={{ background: `${o.color}22`, color: o.color }}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-extrabold leading-snug">{o.title}</div>
                  <div className="text-[11.5px] mt-0.5 leading-snug" style={{ color: 'var(--muted)' }}>{o.body}</div>
                </div>
                <ArrowRight size={14} className="flex-none mt-2.5" style={{ color: 'var(--faint)' }} />
              </button>
            )
          })}
        </div>
        <button type="button" className="text-[12px] font-semibold text-center hover:underline w-full mt-4"
          style={{ color: 'var(--faint)' }}
          onClick={finishAsFresh}>
          Skip setup — open with sample data
        </button>
      </Shell>
    )
  }

  /* ── REGISTER (identity after "I'm new") ── */
  if (panel === 'register') {
    return (
      <Shell
        title="Who should we greet?"
        sub="Stored on this device only. You can skip and fill this in later under Settings → Identity."
        back={() => setPanel('home')}
      >
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
              Your name *
            </span>
            <div className="relative mt-1.5">
              <UserRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
              <input ref={ref} className="input" style={{ paddingLeft: 38 }} value={name}
                onChange={e => { setName(e.target.value); setErr('') }}
                onKeyDown={e => e.key === 'Enter' && submitRegister()} placeholder="e.g. BiTsCol" autoComplete="name" />
            </div>
          </label>

          <label className="block">
            <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
              Email *
            </span>
            <div className="relative mt-1.5">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
              <input className="input" type="email" style={{ paddingLeft: 38 }} value={email}
                onChange={e => { setEmail(e.target.value); setErr('') }}
                onKeyDown={e => e.key === 'Enter' && submitRegister()} placeholder="you@example.com" autoComplete="email" />
            </div>
          </label>

          <label className="block">
            <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
              Mobile <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </span>
            <div className="relative mt-1.5">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
              <input className="input" type="tel" style={{ paddingLeft: 38 }} value={mobile}
                onChange={e => { setMobile(e.target.value); setErr('') }}
                onKeyDown={e => e.key === 'Enter' && submitRegister()} placeholder="+880 1XXX-XXXXXX" autoComplete="tel" />
            </div>
          </label>

          {!!err && <div className="text-[12.5px] font-semibold text-center" style={{ color: 'var(--t-red)' }}>{err}</div>}

          <label className="flex items-start gap-2.5 mt-1 cursor-pointer">
            <input type="checkbox" checked={share} onChange={e => setShare(e.target.checked)}
              style={{ marginTop: 3, width: 15, height: 15, accentColor: 'var(--i1)', flex: 'none' }} />
            <span className="text-[11.5px] leading-snug" style={{ color: 'var(--muted)' }}>
              Also send my name and email to <b style={{ color: 'var(--text)' }}>{BRAND.publisher}</b> at{' '}
              <b style={{ color: 'var(--text)' }}>{BRAND.email}</b> so they can register my copy.
              {!notifyConfigured() && <i> (not yet configured — nothing will be sent)</i>}
            </span>
          </label>

          <button className="btn btn-primary w-full mt-1 justify-center" disabled={busy || !name.trim() || !email.trim()}
            onClick={submitRegister}>
            {busy ? 'Setting up…' : <><ArrowRight size={15} /> Continue with sample data</>}
          </button>

          <button type="button" className="text-[12px] font-semibold text-center hover:underline"
            style={{ color: 'var(--faint)' }}
            onClick={finishAsFresh}>
            Skip identity — explore first
          </button>
        </div>
      </Shell>
    )
  }

  /* ── RESTORE ── */
  if (panel === 'restore') {
    return (
      <Shell
        title="Restore a backup"
        sub="Works offline. Encrypted files need the passphrase you set when exporting."
        back={() => { setPendingFile(null); setPass(''); setPanel('home') }}
      >
        {!pendingFile ? (
          <div className="flex flex-col gap-3">
            <button type="button" className="btn btn-primary w-full justify-center"
              disabled={busy}
              onClick={() => fileRef.current?.click()}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              Choose backup file…
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json,.pcrm.json" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.target.value = '' }} />
            <p className="text-[11.5px] leading-snug text-center" style={{ color: 'var(--muted)' }}>
              Accepts plain <span className="font-mono text-[11px]">.json</span> and encrypted{' '}
              <span className="font-mono text-[11px]">.pcrm.json</span> (AES-GCM).
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
              This file is encrypted. Enter the passphrase (or app pincode) used when it was exported.
              {pendingFile?.hint ? <> Hint: <b style={{ color: 'var(--text)' }}>{pendingFile.hint}</b></> : null}
            </p>
            <div>
              <div className="text-[11.5px] font-semibold mb-1" style={{ color: 'var(--faint)' }}>Passphrase</div>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
                <input className="input" type="password" autoComplete="off" style={{ paddingLeft: 38 }}
                  value={pass} onChange={e => setPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && okEncImport()}
                  placeholder="Passphrase or pincode" />
              </div>
            </div>
            <button type="button" className="btn btn-primary w-full justify-center" disabled={busy || !pass}
              onClick={okEncImport}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Decrypt & restore
            </button>
          </div>
        )}
      </Shell>
    )
  }

  /* ── GOOGLE ── */
  if (panel === 'google') {
    return (
      <Shell
        title="Connect with Google"
        sub="Bring your own OAuth Client ID (Web). Tokens stay in memory — never stored with your CRM data."
        back={() => setPanel('home')}
      >
        <div className="flex flex-col gap-3">
          <ol className="text-[12px] leading-relaxed space-y-1.5 pl-4 list-decimal" style={{ color: 'var(--muted)' }}>
            <li>Open <b style={{ color: 'var(--text)' }}>console.cloud.google.com</b> → APIs &amp; Services → Credentials</li>
            <li>Create a <b style={{ color: 'var(--text)' }}>Web application</b> OAuth client</li>
            <li>Add this origin under Authorized JavaScript origins</li>
            <li>Enable Calendar, People and Drive APIs</li>
          </ol>
          <div>
            <div className="text-[11.5px] font-semibold mb-1" style={{ color: 'var(--faint)' }}>OAuth Client ID</div>
            <input className="input font-mono text-[12px]" value={cid} onChange={e => setCid(e.target.value)}
              placeholder="xxxx.apps.googleusercontent.com" autoComplete="off" />
          </div>
          <button type="button" className="btn btn-primary w-full justify-center" disabled={busy || !cid.trim()}
            onClick={doGoogle}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Cloud size={15} />} Save &amp; connect
          </button>
          <p className="text-[11px] leading-snug" style={{ color: 'var(--faint)' }}>
            After connecting you can set your name, then use Settings → Google hub for Contacts / Calendar / Drive.
          </p>
        </div>
      </Shell>
    )
  }

  /* ── GIST ── */
  if (panel === 'gist') {
    return (
      <Shell
        title="Multi-device sync via GitHub Gist"
        sub="No Google needed. A private gist on your account carries the CRM between devices."
        back={() => setPanel('home')}
      >
        <div className="flex flex-col gap-3">
          <ol className="text-[12px] leading-relaxed space-y-1.5 pl-4 list-decimal" style={{ color: 'var(--muted)' }}>
            <li>GitHub → Settings → Developer settings → Personal access tokens</li>
            <li>Generate a token (classic or fine-grained with gist write)</li>
            <li>Note: <b style={{ color: 'var(--text)' }}>personal-crm-sync</b> · tick ONLY the <b style={{ color: 'var(--text)' }}>gist</b> scope</li>
            <li>Paste it below — we pull any existing sync file automatically</li>
          </ol>
          <div>
            <div className="text-[11.5px] font-semibold mb-1" style={{ color: 'var(--faint)' }}>GitHub token (gist scope)</div>
            <input className="input font-mono text-[12px]" type="password" value={tok}
              onChange={e => setTok(e.target.value)} placeholder="ghp_…" autoComplete="off" />
          </div>
          <button type="button" className="btn btn-primary w-full justify-center" disabled={busy || tok.trim().length < 20}
            onClick={doGist}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <CloudUpload size={15} />} Save &amp; sync
          </button>
          <p className="text-[11px] leading-snug" style={{ color: 'var(--faint)' }}>
            The token is kept in its own storage slot — never inside backups or exports.
          </p>
        </div>
      </Shell>
    )
  }

  return null
}
