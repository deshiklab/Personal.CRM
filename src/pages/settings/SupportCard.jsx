import { Mail, Phone, Globe, LifeBuoy, Copy, Bug } from 'lucide-react'
import { useCrm } from '../../store'
import { Card } from '../../components/ui'
import { BRAND, COPYRIGHT, LEGAL_URLS } from '../../brand'

/* ═════════════════════════════════════════════════════════════════════════════
 * In-app support — who built this, and how to reach a human.
 *
 * There is no analytics and no crash uploader in this app, so the only way we
 * ever hear about a problem is if you send it. This card makes that one tap:
 * a pre-filled mail with version and device details, and nothing else attached
 * (no contacts, no notes — you decide what to include).
 * ═════════════════════════════════════════════════════════════════════════════ */

export default function SupportCard() {
  const { contacts, tasks, notes, events } = useCrm()

  const diagnostics = [
    `${BRAND.app} v${BRAND.version}`,
    `${contacts.length} contacts · ${tasks.length} tasks · ${notes.length} notes · ${events.length} events`,
    `${navigator.userAgent}`,
    `Screen: ${location.hash || '/'}`,
  ].join('\n')

  const mailto = (subject, body) =>
    `mailto:${BRAND.email}?subject=${encodeURIComponent(`[${BRAND.app} ${BRAND.version}] ${subject}`)}&body=${encodeURIComponent(body)}`

  const Row = ({ icon: Icon, label, value, href, tone = '#38bdf8' }) => (
    <a href={href} target="_blank" rel="noreferrer"
      className="flex items-center gap-3 py-2.5 border-b last:border-0 hoverable"
      style={{ borderColor: 'rgba(255,255,255,.05)', textDecoration: 'none', color: 'inherit' }}>
      <div className="w-8 h-8 rounded-lg grid place-items-center flex-none"
        style={{ background: tone + '1c', color: tone }}>
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{label}</div>
        <div className="text-[13.5px] font-semibold truncate">{value}</div>
      </div>
    </a>
  )

  return (
    <Card className="p-5 mt-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center flex-none"
          style={{ background: 'rgba(56,189,248,.12)', color: '#38bdf8' }}>
          <LifeBuoy size={18} />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-[15px]">Support</div>
          <div className="text-[11.5px]" style={{ color: 'var(--faint)' }}>
            Built and supported by {BRAND.publisher}. Nothing leaves your device unless you send it.
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-x-5">
        <Row icon={Mail} label="Email" value={BRAND.email} href={mailto('Support request', '\n\nWhat can we help with?\n\n')} />
        <Row icon={Phone} label="Mobile" value={BRAND.mobileLabel} href={`tel:${BRAND.mobile}`} tone="#34d399" />
        <Row icon={Globe} label="Web" value={BRAND.websiteLabel} href={BRAND.website} tone="#a78bfa" />
        <Row icon={Bug} label="Report a problem" value="Send a crash report"
          href={mailto('Crash report', 'What were you doing when it happened?\n\n\n--- diagnostics ---\n' + diagnostics)}
          tone="#fb7185" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(diagnostics)}>
          <Copy size={12} /> Copy diagnostics
        </button>
        <a className="btn btn-ghost btn-sm" href={LEGAL_URLS.privacy} target="_blank" rel="noreferrer">Privacy</a>
        <a className="btn btn-ghost btn-sm" href={LEGAL_URLS.terms} target="_blank" rel="noreferrer">Terms</a>
        <span className="text-[11px] w-full sm:w-auto sm:ml-auto sm:text-right" style={{ color: 'var(--faint)' }}>{COPYRIGHT}</span>
      </div>
    </Card>
  )
}
