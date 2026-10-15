import { useRef, useState } from 'react'
import {
  Zap, Sparkles, HardDrive, Cloud, CloudUpload, ArrowRight, ArrowLeft, Lock, BellRing,
  Check, ShieldCheck, Globe, UserRound, Upload,
} from 'lucide-react'
import { useCrm } from '../store'
import { t as tr, useLang, LANGS } from '../lib/i18n'
import { detectBackup, decryptBackup } from '../lib/vault'
import { requestNotifyPermission } from '../lib/native-notify'
import { cn } from '../lib'

/* First-run setup wizard — welcome path picker (start fresh / restore /
 * Google / Gist) then the small steps every new device needs: profile +
 * language, pincode, reminder permission, finish (keep or wipe samples). */
export default function SetupWizard() {
  useLang()
  const crm = useCrm()
  const [step, setStep] = useState('welcome')
  const [path, setPath] = useState(null)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [pinErr, setPinErr] = useState('')
  const [gId, setGId] = useState('')
  const [gistToken, setGistToken] = useState('')
  const [restoreFile, setRestoreFile] = useState(null)
  const [restoreText, setRestoreText] = useState('')
  const [restoreKind, setRestoreKind] = useState(null)   // 'plain' | 'encrypted' | 'unknown'
  const [restorePw, setRestorePw] = useState('')
  const [restoreErr, setRestoreErr] = useState('')
  const fileRef = useRef(null)

  const finish = (p, extra = {}) => {
    if (!crm.lock?.hash && !crm.lock?.skipped) crm.skipPinSetup()   // never strand on the lock setup
    crm.completeOnboard({ path: p || path || 'skip', ...extra })
  }

  /* ── welcome: the path picker ── */
  const PATHS = [
    { id: 'new', icon: Sparkles, tone: '#a78bfa', title: tr('wiz.new', "I'm new — start fresh"), sub: tr('wiz.newSub', 'Explore with sample people, then keep or wipe them after the tour.') },
    { id: 'restore', icon: HardDrive, tone: '#38bdf8', title: tr('wiz.restore', 'Restore a backup'), sub: tr('wiz.restoreSub', 'Plain .json or encrypted .pcrm.json from another install.') },
    { id: 'google', icon: Cloud, tone: '#34d399', title: tr('wiz.google', 'Connect with Google'), sub: tr('wiz.googleSub', 'Your OAuth Client ID → Calendar, Contacts & Drive backup.') },
    { id: 'gist', icon: CloudUpload, tone: '#f472b6', title: tr('wiz.gist', 'Multi-device sync via GitHub Gist'), sub: tr('wiz.gistSub', 'One private gist keeps phone, PWA and browser in sync.') },
  ]

  const pick = id => {
    setPath(id)
    setStep(id === 'new' ? 'profile' : id)
  }

  const onFile = f => {
    setRestoreErr('')
    const r = new FileReader()
    r.onload = () => {
      const text = String(r.result || '')
      const kind = detectBackup(text)
      setRestoreText(text)
      setRestoreKind(kind)
      setRestoreFile(f)
      if (kind === 'unknown') setRestoreErr(tr('wiz.badFile', 'That file is not a Personal CRM backup'))
    }
    r.readAsText(f)
  }

  const doRestore = async () => {
    setRestoreErr('')
    try {
      let text = restoreText
      if (restoreKind === 'encrypted') {
        text = await decryptBackup(restoreText, restorePw)
      }
      const ok = crm.restoreAll(JSON.parse(text))
      if (ok === false) { setRestoreErr(tr('wiz.badFile', 'That file is not a Personal CRM backup')); return }
      setStep('pin')
    } catch (e) {
      setRestoreErr(e.message || tr('wiz.badFile', 'Could not read that backup'))
    }
  }

  const doPin = async () => {
    if (pin.length < 4) { setPinErr(tr('wiz.pinShort', 'At least 4 digits')); return }
    if (pin !== pin2) { setPinErr(tr('wiz.pinMatch', 'The two pincodes do not match')); return }
    await crm.setupPin(pin)
    setStep('notify')
  }

  /* ── shared chrome ── */
  const Shell = ({ children, wide }) => (
    <div className="h-screen w-full grid place-items-center p-4 overflow-y-auto" style={{ background: 'linear-gradient(160deg, var(--bg), var(--cardbg2))' }}>
      <div className={cn('card p-7 fadein w-full', wide ? 'max-w-[560px]' : 'max-w-[440px]')} style={{ borderRadius: 20 }}>
        {children}
      </div>
    </div>
  )
  const Hero = ({ icon: Icon = Zap, title, sub }) => (
    <div className="flex flex-col items-center text-center mb-5">
      <div className="w-14 h-14 rounded-2xl grid place-items-center mb-3"
        style={{ background: 'linear-gradient(140deg,#6366f1,#2dd4bf)', color: '#0b0e17' }}>
        <Icon size={26} />
      </div>
      <h1 className="text-[18px] font-extrabold">{title}</h1>
      {sub && <p className="text-[12.5px] mt-1.5 leading-snug" style={{ color: 'var(--muted)' }}>{sub}</p>}
    </div>
  )
  const StepDots = ({ at }) => (
    <div className="flex items-center justify-center gap-1.5 mt-5">
      {['profile', 'restore', 'google', 'gist', 'pin', 'notify', 'done'].map((s2, i) => (
        <span key={s2} className="rounded-full" style={{ width: s2 === at ? 16 : 6, height: 6, background: s2 === at ? '#818cf8' : 'rgba(255,255,255,.14)', transition: 'all .2s' }} />
      ))}
    </div>
  )

  if (step === 'welcome') {
    return (
      <Shell wide>
        <Hero title={tr('wiz.title', 'Welcome to Personal CRM')} sub={tr('wiz.sub', 'Brand-new device? Pick how you want to begin. Nothing leaves this phone unless you choose a sync path.')} />
        <div className="flex flex-col gap-3">
          {PATHS.map(p => (
            <button key={p.id} data-testid={`wiz-path-${p.id}`}
              onClick={() => pick(p.id)}
              className="flex items-center gap-3.5 rounded-2xl p-4 text-left transition-all hover:scale-[1.01]"
              style={{ border: '1.5px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.025)' }}>
              <div className="w-11 h-11 rounded-2xl grid place-items-center flex-none" style={{ background: p.tone + '1c', color: p.tone }}>
                <p.icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] font-bold">{p.title}</div>
                <div className="text-[12px] leading-snug" style={{ color: 'var(--muted)' }}>{p.sub}</div>
              </div>
              <ArrowRight size={17} style={{ color: 'var(--faint)' }} />
            </button>
          ))}
        </div>
        <button className="block mx-auto mt-6 text-[13px] font-bold hover:underline" style={{ color: 'var(--muted)' }}
          data-testid="wiz-skip" onClick={() => finish('skip')}>
          {tr('wiz.skip', 'Skip setup — open with sample data')}
        </button>
        <p className="flex items-start justify-center gap-1.5 text-[11px] text-center mt-5 leading-snug" style={{ color: 'var(--faint)' }}>
          <ShieldCheck size={12} className="mt-[1px] flex-none" />
          {tr('wiz.footer', 'Personal CRM has no server and no account. Everything stays on this device unless you connect a backend you control.')}
        </p>
      </Shell>
    )
  }

  if (step === 'restore') {
    return (
      <Shell>
        <Hero icon={HardDrive} title={tr('wiz.restore', 'Restore a backup')} sub={tr('wiz.restoreSub', 'Plain .json or encrypted .pcrm.json from another install.')} />
        {!restoreFile ? (
          <button className="btn btn-primary w-full justify-center" data-testid="wiz-restore-pick" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> {tr('wiz.chooseFile', 'Choose a backup file')}
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="card p-3 text-[12px]" style={{ color: 'var(--muted)' }}>
              <b style={{ color: 'var(--text)' }}>{restoreFile.name}</b> ·{' '}
              {restoreKind === 'encrypted' ? tr('wiz.encrypted', 'encrypted .pcrm.json — enter your password')
                : restoreKind === 'plain' ? tr('wiz.plain', 'plain backup, ready to restore')
                : tr('wiz.badFile', 'That file is not a Personal CRM backup')}
            </div>
            {restoreKind === 'encrypted' && (
              <input className="input" type="password" placeholder={tr('wiz.password', 'Backup password')} value={restorePw}
                data-testid="wiz-restore-pw" onChange={e => setRestorePw(e.target.value)} />
            )}
            {restoreErr && <div className="text-[12px] font-semibold" style={{ color: '#fb7185' }}>{restoreErr}</div>}
            <button className="btn btn-primary justify-center" data-testid="wiz-restore-go"
              disabled={restoreKind === 'unknown' || (restoreKind === 'encrypted' && restorePw.length < 4)}
              onClick={doRestore}>
              {tr('wiz.restoreGo', 'Restore & continue')}
            </button>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".json,.pcrm.json,application/json" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
        <button className="block mx-auto mt-5 text-[12px] font-semibold hover:underline" style={{ color: 'var(--faint)' }}
          onClick={() => setStep('welcome')}><ArrowLeft size={11} className="inline -mt-[1px]" /> {tr('wiz.back', 'Back')}</button>
        <StepDots at={step} />
      </Shell>
    )
  }

  if (step === 'google') {
    return (
      <Shell>
        <Hero icon={Cloud} title={tr('wiz.google', 'Connect with Google')} sub={tr('wiz.googleSub', 'Your OAuth Client ID → Calendar, Contacts & Drive backup.')} />
        <label className="block">
          <span className="label">OAuth Client ID</span>
          <input className="input mt-1" placeholder="….apps.googleusercontent.com" value={gId} data-testid="wiz-google-id"
            onChange={e => setGId(e.target.value)} />
        </label>
        <div className="text-[11px] mt-2 leading-snug" style={{ color: 'var(--faint)' }}>
          {tr('wiz.googleHint', 'Create it once in Google Cloud (guided steps live in Settings → Google hub). You can also skip and connect later.')}
        </div>
        <button className="btn btn-primary w-full justify-center mt-4" data-testid="wiz-google-save"
          onClick={() => { if (gId.trim()) crm.saveGoogleClientId(gId); setStep('pin') }}>
          {gId.trim() ? tr('wiz.saveContinue', 'Save & continue') : tr('wiz.continueLater', 'Continue')}
        </button>
        <button className="block mx-auto mt-3 text-[12px] font-semibold hover:underline" style={{ color: 'var(--faint)' }}
          onClick={() => setStep('welcome')}><ArrowLeft size={11} className="inline -mt-[1px]" /> {tr('wiz.back', 'Back')}</button>
        <StepDots at={step} />
      </Shell>
    )
  }

  if (step === 'gist') {
    return (
      <Shell>
        <Hero icon={CloudUpload} title={tr('wiz.gist', 'Multi-device sync via GitHub Gist')} sub={tr('wiz.gistSub', 'One private gist keeps phone, PWA and browser in sync.')} />
        <label className="block">
          <span className="label">GitHub personal access token</span>
          <input className="input mt-1" type="password" placeholder="ghp_… (gist scope)" value={gistToken} data-testid="wiz-gist-token"
            onChange={e => setGistToken(e.target.value)} />
        </label>
        <div className="text-[11px] mt-2 leading-snug" style={{ color: 'var(--faint)' }}>
          {tr('wiz.gistHint', 'The token stays on this device and can only touch gists. Skip to sync later from Settings.')}
        </div>
        <button className="btn btn-primary w-full justify-center mt-4" data-testid="wiz-gist-save"
          onClick={async () => {
            if (gistToken.trim()) { try { await crm.saveGistToken(gistToken.trim()) } catch { /* shown in Settings */ } }
            setStep('pin')
          }}>
          {gistToken.trim() ? tr('wiz.connectContinue', 'Connect & continue') : tr('wiz.continueLater', 'Continue')}
        </button>
        <button className="block mx-auto mt-3 text-[12px] font-semibold hover:underline" style={{ color: 'var(--faint)' }}
          onClick={() => setStep('welcome')}><ArrowLeft size={11} className="inline -mt-[1px]" /> {tr('wiz.back', 'Back')}</button>
        <StepDots at={step} />
      </Shell>
    )
  }

  if (step === 'profile') {
    const card = crm.myCard || {}
    return (
      <Shell>
        <Hero icon={UserRound} title={tr('wiz.profileTitle', 'A little about you')} sub={tr('wiz.profileSub', 'Used for your QR business card and shared exports. All optional.')} />
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="label">{tr('wiz.name', 'Your name')}</span>
            <input className="input mt-1" value={card.name || ''} data-testid="wiz-name" placeholder="e.g. Rahim Uddin"
              onChange={e => crm.updateMyCard({ name: e.target.value.slice(0, 80) })} />
          </label>
          <label className="block">
            <span className="label">{tr('wiz.phone', 'Phone')}</span>
            <input className="input mt-1" value={card.phone || ''} data-testid="wiz-phone" placeholder="+8801…"
              onChange={e => crm.updateMyCard({ phone: e.target.value.slice(0, 40) })} />
          </label>
          <div>
            <span className="label inline-flex items-center gap-1.5"><Globe size={11} /> {tr('wiz.language', 'Interface language')}</span>
            <div className="flex gap-1.5 mt-1.5">
              {Object.entries(LANGS).map(([code, label]) => (
                <button key={code} data-testid={`wiz-lang-${code}`}
                  className={cn('chip chip-btn', (crm.lang || 'en') === code && 'on')}
                  onClick={() => crm.setLang(code)}>{label}</button>
              ))}
            </div>
          </div>
        </div>
        <button className="btn btn-primary w-full justify-center mt-5" data-testid="wiz-profile-next"
          onClick={() => setStep('pin')}>
          {tr('wiz.continue', 'Continue')} <ArrowRight size={14} />
        </button>
        <button className="block mx-auto mt-3 text-[12px] font-semibold hover:underline" style={{ color: 'var(--faint)' }}
          onClick={() => setStep('welcome')}><ArrowLeft size={11} className="inline -mt-[1px]" /> {tr('wiz.back', 'Back')}</button>
        <StepDots at={step} />
      </Shell>
    )
  }

  if (step === 'pin') {
    return (
      <Shell>
        <Hero icon={Lock} title={tr('wiz.pinTitle', 'Protect this device')} sub={tr('wiz.pinSub', 'A 4–6 digit pincode locks the app screen. Fingerprint / face can be added later in Settings.')} />
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="label">{tr('lock.choose', 'Choose pincode')}</span>
            <input className="input mt-1 text-center" type="password" inputMode="numeric" maxLength={6} placeholder="••••"
              data-testid="wiz-pin" value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setPinErr('') }} />
          </label>
          <label className="block">
            <span className="label">{tr('lock.repeat', 'Repeat pincode')}</span>
            <input className="input mt-1 text-center" type="password" inputMode="numeric" maxLength={6} placeholder="••••"
              data-testid="wiz-pin2" value={pin2} onChange={e => { setPin2(e.target.value.replace(/\D/g, '')); setPinErr('') }} />
          </label>
          {pinErr && <div className="text-[12px] font-semibold text-center" style={{ color: '#f87171' }}>{pinErr}</div>}
          <button className="btn btn-primary w-full justify-center" data-testid="wiz-pin-set"
            disabled={pin.length < 4 || pin2.length < 4} onClick={doPin}>
            <ShieldCheck size={15} /> {tr('wiz.pinSet', 'Set pincode & continue')}
          </button>
          <button className="text-[12px] font-semibold hover:underline" style={{ color: 'var(--faint)' }}
            data-testid="wiz-pin-skip" onClick={() => { crm.skipPinSetup(); setStep('notify') }}>
            {tr('wiz.pinSkip', 'Skip — no pincode for now')}
          </button>
        </div>
        <StepDots at={step} />
      </Shell>
    )
  }

  if (step === 'notify') {
    return (
      <Shell>
        <Hero icon={BellRing} title={tr('wiz.notifyTitle', 'Reminders that ring')} sub={tr('wiz.notifySub', 'Allow notifications so reminders, birthdays and follow-ups can alert you — even with the app closed.')} />
        <button className="btn btn-primary w-full justify-center" data-testid="wiz-notify-on"
          onClick={async () => { await requestNotifyPermission(); setStep('done') }}>
          <BellRing size={15} /> {tr('wiz.notifyEnable', 'Enable notifications')}
        </button>
        <button className="block mx-auto mt-3 text-[12px] font-semibold hover:underline" style={{ color: 'var(--faint)' }}
          data-testid="wiz-notify-skip" onClick={() => setStep('done')}>
          {tr('wiz.notifySkip', 'Not now')}
        </button>
        <StepDots at={step} />
      </Shell>
    )
  }

  /* done */
  const samples = (crm.contacts || []).length > 0 && path !== 'restore'
  return (
    <Shell>
      <Hero icon={Check} title={tr('wiz.doneTitle', 'You are all set')} sub={tr('wiz.doneSub', 'Everything lives on this device. Change any of this later in Settings.')} />
      {samples ? (
        <>
          <div className="flex flex-col gap-2">
            <button className="btn btn-primary w-full justify-center" data-testid="wiz-done-keep"
              onClick={() => finish(path)}>
              {tr('wiz.keepSamples', 'Open CRM — keep the sample people')}
            </button>
            <button className="btn btn-ghost w-full justify-center" data-testid="wiz-done-wipe"
              onClick={() => { crm.wipeSampleData(); finish(path, { wiped: true }) }}>
              {tr('wiz.wipeSamples', 'Wipe samples & open empty')}
            </button>
          </div>
        </>
      ) : (
        <button className="btn btn-primary w-full justify-center" data-testid="wiz-done-open"
          onClick={() => finish(path)}>
          {tr('wiz.open', 'Open Personal CRM')} <ArrowRight size={14} />
        </button>
      )}
      <StepDots at="done" />
    </Shell>
  )
}
