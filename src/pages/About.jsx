import { ExternalLink, Globe, Mail, Phone, ShieldCheck, Scale, FileText, HeartHandshake, Sparkles } from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Card, Pill } from '../components/ui'
import { BRAND, COPYRIGHT, LEGAL_URLS, THIRD_PARTY } from '../brand'
import { toneVar } from '../components/ui'

const ContactRow = ({ icon: Icon, label, value, href, tone = '#38bdf8' }) => (
  <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-2.5 border-b last:border-0 hoverable"
    style={{ borderColor: 'var(--hairline)', textDecoration: 'none', color: 'inherit' }}>
    <div className="w-8 h-8 rounded-lg grid place-items-center flex-none" style={{ background: tone + '1c', color: toneVar(tone) }}>
      <Icon size={15} />
    </div>
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{label}</div>
      <div className="text-[13.5px] font-semibold truncate">{value}</div>
    </div>
  </a>
)

export default function About() {
  const { contacts, tasks, events, notes } = useCrm()

  return (
    <div className="max-w-[900px] mx-auto">
      <SectionHead kicker="About" title={BRAND.app}
        sub={`Version ${BRAND.version} · a private, offline-first relationship manager`}
        right={<Pill color="#818cf8">v{BRAND.version}</Pill>} />

      {/* ── publisher ── */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl grid place-items-center text-[22px] font-black flex-none"
            style={{ background: 'linear-gradient(120deg,#818cf8,#38bdf8 55%,#34d399)', color: '#0a0c11', boxShadow: '0 6px 24px rgba(129,140,248,.32)' }}>
            ⚡
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[19px] font-extrabold tracking-tight">{BRAND.app}</h2>
            <div className="text-[13px] mt-0.5" style={{ color: 'var(--muted)' }}>
              Designed and developed by <b style={{ color: 'var(--text)' }}>{BRAND.publisher}</b>
            </div>
            <div className="text-[11.5px] mt-1.5" style={{ color: 'var(--faint)' }}>{COPYRIGHT}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ContactRow icon={Globe} label="Website" value={BRAND.websiteLabel} href={BRAND.website} tone="#38bdf8" />
          <ContactRow icon={Mail}  label="Email"   value={BRAND.email}        href={`mailto:${BRAND.email}`} tone="#a78bfa" />
          <ContactRow icon={Phone} label="Mobile"  value={BRAND.mobileLabel}  href={`tel:${BRAND.mobile.replace(/\s/g, '')}`} tone="#34d399" />
        </div>
      </Card>

      {/* ── your data ── */}
      <Card className="p-6 mt-4">
        <div className="flex items-center gap-2.5 mb-2">
          <ShieldCheck size={17} style={{ color: 'var(--t-green)' }} />
          <h3 className="text-[15px] font-bold">Your data stays yours</h3>
        </div>
        <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
          {BRAND.app} runs entirely on this device. Contacts, tasks, events and notes are stored locally and are
          <b style={{ color: 'var(--text)' }}> never uploaded to a server we operate</b> — there is no backend, no account and
          no analytics. Backups and sync are optional and go straight to your own Google Drive or GitHub account, using
          credentials you control. The optional app-lock pincode is stored as a salted hash on this device only.
          One exception, and it is your choice: at registration you can agree to send your name and email to BITSCOL,
          and verification codes are relayed through us so we can confirm your address or number.
        </p>
        <div className="flex gap-2 flex-wrap mt-3.5">
          <Pill color="#34d399">{contacts.length} contacts</Pill>
          <Pill color="#38bdf8">{tasks.length} tasks</Pill>
          <Pill color="#a78bfa">{events.length} events</Pill>
          <Pill color="#fbbf24">{notes.length} notes</Pill>
          <span className="chip" style={{ color: 'var(--faint)' }}>all stored locally</span>
        </div>
      </Card>

      {/* ── legal ── */}
      <Card className="p-6 mt-4">
        <div className="flex items-center gap-2.5 mb-3">
          <Scale size={17} style={{ color: 'var(--t-indigo)' }} />
          <h3 className="text-[15px] font-bold">Legal</h3>
        </div>
        <div className="flex flex-col gap-2">
          <a href={LEGAL_URLS.privacy} target="_blank" rel="noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl border hoverable"
            style={{ borderColor: 'var(--border)', textDecoration: 'none', color: 'inherit' }}>
            <FileText size={15} style={{ color: 'var(--t-sky)' }} />
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold">Privacy Policy</div>
              <div className="text-[11.5px]" style={{ color: 'var(--faint)' }}>What is stored, where, and what leaves your device</div>
            </div>
            <ExternalLink size={14} style={{ color: 'var(--faint)' }} />
          </a>
          <a href={LEGAL_URLS.terms} target="_blank" rel="noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl border hoverable"
            style={{ borderColor: 'var(--border)', textDecoration: 'none', color: 'inherit' }}>
            <Scale size={15} style={{ color: 'var(--t-violet)' }} />
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold">Terms of Use &amp; Licence</div>
              <div className="text-[11.5px]" style={{ color: 'var(--faint)' }}>Single-device licence, warranties, refunds</div>
            </div>
            <ExternalLink size={14} style={{ color: 'var(--faint)' }} />
          </a>
        </div>
        <p className="text-[12px] mt-4" style={{ color: 'var(--faint)' }}>
          Licensed, not sold. One purchase covers personal use of this app on your own devices; reverse engineering,
          redistribution and resale are not permitted. Full terms are linked above.
        </p>
      </Card>

      {/* ── open source credits ── */}
      <Card className="p-6 mt-4">
        <div className="flex items-center gap-2.5 mb-1">
          <Sparkles size={17} style={{ color: 'var(--t-amber)' }} />
          <h3 className="text-[15px] font-bold">Open-source credits</h3>
        </div>
        <p className="text-[12.5px] mb-3" style={{ color: 'var(--muted)' }}>
          {BRAND.app} is built on the work below. Each is used under its own licence.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {THIRD_PARTY.map(t => (
            <a key={t.name} href={t.url} target="_blank" rel="noreferrer"
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border"
              style={{ borderColor: 'var(--border)', textDecoration: 'none', color: 'inherit' }}>
              <span className="text-[12.5px] font-medium truncate">{t.name}</span>
              <span className="chip" style={{ fontSize: 10.5, color: 'var(--faint)' }}>{t.license}</span>
            </a>
          ))}
        </div>
      </Card>

      {/* ── support ── */}
      <Card className="p-6 mt-4">
        <div className="flex items-center gap-2.5 mb-2">
          <HeartHandshake size={17} style={{ color: 'var(--t-pink)' }} />
          <h3 className="text-[15px] font-bold">Support &amp; feedback</h3>
        </div>
        <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
          Questions, bug reports or feature requests — email{' '}
          <a href={`mailto:${BRAND.email}`} style={{ color: 'var(--t-sky)', fontWeight: 650 }}>{BRAND.email}</a>{' '}
          or call{' '}
          <a href={`tel:${BRAND.mobile.replace(/\s/g, '')}`} style={{ color: 'var(--t-sky)', fontWeight: 650 }}>{BRAND.mobileLabel}</a>.
          Please include your app version ({BRAND.version}) and device model.
        </p>
      </Card>

      <div className="text-center text-[11.5px] py-7" style={{ color: 'var(--faint)' }}>
        <div style={{ fontWeight: 700, letterSpacing: '.04em' }}>
          {BRAND.app} · v{BRAND.version}
        </div>
        <div className="mt-1">{COPYRIGHT}</div>
        <div className="mt-1">
          <a href={BRAND.website} target="_blank" rel="noreferrer" style={{ color: 'var(--muted)' }}>{BRAND.websiteLabel}</a>
        </div>
      </div>
    </div>
  )
}
