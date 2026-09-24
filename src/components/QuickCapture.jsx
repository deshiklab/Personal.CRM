import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, Mic, Square, ClipboardPaste, UserPlus, X, ArrowRight, StickyNote,
  CheckSquare, UserRound, History, Sparkles, Keyboard
} from 'lucide-react'
import { useCrm } from '../store'
import { daysAheadISO } from '../lib'

/* ── demo dictation lines for browsers without the Speech API ── */
const DEMO_LINES = [
  'New lead Tanvir Hasan phone 01711 552299 from the Dhaka trade expo',
  'Call Sharmin about the TradePort sponsorship renewal tomorrow',
  'Met Priyanka Sen at the conference, phone 01633 908070, interested in enterprise pricing',
  'Note for Rafiq: he loves hiking and photography - gift idea is a camera strap',
]

/* ── very small intent parser: voice text → lead / task / note ── */
const findPhone = s => { const m = s.match(/\+?[\d][\d\s\-()]{6,}\d/); return m ? m[0].replace(/[^\d+]/g, '') : '' }

function parseVoice(raw, contacts) {
  const t = raw.trim()
  const lower = t.toLowerCase()
  const phone = findPhone(t)
  if (/^(call|remind me to|remind|task[:\s])/.test(lower)) {
    const title = t.replace(/^remind me to\s*/i, '')
    const match = contacts.find(c => c.name.toLowerCase().split(' ').some(p => p.length > 3 && lower.includes(p)))
    return { kind: 'task', title: title.charAt(0).toUpperCase() + title.slice(1), due: /tomorrow/i.test(t) ? daysAheadISO(1) : null, contactId: match?.id || null, contactName: match?.name || null }
  }
  if (/note/i.test(lower) && !phone) {
    const m = t.match(/note\s+(?:for|about|re:?)?\s*([A-Za-z]+)/i)
    const who = m?.[1] || ''
    const c = contacts.find(x => who && x.name.toLowerCase().includes(who.toLowerCase()))
    return { kind: 'note', who: c?.name || who, contactId: c?.id || null, body: t }
  }
  const m = t.match(/(?:new lead|lead|met|add(?:ed)?|contact)\s+(.+?)(?=\s+(?:phone|number|ph\b|mobile|from|at|email|,)|$)/i)
  const name = (m?.[1] || '').replace(/[.,;]+$/, '').trim()
  return { kind: 'contact', name, phone, detail: t }
}

const KIND_META = {
  contact: { icon: UserRound, color: '#a78bfa', label: 'New lead' },
  task: { icon: CheckSquare, color: '#38bdf8', label: 'Task' },
  note: { icon: StickyNote, color: '#fbbf24', label: 'Note' },
}

export default function QuickCapture() {
  const { contacts, addContact, addTask, addNote, commitImport, toast, logActivity } = useCrm()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('lead')
  const [session, setSession] = useState([])       // this session's captures

  /* lead form */
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [err, setErr] = useState('')
  const nameRef = useRef(null)

  /* voice */
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [parsed, setParsed] = useState(null)
  const [demoIdx, setDemoIdx] = useState(0)
  const recRef = useRef(null)

  /* bulk */
  const [bulk, setBulk] = useState('')

  const push = (kind, label, sub) => setSession(s => [{ kind, label, sub, t: Date.now() }, ...s].slice(0, 8))
  const ago = t => { const s = Math.round((Date.now() - t) / 1000); return s < 5 ? 'just now' : s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago` }

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    if (open) { window.addEventListener('keydown', onKey); setTimeout(() => nameRef.current?.focus(), 60) }
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  /* ── lead save ─────────────────────────────────────────── */
  const saveLead = go => {
    if (!name.trim()) { setErr('A name is required'); nameRef.current?.focus(); return }
    const c = addContact({
      name: name.trim(), phone: phone.trim(), email: email.trim(), company: company.trim(),
      groupId: 'g_leads', rel: 'lead',
    })
    logActivity(`Quick-captured lead ${c.name}`, c.id)
    toast(`⚡ Lead saved: ${c.name.split(' ')[0]} — follow-up every 7d`)
    push('contact', c.name, c.phone || 'no number')
    setName(''); setPhone(''); setEmail(''); setCompany(''); setErr('')
    if (go) { setOpen(false); nav('/contacts') } else nameRef.current?.focus()
  }

  /* ── voice flow ────────────────────────────────────────── */
  const startReal = () => {
    try {
      const r = new SR()
      r.lang = 'en-US'; r.interimResults = true; r.continuous = false
      r.onresult = e => { const txt = Array.from(e.results).map(x => x[0].transcript).join(''); setTranscript(txt) }
      r.onend = () => { setListening(false) }
      r.onerror = () => { setListening(false); toast('Mic unavailable — try the simulate button', 'warn') }
      recRef.current = r; r.start(); setListening(true)
    } catch { setListening(false) }
  }
  const stopReal = () => { try { recRef.current?.stop() } catch {} setListening(false) }

  const simulate = () => {
    setListening(true); setTranscript(''); setParsed(null)
    const line = DEMO_LINES[demoIdx % DEMO_LINES.length]
    setDemoIdx(i => i + 1)
    let i = 0
    const iv = setInterval(() => {
      i += 3 + Math.floor(Math.random() * 4)
      setTranscript(line.slice(0, i))
      if (i >= line.length) { clearInterval(iv); setListening(false); setTranscript(line) }
    }, 40)
  }

  useEffect(() => { if (!listening && transcript) setParsed(parseVoice(transcript, contacts)) }, [listening, transcript]) // eslint-disable-line

  const saveParsed = () => {
    if (!parsed) return
    if (parsed.kind === 'contact') {
      if (!parsed.name) { toast('Could not find a name — edit and retry', 'warn'); return }
      const c = addContact({ name: parsed.name, phone: parsed.phone || '', company: '', groupId: 'g_leads', rel: 'lead' })
      logActivity(`Voice-captured lead ${c.name}`, c.id)
      toast(`🎙️ Lead saved: ${c.name.split(' ')[0]}`)
      push('contact', c.name, c.phone || 'no number')
    } else if (parsed.kind === 'task') {
      const t = addTask({ title: parsed.title, due: parsed.due, contactId: parsed.contactId, priority: 'med' })
      logActivity(`Voice-captured task: ${t.title}`, t.contactId)
      toast('🎙️ Task added to your board')
      push('task', parsed.title, parsed.due ? `due ${parsed.due}` : 'no due date')
    } else {
      const n = addNote({ title: `Voice note${parsed.who ? ` — ${parsed.who}` : ''}`, body: parsed.body, contactIds: parsed.contactId ? [parsed.contactId] : [], tags: [] })
      logActivity(`Voice-captured note for ${parsed.who || 'general'}`, n.contactIds?.[0] || null)
      toast('🎙️ Note saved')
      push('note', parsed.who ? `Note — ${parsed.who}` : 'Note', parsed.contactId ? 'linked to contact' : 'unlinked')
    }
    setTranscript(''); setParsed(null)
  }

  /* ── bulk paste ────────────────────────────────────────── */
  const bulkRows = bulk.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const parts = l.split(/[,;\t·]| - /).map(x => x.trim()).filter(Boolean)
    const phoneIdx = parts.findIndex(p => /[\d]{6,}/.test(p.replace(/[^\d]/g, '')))
    const emailIdx = parts.findIndex(p => /@/.test(p))
    return { name: parts.find((_, i) => i !== phoneIdx && i !== emailIdx) || '', phone: phoneIdx > -1 ? parts[phoneIdx] : '', email: emailIdx > -1 ? parts[emailIdx] : '' }
  }).filter(r => r.name)

  const doBulk = () => {
    if (!bulkRows.length) return
    const batch = commitImport(bulkRows.map(r => ({ name: r.name, phone: r.phone, email: r.email })), 'quick-capture · mobile')
    toast(`⚡ Imported ${batch.added} new · ${batch.updated} updated · ${batch.skipped} skipped`)
    bulkRows.forEach(r => push('contact', r.name, r.phone || 'merged'))
    setBulk('')
  }

  const Tab = ({ id, icon: Icon, children }) => (
    <button onClick={() => setTab(id)}
      className={`chip chip-btn ${tab === id ? 'on' : ''}`} style={{ padding: '7px 13px', fontSize: 12.5 }}>
      <Icon size={14} /> {children}
    </button>
  )

  return (
    <>
      {/* ── Floating Action Button ── */}
      <button onClick={() => { setOpen(true); setTab('lead') }}
        data-tip="quickcapture.fab" data-tour="fab"
        className="safe-bottom fixed z-[60] flex items-center justify-center gap-2 font-bold transition-transform hover:scale-105 active:scale-95 right-4 bottom-4 w-14 h-14 rounded-full md:right-6 md:bottom-6 md:w-auto md:h-auto md:rounded-2xl md:px-5 md:py-3.5"
        style={{ background: 'linear-gradient(120deg,var(--i1),var(--i2))', color: '#0a0c11', boxShadow: '0 10px 30px rgba(129,140,248,.4)', fontSize: 13.5 }}
        title="Quick Capture (name + number → lead)">
        <Zap size={20} />
        <span className="hidden md:inline">Quick Capture</span>
        {session.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-extrabold"
            style={{ background: '#f43f5e', color: '#fff', boxShadow: '0 2px 8px rgba(244,63,94,.5)' }}>{session.length}</span>
        )}
      </button>

      {/* ── Bottom sheet (mobile-first) / dialog (desktop) ── */}
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0" style={{ background: 'rgba(4,6,10,.66)', backdropFilter: 'blur(3px)' }} onClick={() => setOpen(false)} />
          <div className="panel safe-bottom relative w-full md:max-w-lg max-h-[92vh] md:max-h-[86vh] overflow-y-auto rounded-t-3xl md:rounded-3xl p-5 md:p-6"
            style={{ borderBottom: '0', animation: 'qc-up .22s ease-out' }}>
            <style>{`@keyframes qc-up{from{transform:translateY(24px);opacity:.4}to{transform:none;opacity:1}}`}</style>

            <div className="mx-auto mb-3 h-1 w-10 rounded-full md:hidden" style={{ background: 'var(--border2)' }} />

            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Zap size={16} style={{ color: 'var(--i2)' }} />
                  <h2 className="text-base font-extrabold">Quick Capture</h2>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>One tap — name + number, saved as a lead. Zero friction.</p>
              </div>
              <button className="icon-btn" onClick={() => setOpen(false)}><X size={15} /></button>
            </div>

            <div className="flex items-center gap-2 mb-5">
              <Tab id="lead" icon={UserPlus}>Lead</Tab>
              <Tab id="voice" icon={Mic}>Voice</Tab>
              <Tab id="bulk" icon={ClipboardPaste}>Bulk paste</Tab>
            </div>

            {/* ── LEAD ── */}
            {tab === 'lead' && (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="label">Name *</label>
                    <input ref={nameRef} className="input" style={{ padding: '11px 13px', fontSize: 15 }}
                      placeholder="e.g. Tanvir Hasan" value={name}
                      onChange={e => { setName(e.target.value); setErr('') }}
                      onKeyDown={e => e.key === 'Enter' && saveLead(false)} />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input className="input" style={{ padding: '11px 13px', fontSize: 15 }} type="tel"
                      placeholder="01XXX XXXXXX" value={phone} onChange={e => setPhone(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveLead(false)} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input className="input" style={{ padding: '11px 13px', fontSize: 15 }}
                      placeholder="optional" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Company / context</label>
                    <input className="input" style={{ padding: '11px 13px', fontSize: 15 }}
                      placeholder="Where did you meet?" value={company} onChange={e => setCompany(e.target.value)} />
                  </div>
                </div>
                {err && <div className="text-xs mt-2 font-semibold" style={{ color: '#fb7185' }}>{err}</div>}
                <div className="flex items-center gap-2 mt-5">
                  <button className="btn btn-primary flex-1" style={{ padding: '11px 14px' }} onClick={() => saveLead(false)}>
                    <Zap size={15} /> Save & add another
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '11px 14px' }} onClick={() => saveLead(true)}>
                    Save & view contacts <ArrowRight size={14} />
                  </button>
                </div>
                <p className="text-[11px] mt-3 flex items-center gap-1.5" style={{ color: 'var(--faint)' }}>
                  <Sparkles size={11} /> Lands in <b style={{ color: '#a78bfa' }}>&nbsp;Leads&nbsp;</b> group · follow-up cadence every 7 days automatically
                </p>
              </div>
            )}

            {/* ── VOICE ── */}
            {tab === 'voice' && (
              <div>
                <div className="card p-4 flex flex-col items-center gap-3" style={{ borderRadius: 16 }}>
                  {listening ? (
                    <>
                      <div className="flex items-end gap-1 h-10">
                        {[...Array(9)].map((_, i) => (
                          <span key={i} className="w-1.5 rounded-full animate-pulse"
                            style={{ height: `${10 + (i * 13) % 28}px`, background: 'linear-gradient(180deg,var(--i1),var(--i2))', animationDelay: `${i * 90}ms` }} />
                        ))}
                      </div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--i2)' }}>Listening…</p>
                    </>
                  ) : (
                    <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
                      {SR ? 'Tap the mic and speak — e.g. “New lead Tanvir Hasan, phone 01711 552299”'
                          : 'Mic API not available here — use the simulator to demo hands-free dictation.'}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    {SR && (
                      <button className={`btn ${listening ? 'btn-danger' : 'btn-primary'}`} onClick={listening ? stopReal : startReal}>
                        {listening ? <><Square size={14} /> Stop</> : <><Mic size={15} /> Start talking</>}
                      </button>
                    )}
                    <button className="btn btn-ghost" onClick={simulate} disabled={listening}>
                      <Mic size={14} /> Simulate incoming audio
                    </button>
                  </div>
                </div>

                <label className="label mt-4">Transcript</label>
                <textarea className="input" rows={2} value={transcript} placeholder="…or type it like you said it"
                  onChange={e => { setTranscript(e.target.value); setParsed(null) }}
                  onBlur={() => transcript && setParsed(parseVoice(transcript, contacts))} />
                {transcript && !parsed && !listening && (
                  <button className="btn btn-ghost btn-sm mt-2" onClick={() => setParsed(parseVoice(transcript, contacts))}>
                    <Keyboard size={13} /> Parse transcript
                  </button>
                )}

                {parsed && (
                  <div className="card p-4 mt-3" style={{ borderRadius: 16, borderColor: `${KIND_META[parsed.kind].color}55` }}>
                    <div className="flex items-center gap-2 mb-2">
                      {(() => { const I = KIND_META[parsed.kind].icon; return <I size={14} style={{ color: KIND_META[parsed.kind].color }} /> })()}
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: KIND_META[parsed.kind].color }}>{KIND_META[parsed.kind].label}</span>
                      <span className="text-[10px] ml-auto" style={{ color: 'var(--faint)' }}>smart-parsed from speech</span>
                    </div>
                    {parsed.kind === 'contact' && (
                      <div className="flex items-center gap-2">
                        <input className="input" value={parsed.name} onChange={e => setParsed(p => ({ ...p, name: e.target.value }))} placeholder="Name" />
                        <input className="input" value={parsed.phone} onChange={e => setParsed(p => ({ ...p, phone: e.target.value }))} placeholder="Phone" />
                      </div>
                    )}
                    {parsed.kind === 'task' && (
                      <div className="text-sm" style={{ color: 'var(--text)' }}>
                        “{parsed.title}”
                        <div className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                          {parsed.due ? `Due ${parsed.due}` : 'No due date'}{parsed.contactName ? ` · linked to ${parsed.contactName}` : ''}
                        </div>
                      </div>
                    )}
                    {parsed.kind === 'note' && (
                      <div className="text-sm" style={{ color: 'var(--text)' }}>
                        {parsed.who ? <>For <b>{parsed.who}</b>{parsed.contactId ? '' : ' (no matching contact)'}</> : 'General note'}
                        <div className="text-[11px] mt-1 line-clamp-2" style={{ color: 'var(--muted)' }}>{parsed.body}</div>
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button className="btn btn-primary btn-sm" onClick={saveParsed}><Zap size={13} /> Save</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setParsed(null); setTranscript('') }}>Discard</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── BULK ── */}
            {tab === 'bulk' && (
              <div>
                <label className="label">One lead per line — Name, phone, email</label>
                <textarea className="input" rows={5} style={{ fontFamily: 'monospace', fontSize: 12.5 }}
                  placeholder={'Nadia Islam, 01700 112233, nadia@branding.co\nKamal Hossain · 01555 667788\nJitu Rahman, 01811 009988'}
                  value={bulk} onChange={e => setBulk(e.target.value)} />
                <div className="flex items-center gap-2 mt-3">
                  <button className="btn btn-primary flex-1" disabled={!bulkRows.length} onClick={doBulk}>
                    <ClipboardPaste size={14} /> Import {bulkRows.length || ''} lead{bulkRows.length === 1 ? '' : 's'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setOpen(false); nav('/history') }}>
                    <History size={14} /> Import history
                  </button>
                </div>
                <p className="text-[11px] mt-3" style={{ color: 'var(--faint)' }}>
                  Runs through the standard import pipeline — deduped by name, diffed, and rollback-able from History.
                </p>
              </div>
            )}

            {/* ── session tray ── */}
            {session.length > 0 && (
              <div className="mt-6">
                <div className="label" style={{ marginBottom: 8 }}>Captured this session</div>
                <div className="flex flex-col gap-1.5">
                  {session.slice(0, 5).map((s, i) => {
                    const I = KIND_META[s.kind]?.icon || UserRound
                    return (
                      <div key={i} className="flex items-center gap-2.5 text-xs px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}>
                        <I size={13} style={{ color: KIND_META[s.kind]?.color }} />
                        <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>{s.label}</span>
                        <span className="truncate" style={{ color: 'var(--muted)' }}>{s.sub}</span>
                        <span className="ml-auto flex-none" style={{ color: 'var(--faint)' }}>{ago(s.t)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
