import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plug, Calendar, Users, HardDrive, Mail, PhoneCall, FileUp, FileDown, Send, CheckCircle2,
  AlertTriangle, Loader2, ExternalLink, Zap, KeyRound, RefreshCw, Trash2
} from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Card, Pill, Empty } from '../components/ui'
import { tsRel } from '../lib'
import { downloadVCF, parseVCF } from '../lib/vcard'
import { downloadICS } from '../lib/ics'

const StatusPill = ({ ok, warn, label }) =>
  <Pill color={ok ? '#34d399' : warn ? '#fbbf24' : '#94a3b8'}>{label}</Pill>

export default function IntegrationsPage() {
  const {
    gcal, googleMode, mailboxes, webhooks, saveWebhooks, testWebhook,
    contacts, events, contactById, commitImport, toast, driveState,
    icsFeeds, addIcsFeed, syncIcsFeed, removeIcsFeed,
  } = useCrm()
  const nav = useNavigate()
  const [url, setUrl] = useState(webhooks.url)
  const [pinging, setPinging] = useState(false)
  const [feedUrl, setFeedUrl] = useState('')
  const [feedRelay, setFeedRelay] = useState(false)
  const [feedBusy, setFeedBusy] = useState(false)
  const vcfRef = useRef(null)

  const SERVICE_ROWS = [
    { icon: Calendar, color: '#38bdf8', name: 'Google Calendar', ok: gcal.connected, detail: gcal.connected ? `LIVE · synced ${gcal.lastSync ? tsRel(gcal.lastSync) : '—'}` : 'connect in Settings → Google hub' },
    { icon: Users, color: '#a78bfa', name: 'Google Contacts', ok: !!driveState.lastContactsSync, detail: driveState.lastContactsSync ? `last import ${tsRel(driveState.lastContactsSync)}` : 'sync via Settings → Google hub' },
    { icon: HardDrive, color: '#34d399', name: 'Drive backup', ok: !!driveState.lastBackup, detail: driveState.lastBackup ? `backed up ${tsRel(driveState.lastBackup)}` : 'backups in Settings → Google hub' },
    { icon: Mail, color: '#ea4335', name: 'Gmail', ok: mailboxes.gmail.connected, detail: mailboxes.gmail.connected ? `LIVE · ${mailboxes.gmail.address}` : googleMode === 'live' ? 'Client ID set — connect from Email screen' : 'OFF — set your Client ID (guide in Settings)' },
    { icon: Mail, color: '#0a78d4', name: 'Outlook', ok: mailboxes.outlook.connected, unavailable: true, detail: 'not in this build — needs a Microsoft OAuth app and a server' },
  ]

  return (
    <div className="max-w-[1100px] mx-auto">
      <SectionHead kicker="Connections" title="Integrations & Bridges"
        sub="Every third-party pipe into and out of your CRM — with honest status: what works right now vs what needs your own API key" />

      {/* status board */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Plug size={15} style={{ color: 'var(--i2)' }} />
          <h3 className="text-[14px] font-extrabold">Connection board</h3>
          <div className="ml-auto flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/settings')}><KeyRound size={13} /> Google Client ID {googleMode === 'live' ? '✓' : '…'}</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {SERVICE_ROWS.map((r, i) => (
            <div key={i} className="card p-3.5 flex items-center gap-3" style={{ borderRadius: 14 }}>
              <div className="w-9 h-9 rounded-xl grid place-items-center flex-none" style={{ background: r.color + '1c', color: r.color }}><r.icon size={16} /></div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold flex items-center gap-2">{r.name}
                  <StatusPill ok={r.ok && !r.warn} warn={r.warn || r.unavailable}
                    label={r.unavailable ? 'NOT IN THIS BUILD' : r.ok ? (r.warn ? 'DEMO' : 'LIVE') : 'OFF'} />
                </div>
                <div className="text-[11px] truncate" style={{ color: 'var(--faint)' }}>{r.detail}</div>
              </div>
            </div>
          ))}
          <div className="card p-3.5 flex items-center gap-3" style={{ borderRadius: 14, borderStyle: 'dashed' }}>
            <div className="w-9 h-9 rounded-xl grid place-items-center flex-none" style={{ background: '#fbbf241c', color: '#fbbf24' }}><Zap size={16} /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold">Webhooks <StatusPill ok={!!webhooks.url} label={webhooks.url ? 'READY' : 'SETUP'} /></div>
              <div className="text-[11px] truncate" style={{ color: 'var(--faint)' }}>{webhooks.url ? `${Object.values(webhooks.on).filter(Boolean).length} events armed · ${webhooks.log.length} deliveries logged` : 'Zapier / Make / n8n — configure below'}</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* ── outbound webhooks ── */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={15} style={{ color: '#fbbf24' }} />
            <h3 className="text-[14px] font-extrabold">Outbound webhooks</h3>
          </div>
          <p className="text-[12px] mb-4" style={{ color: 'var(--muted)' }}>
            Paste a catch-hook from <b style={{ color: 'var(--text)' }}>Zapier, Make or n8n</b> — the CRM POSTs JSON the instant things happen, straight from your browser. When the hook returns CORS headers you get the real HTTP status; otherwise it falls back to <b style={{ color: 'var(--text)' }}>opaque delivery</b> (the hook still receives the payload).
          </p>
          <div className="flex gap-2 mb-3">
            <input className="input flex-1" style={{ fontFamily: 'monospace', fontSize: 12 }} placeholder="https://hooks.zapier.com/hooks/catch/…"
              value={url} onChange={e => setUrl(e.target.value)} />
            <button className="btn btn-primary btn-sm" disabled={url.trim() === webhooks.url && url.trim() !== ''}
              onClick={() => { saveWebhooks({ url: url.trim() }); toast('Webhook URL saved') }}>Save</button>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {[['lead', 'New lead captured'], ['contact', 'Contact added'], ['task_done', 'Task completed'], ['touch', 'Contact logged']].map(([k, label]) => (
              <button key={k} className={`chip chip-btn ${webhooks.on[k] ? 'on' : ''}`} onClick={() => saveWebhooks({ on: { [k]: !webhooks.on[k] } })}>
                {webhooks.on[k] ? '✓ ' : ''}{label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-primary btn-sm" disabled={pinging || !webhooks.url}
              onClick={async () => { setPinging(true); await testWebhook(); setPinging(false) }}>
              {pinging ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send test ping
            </button>
            {!webhooks.url && <span className="text-[11px]" style={{ color: 'var(--faint)' }}>save a URL to enable the ping</span>}
            <span className="text-[11px] ml-auto" style={{ color: 'var(--faint)' }}>payload: {'{ source, event, ts, data }'}</span>
          </div>
          {webhooks.log.length > 0 && (
            <div className="mt-4">
              <div className="label">Recent deliveries</div>
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                {webhooks.log.slice(0, 8).map((l, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11.5px] px-3 py-1.5 rounded-lg" style={{ background: 'var(--cardbg2)' }}>
                    {l.ok ? <CheckCircle2 size={12} style={{ color: '#34d399' }} /> : <AlertTriangle size={12} style={{ color: '#fb7185' }} />}
                    <span className="font-semibold" style={{ color: 'var(--text)' }}>{l.type}</span>
                    <span style={{ color: 'var(--muted)' }}>{l.status}</span>
                    <span className="ml-auto" style={{ color: 'var(--faint)' }}>{tsRel(l.ts)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* ── phone / address-book bridge ── */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <PhoneCall size={15} style={{ color: '#34d399' }} />
            <h3 className="text-[14px] font-extrabold">Phone & address-book bridge</h3>
          </div>
          <p className="text-[12px] mb-4" style={{ color: 'var(--muted)' }}>
            Standard <b style={{ color: 'var(--text)' }}>.vcf</b> both ways — export your CRM to any phone, or drop an exported address book here and it flows through the dedupe/diff/rollback pipeline.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary btn-sm" onClick={() => downloadVCF(contacts, 'personal-crm-contacts.vcf')}>
              <FileDown size={13} /> Export all as .vcf ({contacts.length})
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => vcfRef.current?.click()}>
              <FileUp size={13} /> Import .vcf from device…
            </button>
            <input ref={vcfRef} type="file" accept=".vcf,text/vcard" className="hidden" onChange={e => {
              const f = e.target.files?.[0]; if (!f) return
              const r = new FileReader()
              r.onload = () => {
                const rows = parseVCF(String(r.result))
                if (!rows.length) { toast('No contacts found in that file', 'warn'); return }
                const b = commitImport(rows, f.name)
                toast(`📇 ${f.name}: ${b.added} added · ${b.updated} updated · ${b.skipped} skipped`)
              }
              r.readAsText(f); e.target.value = ''
            }} />
          </div>
          <p className="text-[11px] mt-3" style={{ color: 'var(--faint)' }}>
            Works with exports from iCloud, Google Contacts, Outlook, and any phone's “share contacts as vCard”. Per-contact cards are shareable from the contact sheet too.
          </p>
        </Card>

        {/* ── calendar bridge ── */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={15} style={{ color: '#38bdf8' }} />
            <h3 className="text-[14px] font-extrabold">Calendar bridges</h3>
          </div>
          <p className="text-[12px] mb-4" style={{ color: 'var(--muted)' }}>
            Two no-auth paths that work everywhere: a standard <b style={{ color: 'var(--text)' }}>.ics</b> of your whole event book, and one-click “add to Google Calendar” links on every event.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary btn-sm" onClick={() => downloadICS(events, contactById)}>
              <FileDown size={13} /> Export events (.ics), {events.length}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/calendar')}>
              <ExternalLink size={13} /> Open an event → “Add to Google Calendar”
            </button>
          </div>
          <p className="text-[11px] mt-3" style={{ color: 'var(--faint)' }}>
            The .ics imports into Apple Calendar, Outlook, Google (Settings → Import), and any CalDAV client.
          </p>

          {/* read-only real calendar subscriptions */}
          <div className="mt-4 pt-4" style={{ borderTop: '1px dashed var(--border)' }}>
            <div className="text-[12.5px] font-extrabold mb-1">Subscribe to a real calendar feed (read-only)</div>
            <p className="text-[11.5px] mb-2" style={{ color: 'var(--muted)' }}>
              Paste any public <b style={{ color: 'var(--text)' }}>.ics / iCal URL</b> — e.g. Google Calendar → Settings → your calendar → “Secret address in iCal format”, an iCloud public-calendar link, or a team events feed.
              New feed events land on your Calendar marked <b style={{ color: 'var(--text)' }}>FEED</b>.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input className="input flex-1 min-w-[240px]" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                value={feedUrl} onChange={e => setFeedUrl(e.target.value)} />
              <label className="flex items-center gap-1.5 text-[11.5px] cursor-pointer" style={{ color: 'var(--muted)' }}
                title="Google/iCloud block direct browser reads (CORS). A public read-only relay can fetch PUBLIC feeds only — never private or secret URLs.">
                <input type="checkbox" checked={feedRelay} onChange={e => setFeedRelay(e.target.checked)} />
                route via relay if blocked
              </label>
              <button className="btn btn-primary btn-sm" disabled={!feedUrl.trim() || feedBusy}
                onClick={async () => { setFeedBusy(true); const f = addIcsFeed(feedUrl, { viaProxy: feedRelay }); await syncIcsFeed(f); setFeedBusy(false); setFeedUrl('') }}>
                {feedBusy ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />} Subscribe & sync
              </button>
            </div>
            {!!icsFeeds.length && (
              <div className="mt-3 flex flex-col gap-2">
                {icsFeeds.map(f => (
                  <div key={f.id} className="flex flex-wrap items-center gap-2 text-[12px] rounded-xl px-3 py-2" style={{ background: 'var(--cardbg)', border: '1px solid var(--border)' }}>
                    <span className="truncate flex-1 min-w-[180px]" title={f.url}>{f.url}</span>
                    {f.lastVia && <Pill color="#818cf8">{f.lastVia}</Pill>}
                    <span style={{ color: 'var(--faint)' }}>{f.lastSync ? `${f.lastCount} feed events · ${tsRel(f.lastSync)}` : 'never synced'}</span>
                    {f.error && <span style={{ color: '#f87171' }}>⚠ {f.error}</span>}
                    <button className="btn btn-ghost btn-sm" title="Re-sync feed" onClick={() => syncIcsFeed(f.id)}><RefreshCw size={12} /></button>
                    <button className="btn btn-ghost btn-sm" title="Remove feed + its imported events" onClick={() => removeIcsFeed(f.id)}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* ── deep actions ── */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Send size={15} style={{ color: '#f472b6' }} />
            <h3 className="text-[14px] font-extrabold">Deep actions</h3>
          </div>
          <p className="text-[12px] mb-4" style={{ color: 'var(--muted)' }}>
            Built into the contact sheet — zero setup, always live: <b style={{ color: 'var(--text)' }}>tel:</b> dialer, <b style={{ color: 'var(--text)' }}>wa.me</b> chat, Gmail/Outlook compose links, and Web Share of the full vCard.
          </p>
          <div className="card p-3.5 text-[12px] flex flex-col gap-1.5" style={{ borderRadius: 12, fontFamily: 'monospace', background: 'var(--cardbg2)' }}>
            <div>tel:+880… → opens phone dialer</div>
            <div>wa.me/880… → WhatsApp chat (no API)</div>
            <div>mail.google.com/?view=cm&to=… → compose</div>
            <div>share sheet → the raw .vcf card</div>
          </div>
          <p className="text-[11px] mt-3" style={{ color: 'var(--faint)' }}>
            Try it: open any contact and look for the Call / WhatsApp / Gmail / Share buttons.
          </p>
        </Card>
      </div>
    </div>
  )
}
