import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mail, MailPlus, RefreshCw, Unplug, CheckCircle2, ArrowDownLeft, ArrowUpRight,
  Loader2, ShieldCheck, Inbox, UserRound
} from 'lucide-react'
import { useCrm } from '../store'
import { Card, SectionHead, Seg, Empty, Avatar, CsvButton } from '../components/ui'
import { tsRel } from '../lib'

const PROVIDERS = [
  { id: 'gmail',   name: 'Gmail',   color: '#ea4335', desc: 'Live · Google OAuth · read-only gmail.readonly' },
  { id: 'outlook', name: 'Outlook', color: '#0a78d4', desc: 'Not available in this build — it needs a Microsoft OAuth app and a server to hold the token' },
]

export default function EmailPage() {
  const {
    mailboxes, emails, contactById, googleClientId,
    connectMailbox, disconnectMailbox, syncMailbox, logEmailTouch, triageEmailAsLead, ignoreEmail,
  } = useCrm()
  const nav = useNavigate()
  const [busy, setBusy] = useState('')     // 'connect:gmail' | 'sync:outlook' | ''
  const [seg, setSeg] = useState('all')

  const anyConnected = PROVIDERS.some(p => mailboxes[p.id].connected)
  const counts = {
    all: emails.length,
    triage: emails.filter(e => e.status === 'pending' && !e.matchedContactId).length,
    matched: emails.filter(e => e.matchedContactId).length,
    logged: emails.filter(e => e.status === 'logged').length,
  }
  const visible = emails.filter(e =>
    seg === 'all' ? true :
    seg === 'triage' ? e.status === 'pending' && !e.matchedContactId :
    seg === 'matched' ? !!e.matchedContactId : e.status === 'logged')

  const connect = async p => { setBusy('connect:' + p); await connectMailbox(p); setBusy('') }
  const sync = async p => { setBusy('sync:' + p); await syncMailbox(p); setBusy('') }

  const statusChip = e => {
    if (e.status === 'logged')   return <span className="chip" style={{ color: '#34d399', borderColor: '#34d39944', background: '#34d39914' }}><CheckCircle2 size={11} /> Logged</span>
    if (e.status === 'triaged')  return <span className="chip" style={{ color: '#a78bfa', borderColor: '#a78bfa44', background: '#a78bfa14' }}><UserRound size={11} /> Lead created</span>
    if (e.status === 'ignored')  return <span className="chip" style={{ color: 'var(--faint)' }}>Ignored</span>
    if (e.matchedContactId)      return <span className="chip" style={{ color: '#818cf8', borderColor: '#818cf844', background: '#818cf814' }}>Matched → {contactById[e.matchedContactId]?.name.split(' ')[0]}</span>
    return <span className="chip" style={{ color: '#fbbf24', borderColor: '#fbbf2444', background: '#fbbf2414' }}>New sender</span>
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHead kicker="REQUIRES INTEGRATION · 8b" title="Email Integration"
        sub="Pull conversations in from Gmail / Outlook, match them to contacts, and log touchpoints in one click"
        right={emails.length > 0 && <CsvButton filename="emails.csv" rows={emails} headers={[
          { label: 'Name', get: r => r.name }, { label: 'Email', get: r => r.email },
          { label: 'Direction', get: r => r.dir === 'in' ? 'incoming' : 'outgoing' },
          { label: 'Subject', get: r => r.subject }, { label: 'Provider', get: r => r.provider },
          { label: 'When', get: r => r.ts }, { label: 'Status', get: r => r.status },
          { label: 'Matched contact', get: r => contactById[r.matchedContactId]?.name || '' },
        ]} />} />

      {/* connectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROVIDERS.map(p => {
          const mb = mailboxes[p.id]
          const count = emails.filter(e => e.provider === p.id).length
          return (
            <Card key={p.id} className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl grid place-items-center flex-none" style={{ background: p.color + '1c', color: p.color }}>
                <Mail size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-extrabold">{p.name}</span>
                  <span className="dot" style={{ background: mb.connected ? '#34d399' : '#6b7382' }} />
                  {mb.connected && <span className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: '#34d399' }}>Connected</span>}
                </div>
                <div className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--muted)' }}>
                  {mb.connected ? `${mb.address} · ${count} msgs · synced ${tsRel(mb.lastSync)}` : p.desc}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-none">
                {mb.connected ? (
                  <>
                    <button className="btn btn-ghost btn-sm" disabled={busy === 'sync:' + p.id} onClick={() => sync(p.id)}>
                      {busy === 'sync:' + p.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sync
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => disconnectMailbox(p.id)}><Unplug size={13} /></button>
                  </>
                ) : p.id === 'outlook' ? (
                  <span className="chip" style={{ opacity: .7 }} title="Microsoft sign-in needs an OAuth app of our own plus a server to hold the token — this app has neither, and stays that way by design">Not in this build</span>
                ) : !googleClientId ? (
                  <button className="btn btn-primary btn-sm" onClick={() => nav('/settings')}>Set up live mode</button>
                ) : (
                  <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => connect(p.id)}>
                    {busy === 'connect:' + p.id ? <><Loader2 size={13} className="animate-spin" /> Authorizing…</> : 'Connect'}
                  </button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
      <p className="text-[11.5px] flex items-center gap-1.5 -mt-2" style={{ color: 'var(--faint)' }}>
        <ShieldCheck size={12} /> Gmail connects with READ-ONLY Google OAuth using your own Client ID — tokens stay in this browser and every sync lands in the audit log.
      </p>

      {/* stats + filter */}
      {anyConnected && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip"><Inbox size={12} /> {counts.all} scanned</span>
          <span className="chip" style={{ color: '#818cf8' }}>{counts.matched} matched to contacts</span>
          <span className="chip" style={{ color: '#fbbf24' }}>{counts.triage} need triage</span>
          <span className="chip" style={{ color: '#34d399' }}>{counts.logged} logged as touchpoints</span>
          <div className="ml-auto">
            <Seg value={seg} onChange={setSeg} options={[
              { value: 'all', label: `All (${counts.all})` },
              { value: 'triage', label: `Needs triage (${counts.triage})` },
              { value: 'matched', label: `Matched (${counts.matched})` },
              { value: 'logged', label: `Logged (${counts.logged})` },
            ]} />
          </div>
        </div>
      )}

      {/* message list */}
      {!anyConnected ? (
        <Card className="p-10">
          <Empty icon={Mail} title="No mailbox connected">
            Connect Gmail or Outlook above — conversations get scanned, matched to your contacts by email address,
            and anything unknown lands in triage for one-tap lead capture.
          </Empty>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-10"><Empty icon={Inbox} title="Nothing here">No messages match this filter — nice and tidy.</Empty></Card>
      ) : (
        <Card className="overflow-hidden">
          {visible.map((e, i) => {
            const cid = e.matchedContactId
            const Dir = e.dir === 'in' ? ArrowDownLeft : ArrowUpRight
            const dirColor = e.dir === 'in' ? '#38bdf8' : '#34d399'
            const c = cid ? contactById[cid] : null
            return (
              <div key={e.id} className="flex items-start gap-3.5 px-5 py-4"
                style={{ borderBottom: i < visible.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none', opacity: e.status === 'ignored' ? .5 : 1 }}>
                <div className="relative flex-none">
                  <Avatar name={e.name} size={38} />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full grid place-items-center"
                    style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                    <Dir size={10} style={{ color: dirColor }} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[13.5px] font-bold truncate">{e.name}</span>
                    <span className="text-[11.5px] truncate" style={{ color: 'var(--faint)' }}>{e.email}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md"
                      style={{ background: (e.provider === 'gmail' ? '#ea4335' : '#0a78d4') + '1c', color: e.provider === 'gmail' ? '#f87171' : '#60a5fa' }}>
                      {e.provider}
                    </span>
                    <span className="ml-auto text-[11px] flex-none" style={{ color: 'var(--faint)' }}>{tsRel(e.ts)}</span>
                  </div>
                  <div className="text-[13px] font-semibold mt-1 truncate">{e.subject}</div>
                  <div className="text-[12px] truncate" style={{ color: 'var(--muted)' }}>{e.snippet}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    {statusChip(e)}
                    {e.status === 'pending' && (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => logEmailTouch(e.id)}>
                          <CheckCircle2 size={13} /> Log touchpoint
                        </button>
                        {!cid && (
                          <button className="btn btn-ghost btn-sm" style={{ color: '#a78bfa' }} onClick={() => triageEmailAsLead(e.id)}>
                            <MailPlus size={13} /> Create lead
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--faint)' }} onClick={() => ignoreEmail(e.id)}>Ignore</button>
                      </>
                    )}
                    {cid && (
                      <button className="btn btn-ghost btn-sm" onClick={() => nav('/contacts')} style={{ color: 'var(--muted)' }}>
                        Open {c?.name.split(' ')[0]}'s sheet →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
