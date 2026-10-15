import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileUp, Upload, ScanLine, CheckCircle2, AlertTriangle, MinusCircle, ArrowRight, Smartphone, ContactRound, Info } from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Pill, Card, Empty } from '../components/ui'
import { tsRel, todayISO } from '../lib'
import { matchExisting } from '../lib/contacts'
import { canReadPhoneContacts, contactPickerAvailable, phoneContactsAvailable, readPhoneContacts, readHint } from '../lib/contacts-native'

const SAMPLE = `BEGIN:VCARD
VERSION:3.0
FN:Vikram Rao
TEL;TYPE=CELL:+91 98200 99001
EMAIL:vikram.rao@finedge.io
ORG:FinEdge
BDAY:1988-09-18
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Nadia Islam
TEL;TYPE=CELL:+880 1712-901122
EMAIL:nadia.islam@gmail.com
ORG:Grameenphone
BDAY:1994-03-08
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Omar Faruk
TEL;TYPE=CELL:+880 1555-776655
EMAIL:omar.faruk@outlook.com
ORG:Robi Axiata
END:VCARD`

function parseVcf(text) {
  const cards = []
  const blocks = text.split(/BEGIN:VCARD/i).slice(1)
  for (const b of blocks) {
    const get = re => { const m = b.match(re); return m ? m[1].trim() : '' }
    const name = get(/(?:^|\n)FN.*?:(.+)/i)
    if (!name) continue
    const phones = [...b.matchAll(/(?:^|\n)TEL[^:]*:([+\d][\d\s\-()]+)/gi)].map(m => m[1].trim())
    let bday = get(/(?:^|\n)BDAY.*?:(.+)/i)
    if (/^\d{8}$/.test(bday)) bday = `${bday.slice(0, 4)}-${bday.slice(4, 6)}-${bday.slice(6, 8)}`
    cards.push({
      name,
      phone: phones[0] || '',
      email: get(/(?:^|\n)EMAIL[^:]*:(.+)/i),
      org: get(/(?:^|\n)ORG.*?:(.+)/i),
      bday: /^\d{4}-\d{2}-\d{2}$/.test(bday) ? bday : null,
    })
  }
  return cards
}

export default function ImportPage() {
  const { contacts, imports, commitImport, toast } = useCrm()
  const [raw, setRaw] = useState('')
  const [rows, setRows] = useState(null)
  const [source, setSource] = useState('pasted.vcf')
  const [phoneBusy, setPhoneBusy] = useState(false)
  const [phoneErr, setPhoneErr] = useState(null)
  const [params, setParams] = useSearchParams()
  const autoFired = useRef(false)

  /* X2 — a scanned business-card QR hands its vCard text over here */
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('pcrm-vcard-in')
      if (pending) {
        sessionStorage.removeItem('pcrm-vcard-in')
        setRaw(pending)
        setRows(null)
        setSource('qr-scan.vcf')
      }
    } catch { /* private mode */ }
  }, [])

  /* diff preview — same matching rules as the commit */
  const analyzed = useMemo(() => {
    if (!rows) return null
    return rows.map(r => {
      const ex = matchExisting(contacts, r)
      if (!ex) return { ...r, status: 'new' }
      const diff = (r.phone && r.phone !== ex.phone) || (r.email && r.email !== ex.email) || (r.org && r.org !== ex.company) || (r.bday && r.bday !== ex.birthday)
      return { ...r, status: diff ? 'update' : 'skip', existing: ex }
    })
  }, [rows, contacts])

  const counts = analyzed ? {
    new: analyzed.filter(r => r.status === 'new').length,
    update: analyzed.filter(r => r.status === 'update').length,
    skip: analyzed.filter(r => r.status === 'skip').length,
  } : { new: 0, update: 0, skip: 0 }

  const onFile = e => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => { setRaw(String(reader.result || '')); setSource(f.name || 'upload.vcf') }
    reader.readAsText(f)
  }

  /* ── phone contacts import ── */
  const importFromPhone = async () => {
    setPhoneErr(null)
    if (!canReadPhoneContacts()) {
      setPhoneErr('unavailable')
      return
    }
    setPhoneBusy(true)
    const res = await readPhoneContacts()
    setPhoneBusy(false)
    if (!res.ok) {
      setPhoneErr(res.reason === 'denied' ? 'denied' : res.reason === 'cancelled' ? 'cancelled' : 'error')
      return
    }
    if (!res.rows.length) { setPhoneErr('empty'); return }
    setRows(res.rows)
    setRaw('')
    setSource(res.source === 'picker' ? 'chrome-contact-picker' : 'phone-contacts')
    toast(`📇 Found ${res.rows.length} contact(s) on your phone`)
  }

  /* /import?phone=1 — deep-link from the Contacts page */
  useEffect(() => {
    if (params.get('phone') === '1' && !autoFired.current) {
      autoFired.current = true
      importFromPhone()
      params.delete('phone')
      setParams(params, { replace: true })
    }
  }, [])

  return (
    <div className="max-w-[1000px] mx-auto">
      <SectionHead kicker="Data in / out" title="Import & Export"
        sub="From your phone, a .vcf file, or pasted vCards — every import shows a diff before anything is written, and stays one-click reversible." />

      {/* ── phone contacts ── */}
      <Card className="p-5 mb-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="w-10 h-10 rounded-xl grid place-items-center flex-none" style={{ background: 'rgba(52,211,153,.15)', color: '#34d399' }}>
            <Smartphone size={18} />
          </div>
          <div className="flex-1 min-w-[240px]">
            <h3 className="font-bold text-[14.5px] inline-flex items-center gap-2">From your phone
              {phoneContactsAvailable() && <Pill color="#34d399">Android</Pill>}
              {!phoneContactsAvailable() && contactPickerAvailable() && <Pill color="#38bdf8">Contact picker</Pill>}
            </h3>
            <div className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>{readHint()}</div>
            {phoneErr && (
              <div className="text-[11.5px] mt-1.5 inline-flex items-center gap-1.5" style={{ color: '#fbbf24' }}>
                <Info size={12} />
                {phoneErr === 'denied' && 'Permission denied — allow Contacts access in Android Settings → Apps → Personal CRM.'}
                {phoneErr === 'unavailable' && 'No phone contact access here. Install the Android app, or drop a .vcf file below.'}
                {phoneErr === 'cancelled' && 'Picker closed without selecting anyone.'}
                {phoneErr === 'empty' && 'No contacts with a name were found.'}
                {phoneErr === 'error' && 'Could not read phone contacts.'}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" disabled={phoneBusy || !canReadPhoneContacts()} onClick={importFromPhone}>
              <ContactRound size={13} /> {phoneBusy ? 'Reading…' : 'Import from phone'}
            </button>
          </div>
        </div>
      </Card>

      {/* ── vCard scanner ── */}
      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-bold text-[14.5px] inline-flex items-center gap-2"><ScanLine size={16} style={{ color: 'var(--i2)' }} /> vCard scanner</h3>
          <div className="flex gap-2">
            <label className="btn btn-ghost btn-sm cursor-pointer">
              <Upload size={13} /> Upload .vcf
              <input type="file" accept=".vcf,text/vcard,text/plain" className="hidden" onChange={onFile} />
            </label>
            <button className="btn btn-ghost btn-sm" onClick={() => { setRaw(SAMPLE); setRows(null); setSource('sample.vcf') }}>Load sample</button>
          </div>
        </div>
        <textarea className="input font-mono" style={{ fontSize: 12 }} rows={8} placeholder="Paste vCard 3.0 content here (BEGIN:VCARD …)"
          value={raw} onChange={e => { setRaw(e.target.value); setRows(null); setSource('pasted.vcf') }} />
        <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
          <span className="text-[12px]" style={{ color: 'var(--faint)' }}>{raw ? `${(raw.match(/BEGIN:VCARD/gi) || []).length} card(s) detected` : 'Supports vCard 2.1 / 3.0 / 4.0'}</span>
          <button className="btn btn-primary btn-sm" disabled={!(raw || '').trim()}
            onClick={() => { const r = parseVcf(raw); setRows(r); r.length ? toast(`Parsed ${r.length} contact(s)`) : toast('No parsable vCards found', 'warn') }}>
            <ScanLine size={13} /> Scan
          </button>
        </div>
      </Card>

      {analyzed && (
        <Card className="p-5 mt-4 fadein">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 className="font-bold text-[14.5px]">Preview diff <span className="text-[11px] font-semibold ml-1.5" style={{ color: 'var(--faint)' }}>from {source}</span></h3>
            <div className="flex gap-2">
              <Pill color="#34d399">{counts.new} new</Pill>
              <Pill color="#fbbf24">{counts.update} update</Pill>
              <Pill color="#6b7382">{counts.skip} unchanged</Pill>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table min-w-[640px]">
              <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Org</th><th>Status</th></tr></thead>
              <tbody>
                {analyzed.map((r, i) => (
                  <tr key={i}>
                    <td className="font-semibold text-[13px]">{r.name}</td>
                    <td className="text-[12.5px]" style={{ color: r.existing && r.phone !== r.existing.phone ? '#fbbf24' : 'var(--muted)' }}>{r.phone || '—'}</td>
                    <td className="text-[12.5px]" style={{ color: 'var(--muted)' }}>{r.email || '—'}</td>
                    <td className="text-[12.5px]" style={{ color: 'var(--muted)' }}>{r.org || '—'}</td>
                    <td>
                      {r.status === 'new' && <Pill color="#34d399"><CheckCircle2 size={11} /> New</Pill>}
                      {r.status === 'update' && <Pill color="#fbbf24"><AlertTriangle size={11} /> Update</Pill>}
                      {r.status === 'skip' && <Pill color="#6b7382"><MinusCircle size={11} /> Skip</Pill>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end mt-4">
            <button className="btn btn-primary" disabled={counts.new + counts.update === 0}
              onClick={() => {
                commitImport(analyzed, todayISO() + '-' + source,
                  source === 'phone-contacts' || source === 'chrome-contact-picker'
                    ? { rel: 'acquaintance', groupId: null } : {})
                setRaw(''); setRows(null); toast('Import complete')
              }}>
              <FileUp size={14} /> Import {counts.new + counts.update} contact(s)
            </button>
          </div>
        </Card>
      )}

      <Card className="p-5 mt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-[14.5px]">Recent imports</h3>
          <Link to="/history" className="text-[12px] font-semibold inline-flex items-center gap-1" style={{ color: 'var(--i2)' }}>
            Full history, diffs & rollback <ArrowRight size={12} />
          </Link>
        </div>
        {imports.length === 0 && <Empty icon={FileUp} title="No imports yet" />}
        {imports.slice(0, 3).map(b => (
          <div key={b.id} className="flex items-center gap-3 py-2.5 border-b last:border-0 flex-wrap" style={{ borderColor: 'rgba(255,255,255,.05)' }}>
            <FileUp size={15} className="flex-none" style={{ color: 'var(--i1)' }} />
            <span className="font-semibold text-[13px]">{b.source}</span>
            <span className="text-[11.5px]" style={{ color: 'var(--faint)' }}>{tsRel(b.ts)}</span>
            <div className="ml-auto flex gap-1.5">
              <Pill color="#34d399">+{b.added}</Pill>
              <Pill color="#fbbf24">~{b.updated}</Pill>
              {b.skipped > 0 && <Pill color="#6b7382">={b.skipped}</Pill>}
              {b.rolledBack && <Pill color="#6b7382">rolled back</Pill>}
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}
