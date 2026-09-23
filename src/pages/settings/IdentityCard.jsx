import { useState } from 'react'
import { UserRound, Mail, Phone, ShieldCheck, BadgeCheck, Loader2, LogOut, Send, Check } from 'lucide-react'
import { useCrm } from '../../store'
import { Card, Pill, Modal, Field } from '../../components/ui'
import { notifyConfigured } from '../../lib/notify'
import { BRAND } from '../../brand'
import { tsRel } from '../../lib'
import PinConfirm from '../../components/PinConfirm'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/* One row per contact method: status pill, request-code button, code entry. */
function VerifyRow({ kind, icon: Icon, value, verifiedAt, onRequest, onConfirm }) {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const configured = notifyConfigured()

  const request = async () => {
    setBusy(true); setMsg('')
    const res = await onRequest(kind)
    if (res.ok) setMsg('Code sent — it will reach you by email/SMS shortly. Enter it below.')
    else if (res.reason === 'not-configured') setMsg(`Verification is not switched on yet — email ${BRAND.email} and we will verify you manually.`)
    else if (res.reason === 'missing-' + kind) setMsg(`Add your ${kind} first.`)
    else setMsg('Could not send the code. Check your connection and try again.')
    setBusy(false)
  }
  const confirm = async () => {
    setBusy(true); setMsg('')
    const okd = await onConfirm(kind, code)
    setMsg(okd ? '' : 'That code is wrong or has expired.')
    if (okd) setCode('')
    setBusy(false)
  }

  return (
    <div className="py-3 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,.05)' }}>
      <div className="flex items-center gap-3 flex-wrap">
        <Icon size={15} style={{ color: 'var(--muted)' }} />
        <span className="text-[13px] font-semibold flex-none" style={{ minWidth: 54 }}>
          {kind === 'email' ? 'Email' : 'Mobile'}
        </span>
        <span className="text-[12.5px] flex-1 min-w-0 truncate" style={{ color: 'var(--muted)' }}>{value || '— not set —'}</span>
        {verifiedAt
          ? <Pill color="#34d399"><BadgeCheck size={11} className="inline -mt-[2px] mr-1" />Verified</Pill>
          : <Pill color="#fbbf24">Not verified</Pill>}
      </div>

      {!verifiedAt && value && (
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          <input className="input" style={{ width: 140, padding: '5px 10px', fontSize: 13 }}
            placeholder="6-digit code" inputMode="numeric" maxLength={6} aria-label={`${kind} verification code`}
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && code.length >= 4 && confirm()} />
          <button className="btn btn-ghost btn-sm" onClick={confirm} disabled={busy || code.length < 4}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Confirm code
          </button>
          <button className="btn btn-ghost btn-sm" onClick={request} disabled={busy}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send me a code
          </button>
          {!configured && (
            <span className="text-[11px]" style={{ color: 'var(--faint)' }}>
              automatic delivery is off — contact {BRAND.email}
            </span>
          )}
        </div>
      )}
      {verifiedAt && (
        <div className="text-[11px] mt-1.5" style={{ color: 'var(--faint)' }}>Verified {tsRel(verifiedAt)}</div>
      )}
      {!!msg && <div className="text-[11.5px] mt-2" style={{ color: '#fbbf24' }}>{msg}</div>}
    </div>
  )
}

export default function IdentityCard() {
  const crm = useCrm()
  const { profile, isRegistered, registerProfile, updateProfile, requestVerificationCode,
          confirmVerificationCode, signOutProfile, toast } = crm
  const [editOpen, setEditOpen] = useState(false)
  const [regOpen, setRegOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [f, setF] = useState({ name: '', email: '', mobile: '' })

  const openEdit = () => {
    setF({ name: profile?.name || '', email: profile?.email || '', mobile: profile?.mobile || '' })
    setEditOpen(true)
  }
  const openRegister = () => {
    setF({ name: '', email: '', mobile: '' })
    setRegOpen(true)
  }
  const saveEdit = () => {
    if (f.name.trim().length < 2) return toast('Enter a name', 'warn')
    if (!EMAIL_RE.test(f.email.trim())) return toast('Enter a valid email', 'warn')
    updateProfile({ name: f.name.trim(), email: f.email.trim().toLowerCase(), mobile: f.mobile.trim() })
    toast('Profile updated'); setEditOpen(false)
  }
  const doRegister = async () => {
    if (f.name.trim().length < 2) return toast('Enter a name', 'warn')
    if (!EMAIL_RE.test(f.email.trim())) return toast('Enter a valid email', 'warn')
    setRegOpen(true)
    await registerProfile({ name: f.name.trim(), email: f.email.trim().toLowerCase(), mobile: f.mobile.trim(), notify: true })
    setRegOpen(false)
  }

  const NOTIFIED = {
    sent: ['sent to BITSCOL', '#34d399'],
    declined: ['not shared', '#94a3b8'],
    'not-configured': ['channel not configured', '#fbbf24'],
    'send-failed': ['send failed — will retry on next registration', '#fbbf24'],
    null: ['sending…', '#38bdf8'],
  }
  const note = NOTIFIED[profile?.notified ?? 'declined'] || NOTIFIED.declined

  return (
    <>
      <Card className="p-5 mt-4">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <div className="w-10 h-10 rounded-xl grid place-items-center flex-none"
            style={{ background: isRegistered ? '#34d3991c' : '#94a3b81c', color: isRegistered ? '#34d399' : '#94a3b8' }}>
            <UserRound size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[15px]">Identity</div>
            <div className="text-[11.5px]" style={{ color: 'var(--faint)' }}>
              {isRegistered
                ? 'Stored on this device — used for your greeting, verification and support.'
                : 'Not registered yet. Register to personalise the app and enable verification.'}
            </div>
          </div>
          {isRegistered
            ? <button className="btn btn-ghost btn-sm" onClick={openEdit}>Edit</button>
            : <button className="btn btn-primary btn-sm" onClick={openRegister}>Register</button>}
        </div>

        {isRegistered ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-1">
              <div className="card p-3">
                <div className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Name</div>
                <div className="text-[13.5px] font-semibold truncate">{profile.name}</div>
              </div>
              <div className="card p-3">
                <div className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Email</div>
                <div className="text-[13.5px] font-semibold truncate">{profile.email}</div>
              </div>
              <div className="card p-3">
                <div className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Mobile</div>
                <div className="text-[13.5px] font-semibold truncate">{profile.mobile || '—'}</div>
              </div>
            </div>

            <div className="mt-3">
              <div className="label">Verification</div>
              <VerifyRow kind="email"  icon={Mail}  value={profile.email}  verifiedAt={profile.verified?.email}
                onRequest={requestVerificationCode} onConfirm={confirmVerificationCode} />
              <VerifyRow kind="mobile" icon={Phone} value={profile.mobile} verifiedAt={profile.verified?.mobile}
                onRequest={requestVerificationCode} onConfirm={confirmVerificationCode} />
              <p className="text-[11px] mt-2 leading-snug" style={{ color: 'var(--faint)' }}>
                <ShieldCheck size={10} className="inline -mt-[2px] mr-1" />
                The app generates a one-time code and stores only its hash. The code is delivered to you through{' '}
                {BRAND.publisher}, so entering it proves the address or number is really yours. Verification is
                recorded on this device — there is no central account.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="text-[11.5px]" style={{ color: 'var(--faint)' }}>
                Owner notification: <b style={{ color: note[1] }}>{note[0]}</b>
              </span>
              <div className="flex-1" />
              <button className="btn btn-ghost btn-sm" style={{ color: '#fb7185' }} onClick={() => setSignOutOpen(true)}>
                <LogOut size={13} /> Sign out
              </button>
            </div>
          </>
        ) : (
          <div className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
            Registration takes 20 seconds: your name, email and (optionally) mobile. It stays on this device and lets
            the dashboard greet you by name.
          </div>
        )}
      </Card>

      {/* register / edit */}
      <Modal open={editOpen || regOpen} onClose={() => { setEditOpen(false); setRegOpen(false) }}
        title={editOpen ? 'Edit your details' : 'Register'}>
        <div className="flex flex-col gap-4">
          <Field label="Name *"><input className="input" value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} placeholder="Your name" /></Field>
          <Field label="Email *"><input className="input" type="email" value={f.email} onChange={e => setF(x => ({ ...x, email: e.target.value }))} placeholder="you@example.com" /></Field>
          <Field label="Mobile" hint="Optional — needed for mobile verification">
            <input className="input" type="tel" value={f.mobile} onChange={e => setF(x => ({ ...x, mobile: e.target.value }))} placeholder="+880 1XXX-XXXXXX" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button className="btn btn-ghost" onClick={() => { setEditOpen(false); setRegOpen(false) }}>Cancel</button>
          <button className="btn btn-primary" onClick={editOpen ? saveEdit : doRegister}
            disabled={!f.name.trim() || !EMAIL_RE.test(f.email.trim())}>
            {editOpen ? 'Save changes' : 'Register'}
          </button>
        </div>
      </Modal>

      <PinConfirm open={signOutOpen} onClose={() => setSignOutOpen(false)}
        title="Sign out?" confirmLabel="Sign out"
        icon={LogOut}
        message={<>This clears your name, email and verification from this device. <b style={{ color: 'var(--text)' }}>All your contacts, tasks, events and notes stay exactly as they are.</b> You can register again afterwards.</>}
        onConfirm={() => signOutProfile()} />
    </>
  )
}
