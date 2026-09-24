import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, UserPlus, Star, Phone, Mail, Cake, Users, Clock, CheckCircle2, StickyNote, X, Heart, Gift, Globe, MessageCircle, Link2, Share2, Pencil, Trash2, Download, UsersRound, ScanLine, Camera, ImagePlus, IdCard, ZoomIn } from 'lucide-react'
import { toVCF, downloadVCF } from '../lib/vcard'
import { useCrm } from '../store'
import { SectionHead, Avatar, TagPill, Pill, Modal, Drawer, Field, Empty, EVENT_COLORS, CsvButton } from '../components/ui'
import { relDay, fmtHuman, tsRel } from '../lib'
import { contactGroupIds } from '../store'
import PinConfirm from '../components/PinConfirm'
import CardScanModal, { CardThumb } from '../components/CardScanModal'
import { pickAndCompress } from '../lib/media'
import VirtualList from '../components/VirtualList'

const ST_TONE = { overdue: '#fb7185', 'due-soon': '#fbbf24', ok: '#34d399', snoozed: '#94a3b8' }
const ST_LABEL = { overdue: 'Overdue', 'due-soon': 'Due soon', ok: 'In touch', snoozed: 'Snoozed' }

export const SOCIAL_META = {
  linkedin:  { label: 'LinkedIn',  mark: 'in',           color: '#2b9ede' },
  twitter:   { label: 'X / Twitter', mark: '𝕏',          color: '#e7e9ea' },
  instagram: { label: 'Instagram', mark: '◉',            color: 'var(--t-pink)' },
  facebook:  { label: 'Facebook',  mark: 'f',            color: '#60a5fa' },
  whatsapp:  { label: 'WhatsApp',  Icon: MessageCircle,  color: '#4ade80' },
  website:   { label: 'Website',   Icon: Globe,          color: 'var(--t-slate)' },
}
export const socHref = (p, v) => {
  if (!v) return '#'
  if (/^https?:\/\//.test(v)) return v
  if (p === 'whatsapp') return `https://wa.me/${v.replace(/[^\d]/g, '')}`
  return `https://${v}`
}
export const socLabel = v => v.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

export default function Contacts() {
  const crm = useCrm()
  const { contacts, groups, tags, followUpStatus, groupById, isPro, FREE_LIMITS } = crm
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [groupF, setGroupF] = useState(params.get('group') || '')
  const [tagF, setTagF] = useState(params.get('tag') || '')
  const [sort, setSort] = useState('name')
  const [openId, setOpenId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [sel, setSel] = useState([])            // ids ticked for bulk actions
  const [editId, setEditId] = useState(null)    // contact being edited (null = none)
  const [confirm, setConfirm] = useState(null)  // { ids, label } pending delete
  const [scanOpen, setScanOpen] = useState(false)
  const [scanFor, setScanFor] = useState(null)   // contact to attach a card to, or null = new
  const [lightbox, setLightbox] = useState(null) // data-URL of card/photo to preview

  useEffect(() => {
    let dirty = false
    if (params.get('new') === '1') { setAddOpen(true); params.delete('new'); dirty = true }
    const o = params.get('open')
    if (o) { setOpenId(o); params.delete('open'); dirty = true }
    if (dirty) setParams(params, { replace: true })
  }, [])

  const list = useMemo(() => {
    let xs = contacts.filter(c => {
      const text = (c.name + ' ' + (c.company || '') + ' ' + (c.role || '') + ' ' + (c.interests || []).join(' ') + ' ' + (c.introducedBy || '') + ' ' + Object.entries(c.socials || {}).map(([p, v]) => p + ':' + v).join(' ')).toLowerCase()
      if (q && !text.includes(q.toLowerCase())) return false
      if (groupF && !contactGroupIds(c).includes(groupF)) return false
      if (tagF && !c.tags.includes(tagF)) return false
      return true
    })
    if (sort === 'name') xs.sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'recent') xs.sort((a, b) => b.lastContact.localeCompare(a.lastContact))
    if (sort === 'overdue') xs.sort((a, b) => (followUpStatus(b).overdueBy || 0) - (followUpStatus(a).overdueBy || 0))
    return xs
  }, [contacts, q, groupF, tagF, sort, followUpStatus])

  const open = openId && crm.contactById[openId]

  const selSet = useMemo(() => new Set(sel), [sel])
  const toggleSel = id => setSel(x => x.includes(id) ? x.filter(v => v !== id) : [...x, id])
  const allSel = list.length > 0 && sel.length === list.length
  const toggleAll = () => setSel(allSel ? [] : list.map(c => c.id))
  const selContacts = useMemo(() => contacts.filter(c => selSet.has(c.id)), [contacts, selSet])
  const askDelete = ids => setConfirm({ ids, label: ids.length === 1 ? (crm.contactById[ids[0]]?.name || 'contact') : `${ids.length} contacts` })
  const runDelete = async ids => {
    if (ids.length === 1) crm.deleteContact(ids[0]); else crm.bulkDeleteContacts(ids)
    setSel(x => x.filter(v => !ids.includes(v)))
    if (openId && ids.includes(openId)) setOpenId(null)
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      <SectionHead kicker="Directory" title="Contacts"
        sub={`${contacts.length} people in your network · ${list.length} shown${!isPro() && Number.isFinite(FREE_LIMITS?.contacts) ? ` · Free plan ${contacts.length}/${FREE_LIMITS.contacts}` : ''}`}
        right={<div className="flex items-center gap-2">
          <CsvButton filename="contacts.csv" rows={crm.contacts} headers={[
            { label: 'Name', get: r => r.name }, { label: 'Role', get: r => r.role },
            { label: 'Company', get: r => r.company }, { label: 'Phone', get: r => r.phone },
            { label: 'Email', get: r => r.email },
            { label: 'Groups', get: r => contactGroupIds(r).map(id => crm.groupById[id]?.name).filter(Boolean).join('; ') },
            { label: 'Tags', get: r => (r.tags || []).map(t => crm.tagById[t]?.name).filter(Boolean).join('; ') },
            { label: 'Relationship', get: r => r.rel },
            { label: 'Birthday', get: r => r.birthday || '' },
            { label: 'Anniversary', get: r => r.anniversary || '' },
            { label: 'Last contact', get: r => r.lastContact },
            { label: 'Created', get: r => r.createdAt },
            { label: 'Starred', get: r => r.starred ? 'yes' : 'no' },
            { label: 'Gift ideas', get: r => r.giftIdeas || '' },
            { label: 'Introduced by', get: r => r.introducedBy || '' },
            { label: 'Interests', get: r => (r.interests || []).join('; ') },
            { label: 'Socials', get: r => Object.entries(r.socials || {}).map(([p, v]) => `${p}:${v}`).join('; ') },
          ]} />
          <button className="btn btn-ghost btn-sm" onClick={() => { setScanFor(null); setScanOpen(true) }} title="Snap a visiting card — OCR runs on this device">
            <ScanLine size={14} /> Scan card
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}><UserPlus size={14} /> Add contact</button>
        </div>} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
          <input className="input" style={{ paddingLeft: 38 }} placeholder="Search name, role, company…" data-tip="contacts.search" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input" style={{ width: 'auto' }} value={groupF} onChange={e => setGroupF(e.target.value)}>
          <option value="">All groups</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }} value={tagF} onChange={e => setTagF(e.target.value)}>
          <option value="">All tags</option>
          {tags.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }} value={sort} onChange={e => setSort(e.target.value)}>
          <option value="name">Sort: Name</option>
          <option value="recent">Sort: Recently contacted</option>
          <option value="overdue">Sort: Most overdue</option>
        </select>
      </div>

      {sel.length > 0 && (
        <div className="card p-3 mb-3 flex flex-wrap items-center gap-2 fadein" style={{ borderColor: 'var(--i1)55' }}>
          <span className="text-[13px] font-bold mr-1">{sel.length} selected</span>
          <button className="btn btn-ghost btn-sm" onClick={() => sel.forEach(id => crm.markContacted(id))}>
            <CheckCircle2 size={13} /> Mark contacted
          </button>
          <select className="input" style={{ width: 'auto' }} value="" aria-label="Add selected to group"
            onChange={e => { const v = e.target.value; if (v) { crm.bulkSetGroups(sel, [v], 'add'); e.target.value = '' } }}>
            <option value="">Add to group…</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="input" style={{ width: 'auto' }} value="" aria-label="Remove selected from group"
            onChange={e => { const v = e.target.value; if (v) { crm.bulkSetGroups(sel, [v], 'remove'); e.target.value = '' } }}>
            <option value="">Remove from group…</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="input" style={{ width: 'auto' }} value="" aria-label="Set group for selected"
            onChange={e => { const v = e.target.value; if (v) { crm.bulkSetGroups(sel, [v], 'set'); e.target.value = '' } }}>
            <option value="">Set group (replace)…</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="input" style={{ width: 'auto' }} value="" aria-label="Add tag to selected"
            onChange={e => { const v = e.target.value; if (v) { crm.bulkTag(sel, v, 'add'); e.target.value = '' } }}>
            <option value="">Add tag…</option>
            {tags.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
          </select>
          <select className="input" style={{ width: 'auto' }} value="" aria-label="Remove tag from selected"
            onChange={e => { const v = e.target.value; if (v) { crm.bulkTag(sel, v, 'remove'); e.target.value = '' } }}>
            <option value="">Remove tag…</option>
            {tags.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => downloadVCF(selContacts)} title="Download the selected cards as .vcf">
            <Download size={13} /> .vcf
          </button>
          <div className="flex-1" />
          <button className="btn btn-ghost btn-sm" onClick={() => setSel([])}>Clear</button>
          <button className="btn btn-danger btn-sm" onClick={() => askDelete(sel)}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}

      <div className="card overflow-hidden" role="region" aria-label="Contacts directory">
        {/* sticky header row */}
        <div className="hidden md:grid items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-[.08em]"
          style={{
            gridTemplateColumns: '34px 34px minmax(160px,1.4fr) minmax(100px,.9fr) minmax(100px,.9fr) 110px 100px 96px',
            color: 'var(--faint)', borderBottom: '1px solid var(--hairline)', background: 'var(--cardbg2)',
          }}
          role="row">
          <span role="columnheader">
            <input type="checkbox" checked={allSel} onChange={toggleAll} aria-label="Select all contacts"
              style={{ width: 15, height: 15, accentColor: 'var(--i1)', cursor: 'pointer' }} />
          </span>
          <span role="columnheader" className="sr-only">Star</span>
          <span role="columnheader">Name</span>
          <span role="columnheader">Groups</span>
          <span role="columnheader">Tags</span>
          <span role="columnheader">Follow-up</span>
          <span role="columnheader">Last contact</span>
          <span role="columnheader" className="sr-only">Actions</span>
        </div>

        {list.length === 0 ? (
          contacts.length === 0
            ? <Empty icon={Users} title="Your network starts here"
                steps={[
                  'Tap Add contact, or Scan card to fill the form from a visiting-card photo.',
                  'Tag them and put them in a group so they show up in Follow-ups.',
                  'Set how often you want to touch base — the app will remind you.',
                ]}
                action={() => setAddOpen(true)} actionLabel="Add your first contact"
                guide="people.contacts">
                Nobody is in the CRM yet. Everything else — follow-ups, birthdays, the graph — lights up once you add people.
              </Empty>
            : <Empty icon={Users} title="No contacts match">Try clearing filters, or search for a different name.</Empty>
        ) : (
          <VirtualList
            items={list}
            rowHeight={64}
            overscan={10}
            maxHeight={Math.min(720, Math.max(320, (typeof window !== 'undefined' ? window.innerHeight : 800) - 280))}
            ariaLabel={`${list.length} contacts`}
            role="list"
            getKey={(c) => c.id}
            renderRow={(c) => {
              const st = followUpStatus(c)
              const cgs = contactGroupIds(c)
              const isSel = selSet.has(c.id)
              return (
                <div
                  className="rowclick contact-row grid items-center gap-2 px-3"
                  onClick={() => setOpenId(c.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(c.id) } }}
                  role="button"
                  tabIndex={0}
                  data-tip-contact={c.id}
                  aria-label={`${c.name}${c.company ? ', ' + c.company : ''}`}
                  style={{
                    gridTemplateColumns: '34px 34px minmax(0,1fr)',
                    height: 64,
                    borderBottom: '1px solid var(--hairline)',
                    background: isSel ? 'var(--hover)' : undefined,
                    cursor: 'pointer',
                  }}
                >
                  <span onClick={e => e.stopPropagation()} className="grid place-items-center">
                    <input type="checkbox" checked={isSel} onChange={() => toggleSel(c.id)} aria-label={`Select ${c.name}`}
                      style={{ width: 15, height: 15, accentColor: 'var(--i1)', cursor: 'pointer' }} />
                  </span>
                  <span className="grid place-items-center"
                    onClick={e => { e.stopPropagation(); crm.toggleStar(c.id) }}
                    role="button" tabIndex={0} aria-label={c.starred ? `Unstar ${c.name}` : `Star ${c.name}`}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); crm.toggleStar(c.id) } }}>
                    <Star size={15} style={{ color: c.starred ? '#fbbf24' : 'var(--faint)' }} fill={c.starred ? '#fbbf24' : 'none'} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex items-center gap-3">
                    <Avatar name={c.name} photo={c.photo} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[13.5px] truncate">{c.name}</div>
                      <div className="text-[11.5px] truncate" style={{ color: 'var(--faint)' }}>{[c.role, c.company].filter(Boolean).join(' · ') || '—'}</div>
                      <div className="md:hidden flex items-center gap-2 mt-0.5 flex-wrap">
                        <Pill color={ST_TONE[st.state]}>{ST_LABEL[st.state]}{st.state === 'overdue' ? ` +${st.overdueBy}d` : ''}</Pill>
                        <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{relDay(c.lastContact)}</span>
                      </div>
                    </div>
                    {/* desktop meta columns */}
                    <div className="hidden md:grid items-center gap-2 flex-none" style={{ gridTemplateColumns: 'minmax(100px,.9fr) minmax(100px,.9fr) 110px 100px 96px', width: 'min(560px, 48vw)' }}>
                      <div>
                        {cgs.length === 0
                          ? <span className="text-[12px]" style={{ color: 'var(--faint)' }}>—</span>
                          : <div className="flex gap-1 flex-wrap">
                              {cgs.slice(0, 2).map(gid => groupById[gid] && <Pill key={gid} color={groupById[gid].color}>{groupById[gid].name}</Pill>)}
                              {cgs.length > 2 && <span className="chip">+{cgs.length - 2}</span>}
                            </div>}
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {(c.tags || []).slice(0, 3).map(tid => <TagPill key={tid} tag={crm.tagById[tid]} small />)}
                        {(c.tags || []).length > 3 && <span className="chip">+{c.tags.length - 3}</span>}
                      </div>
                      <div><Pill color={ST_TONE[st.state]}>{ST_LABEL[st.state]}{st.state === 'overdue' ? ` +${st.overdueBy}d` : ''}</Pill></div>
                      <div><span className="text-[12px] font-medium" style={{ color: 'var(--muted)' }}>{relDay(c.lastContact)}</span></div>
                      <div onClick={e => e.stopPropagation()} className="flex items-center gap-1 justify-end">
                        <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} title="Edit contact" aria-label={`Edit ${c.name}`}
                          onClick={() => setEditId(c.id)}><Pencil size={13} /></button>
                        <button type="button" className="icon-btn" style={{ width: 28, height: 28, color: 'var(--t-rose)' }} title="Delete contact" aria-label={`Delete ${c.name}`}
                          onClick={() => askDelete([c.id])}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }}
          />
        )}
        {list.length > 80 && (
          <div className="px-3 py-1.5 text-[11px] text-center" style={{ color: 'var(--faint)', borderTop: '1px solid var(--hairline)' }}>
            Showing {list.length.toLocaleString()} contacts · windowed list (smooth past 5 000)
          </div>
        )}
      </div>

      <Drawer open={!!open} onClose={() => setOpenId(null)}>
        {open && <ContactDrawer contact={open} onOpen={id => setOpenId(id)} onClose={() => setOpenId(null)}
          onEdit={id => setEditId(id)} onDelete={askDelete}
          onScanCard={ct => { setScanFor(ct); setScanOpen(true) }}
          onPreview={setLightbox} />}
      </Drawer>

      <ContactFormModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ContactFormModal open={!!editId} onClose={() => setEditId(null)} contact={editId ? crm.contactById[editId] : null} />

      <CardScanModal open={scanOpen} onClose={() => { setScanOpen(false); setScanFor(null) }} contact={scanFor} />

      {/* full-size preview of a photo or visiting card */}
      {lightbox && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4" style={{ background: 'rgba(0,0,0,.72)' }}
          onClick={() => setLightbox(null)}>
          <button className="icon-btn absolute top-4 right-4" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}
            onClick={() => setLightbox(null)}><X size={18} /></button>
          <img src={lightbox} alt="Preview" onClick={e => e.stopPropagation()}
            style={{ maxWidth: 'min(920px, 96vw)', maxHeight: '88vh', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.45)' }} />
        </div>
      )}

      <PinConfirm
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.ids.length === 1 ? 'Delete this contact?' : `Delete ${confirm?.ids.length || 0} contacts?`}
        confirmLabel={confirm?.ids.length === 1 ? 'Delete contact' : `Delete ${confirm?.ids.length || 0}`}
        message={confirm?.ids.length === 1
          ? <><b style={{ color: 'var(--text)' }}>{confirm.label}</b> will be removed from your CRM for good. Their tasks, events and notes stay in place — just unlinked.</>
          : <><b style={{ color: 'var(--text)' }}>{confirm?.ids.length} contacts</b> will be removed from your CRM for good. Their tasks, events and notes stay in place — just unlinked.</>}
        onConfirm={() => runDelete(confirm?.ids || [])} />
    </div>
  )
}

function ContactDrawer({ contact: c, onOpen, onClose, onEdit, onDelete, onScanCard, onPreview }) {
  const crm = useCrm()
  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [interestDraft, setInterestDraft] = useState('')
  const [socPlatform, setSocPlatform] = useState('linkedin')
  const [socDraft, setSocDraft] = useState('')
  const st = crm.followUpStatus(c)
  const cgs = contactGroupIds(c)
  const rel = crm.relFreq[c.rel]
  const myNotes = crm.notes.filter(n => n.contactIds.includes(c.id))
  const myEvents = crm.events.filter(e => e.contactId === c.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  const myActs = crm.activity.filter(a => a.contactId === c.id).slice(0, 5)

  const toggleTag = tid => {
    const has = c.tags.includes(tid)
    crm.updateContact(c.id, { tags: has ? c.tags.filter(x => x !== tid) : [...c.tags, tid] })
  }

  return (
    <div>
      <div className="flex items-start gap-4">
        <div className="relative flex-none group/av">
          <Avatar name={c.name} photo={c.photo} size={56} />
          <button type="button" className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full grid place-items-center"
            style={{ background: 'var(--cardbg)', border: '1px solid var(--border)', color: 'var(--t-indigo)' }}
            title={c.photo ? 'Change photo' : 'Add photo'}
            onClick={async () => {
              const r = await pickAndCompress({ maxEdge: 640, quality: 0.72, capture: 'user' })
              if (!r) return
              crm.updateContact(c.id, { photo: r.dataUrl })
              crm.toast?.('Photo saved on this device')
            }}>
            <Camera size={12} />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[18px] font-bold tracking-tight truncate">{c.name}</h3>
          <div className="text-[12.5px]" style={{ color: 'var(--muted)' }}>{[c.role, c.company].filter(Boolean).join(' · ') || 'No role set'}</div>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {cgs.map(gid => crm.groupById[gid] && <Pill key={gid} color={crm.groupById[gid].color}>{crm.groupById[gid].name}</Pill>)}
            {rel && <Pill color="#a78bfa">{rel.label} · every {rel.everyDays}d</Pill>}
            <Pill color={ST_TONE[st.state]}>{ST_LABEL[st.state]}{st.state === 'overdue' ? ` +${st.overdueBy}d` : ''}</Pill>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose}><X size={16} /></button>
      </div>

      {/* Photo + visiting card */}
      <div className="card p-3 mt-4">
        <div className="text-[10.5px] font-bold uppercase tracking-[.1em] mb-2" style={{ color: 'var(--faint)' }}>Photo & visiting card</div>
        <div className="flex flex-wrap items-stretch gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1 rounded-xl p-2"
            style={{ background: 'var(--cardbg2)', border: '1px solid var(--border)' }}>
            <Avatar name={c.name} photo={c.photo} size={40} />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold truncate">{c.photo ? 'Portrait on file' : 'No photo yet'}</div>
              <div className="text-[11px]" style={{ color: 'var(--faint)' }}>Stored on this device only</div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={async () => {
              const r = await pickAndCompress({ maxEdge: 640, quality: 0.72 })
              if (!r) return
              crm.updateContact(c.id, { photo: r.dataUrl })
              crm.toast?.('Photo saved')
            }}><Camera size={13} /> {c.photo ? 'Change' : 'Add'}</button>
            {c.photo && (
              <>
                <button type="button" className="icon-btn" title="View photo" onClick={() => onPreview?.(c.photo)}><ZoomIn size={13} /></button>
                <button type="button" className="icon-btn" title="Remove photo" style={{ color: 'var(--t-rose)' }}
                  onClick={() => { crm.updateContact(c.id, { photo: null }); crm.toast?.('Photo removed') }}><Trash2 size={13} /></button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1 rounded-xl p-2"
            style={{ background: 'var(--cardbg2)', border: '1px solid var(--border)' }}>
            {c.cardImage
              ? <CardThumb src={c.cardImage} size={64} onClick={() => onPreview?.(c.cardImage)} />
              : <div className="rounded-lg grid place-items-center flex-none" style={{ width: 64, height: 40, background: 'var(--chipbg)', color: 'var(--faint)' }}><IdCard size={18} /></div>}
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold truncate">{c.cardImage ? 'Visiting card on file' : 'No visiting card yet'}</div>
              <div className="text-[11px]" style={{ color: 'var(--faint)' }}>{c.cardImage ? 'Tap thumbnail to enlarge' : 'Scan or upload one'}</div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onScanCard?.(c)} title="Scan a visiting card for this person">
              <ScanLine size={13} /> {c.cardImage ? 'Rescan' : 'Scan'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" title="Upload a card image without OCR"
              onClick={async () => {
                const r = await pickAndCompress({ maxEdge: 1400, quality: 0.8 })
                if (!r) return
                crm.updateContact(c.id, { cardImage: r.dataUrl })
                crm.toast?.('Visiting card saved')
              }}><ImagePlus size={13} /> Upload</button>
            {c.cardImage && (
              <button type="button" className="icon-btn" title="Remove card" style={{ color: 'var(--t-rose)' }}
                onClick={() => { crm.updateContact(c.id, { cardImage: null }); crm.toast?.('Card removed') }}><Trash2 size={13} /></button>
            )}
          </div>
        </div>
      </div>

      {(() => {
        const digits = (c.phone || '').replace(/\D/g, '')
        const shareCard = async () => {
          const file = new File([toVCF(c)], `${c.name}.vcf`, { type: 'text/vcard' })
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], title: c.name }); return } catch { /* user cancelled */ return }
          }
          downloadVCF([c])
          crm.toast?.(`📇 ${c.name} downloaded as .vcf`)
        }
        return (
          <div className="flex gap-2 mt-2.5" style={{ flexWrap: 'wrap' }}>
            <span className="label w-full" style={{ marginBottom: -2 }}>Reach out directly</span>
            <a className="btn btn-ghost flex-1 justify-center" style={{ pointerEvents: digits ? 'auto' : 'none', opacity: digits ? 1 : 0.4 }}
               href={digits ? `tel:+${digits}` : '#'} title="Call through your phone dialer">
              <Phone size={14} /> Call
            </a>
            <a className="btn btn-ghost flex-1 justify-center" style={{ pointerEvents: digits ? 'auto' : 'none', opacity: digits ? 1 : 0.4 }}
               href={digits ? `https://wa.me/${digits}` : '#'} target="_blank" rel="noreferrer" title="Open WhatsApp chat (no API needed)">
              <MessageCircle size={14} /> WhatsApp
            </a>
            <a className="btn btn-ghost flex-1 justify-center" style={{ pointerEvents: c.email ? 'auto' : 'none', opacity: c.email ? 1 : 0.4 }}
               href={c.email ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(c.email)}` : '#'} target="_blank" rel="noreferrer" title="Compose in Gmail">
              <Mail size={14} /> Email
            </a>
            <button className="btn btn-ghost flex-1 justify-center" onClick={shareCard} title="Share the full contact card (.vcf) — works with phone share sheet">
              <Share2 size={14} /> Share card
            </button>
          </div>
        )
      })()}

      <div className="flex gap-2 mt-5">
        <button className="btn btn-primary flex-1" onClick={() => crm.markContacted(c.id)}><CheckCircle2 size={15} /> Log contact</button>
        <button className="btn btn-ghost" onClick={() => crm.createFollowUpTask(c.id)}>＋ Task</button>
        <button className="btn btn-ghost" onClick={() => crm.toggleStar(c.id)}>
          <Star size={15} style={{ color: c.starred ? '#fbbf24' : 'var(--muted)' }} fill={c.starred ? '#fbbf24' : 'none'} />
        </button>
      </div>

      <div className="flex gap-2 mt-2">
        <button className="btn btn-ghost flex-1 justify-center" onClick={() => onEdit?.(c.id)} title="Edit every field of this contact">
          <Pencil size={14} /> Edit details
        </button>
        <button className="btn btn-ghost flex-1 justify-center" onClick={() => onDelete?.([c.id])} title="Delete this contact (pincode required)"
          style={{ color: 'var(--t-rose)', borderColor: '#fb718544' }}>
          <Trash2 size={14} /> Delete contact
        </button>
      </div>

      <div className="card p-4 mt-5 flex flex-col gap-2.5 text-[13px]">
        {c.phone && <div className="flex items-center gap-3"><Phone size={14} style={{ color: 'var(--t-sky)' }} /> {c.phone}</div>}
        {c.email && <div className="flex items-center gap-3 truncate"><Mail size={14} style={{ color: 'var(--t-sky)' }} /> {c.email}</div>}
        {c.address && <div className="flex items-center gap-3"><Globe size={14} style={{ color: 'var(--t-sky)' }} /> {c.address}</div>}
        {c.birthday && <div className="flex items-center gap-3"><Cake size={14} style={{ color: 'var(--t-sky)' }} /> {fmtHuman(c.birthday)}</div>}
        <div className="flex items-center gap-3"><Clock size={14} style={{ color: 'var(--t-sky)' }} /> Last contacted {relDay(c.lastContact).toLowerCase()}</div>
        {c.anniversary && <div className="flex items-center gap-3"><Heart size={14} style={{ color: 'var(--t-sky)' }} /> Anniversary {fmtHuman(c.anniversary)}</div>}
        {c.giftIdeas && <div className="flex items-center gap-3"><Gift size={14} style={{ color: 'var(--t-sky)' }} /> {c.giftIdeas}</div>}
        {c.introducedBy && (() => {
          const who = crm.contacts.find(x => x.name === c.introducedBy)
          return (
            <div className="flex items-center gap-3 flex-wrap">
              <Users size={14} style={{ color: 'var(--t-sky)' }} /> Introduced by&nbsp;
              {who
                ? <button className="font-semibold underline decoration-dotted underline-offset-2 hover:opacity-80" style={{ color: 'var(--t-sky)' }} onClick={() => onOpen?.(who.id)}>{c.introducedBy}</button>
                : <strong>{c.introducedBy}</strong>}
              <span className="text-[11px]" style={{ color: 'var(--faint)' }}>— how you met</span>
            </div>
          )
        })()}
        {(() => {
          const introduced = crm.contacts.filter(x => x.introducedBy === c.name)
          return introduced.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <Users size={14} style={{ color: 'var(--t-violet)' }} />
              <span style={{ color: 'var(--muted)' }}>Introduced you to:</span>
              {introduced.map(x => (
                <button key={x.id} className="chip chip-btn" style={{ fontSize: 11 }} onClick={() => onOpen?.(x.id)}>{x.name.split(' ')[0]}</button>
              ))}
            </div>
          )
        })()}
      </div>

      <div className="mt-5">
        <div className="label">Social profiles</div>
        <div className="flex gap-1.5 flex-wrap items-center">
          {Object.entries(c.socials || {}).map(([p, v]) => {
            const m = SOCIAL_META[p] || { label: p, Icon: Link2, color: 'var(--t-slate)' }
            return (
              <a key={p} href={socHref(p, v)} target="_blank" rel="noreferrer"
                className="chip chip-btn group" style={{ color: m.color, borderColor: m.color + '44', background: m.color + '12' }}
                title={`${m.label}: ${v}`}>
                {m.Icon
                  ? <m.Icon size={12} />
                  : <span style={{ fontWeight: 800, fontSize: 10, minWidth: 12, textAlign: 'center' }}>{m.mark}</span>}
                {' '}{socLabel(v).slice(0, 34)}
                <span className="ml-0.5 opacity-0 group-hover:opacity-80 transition-opacity"
                  onClick={e => { e.preventDefault(); const s = { ...(c.socials || {}) }; delete s[p]; crm.updateContact(c.id, { socials: s }) }}>×</span>
              </a>
            )
          })}
          <div className="flex items-center gap-1.5">
            <select className="input" style={{ width: 'auto', padding: '4px 24px 4px 8px', fontSize: 11.5 }}
              value={socPlatform} onChange={e => setSocPlatform(e.target.value)}>
              {Object.entries(SOCIAL_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
            <input className="input" style={{ width: 170, padding: '4px 10px', fontSize: 12 }}
              placeholder="URL or handle…" value={socDraft}
              onChange={e => setSocDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key !== 'Enter' || !socDraft.trim()) return
                crm.updateContact(c.id, { socials: { ...(c.socials || {}), [socPlatform]: socDraft.trim() } })
                setSocDraft('')
                crm.toast(`${SOCIAL_META[socPlatform].label} added`)
              }} />
          </div>
          {Object.keys(c.socials || {}).length === 0 && <span className="text-[11px]" style={{ color: 'var(--faint)' }}>no profiles saved — add the first</span>}
        </div>
      </div>

      <div className="mt-5">
        <div className="label">Interests & topics</div>
        <div className="flex gap-1.5 flex-wrap items-center">
          {(c.interests || []).map((it, i) => (
            <span key={i} className="chip" style={{ color: 'var(--t-sky)', borderColor: '#38bdf844', background: '#38bdf812' }}>
              {it}
              <button className="ml-0.5 opacity-60 hover:opacity-100" title="Remove"
                onClick={() => crm.updateContact(c.id, { interests: c.interests.filter((_, j) => j !== i) })}>×</button>
            </span>
          ))}
          <input className="input" style={{ width: 150, padding: '4px 10px', fontSize: 12 }}
            placeholder={c.interests?.length ? 'add another…' : 'e.g. fintech, trekking…'}
            value={interestDraft}
            onChange={e => setInterestDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key !== 'Enter' || !interestDraft.trim()) return
              const v = interestDraft.trim().toLowerCase()
              if (!(c.interests || []).includes(v)) crm.updateContact(c.id, { interests: [...(c.interests || []), v] })
              setInterestDraft('')
            }} />
          {(c.interests || []).length === 0 && <span className="text-[11px]" style={{ color: 'var(--faint)' }}>press Enter to save — searchable instantly</span>}
        </div>
      </div>

      <div className="mt-5">
        <div className="label">Groups <span style={{ color: 'var(--faint)', textTransform: 'none', letterSpacing: 0 }}>· a contact can sit in several</span></div>
        <div className="flex gap-1.5 flex-wrap">
          {crm.groups.length === 0 && <span className="text-[11.5px]" style={{ color: 'var(--faint)' }}>no groups yet — create one in Groups</span>}
          {crm.groups.map(g => {
            const on = contactGroupIds(c).includes(g.id)
            return (
              <button key={g.id} onClick={() => crm.updateContact(c.id, { groupIds: on
                  ? contactGroupIds(c).filter(x => x !== g.id)
                  : [...contactGroupIds(c), g.id] })}
                className="chip chip-btn"
                style={on ? { background: g.color + '22', color: g.color, borderColor: g.color + '55' } : {}}>
                <UsersRound size={11} /> {g.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-5">
        <div className="label">Tags</div>
        <div className="flex gap-1.5 flex-wrap">
          {crm.tags.map(t => {
            const on = c.tags.includes(t.id)
            return (
              <button key={t.id} onClick={() => toggleTag(t.id)} className="chip chip-btn"
                style={on ? { background: t.color + '22', color: t.color, borderColor: t.color + '55' } : {}}>
                {t.icon} {t.name}
              </button>
            )
          })}
        </div>
      </div>

      {myEvents.length > 0 && (
        <div className="mt-5">
          <div className="label">Events</div>
          <div className="flex flex-col gap-2">
            {myEvents.map(e => (
              <div key={e.id} className="card p-3 flex items-center gap-3 text-[12.5px]">
                <span className="dot" style={{ background: EVENT_COLORS[e.type] }} />
                <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>{e.date} {e.time}</span>
                <span className="truncate font-medium">{e.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="label">Notes</div>
        <div className="card p-3">
          <input className="input mb-2" placeholder="Note title…" value={noteTitle} onChange={e => setNoteTitle(e.target.value)} />
          <textarea className="input" rows={2} placeholder="Write something worth remembering…" value={noteBody} onChange={e => setNoteBody(e.target.value)} />
          <div className="flex justify-end mt-2">
            <button className="btn btn-primary btn-sm" disabled={!noteTitle.trim()}
              onClick={() => { crm.addNote({ title: noteTitle.trim(), body: noteBody.trim(), contactIds: [c.id] }); setNoteTitle(''); setNoteBody(''); crm.toast('Note saved') }}>
              <StickyNote size={13} /> Save note
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2 mt-2">
          {myNotes.map(n => (
            <div key={n.id} className="card p-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold">{n.pinned && '📌'}{n.title}</div>
              {n.body && <div className="text-[12px] mt-1" style={{ color: 'var(--muted)' }}>{n.body}</div>}
              <div className="text-[10.5px] mt-1.5" style={{ color: 'var(--faint)' }}>{tsRel(n.updated)}</div>
            </div>
          ))}
        </div>
      </div>

      {myActs.length > 0 && (
        <div className="mt-5">
          <div className="label">Timeline</div>
          {myActs.map(a => (
            <div key={a.id} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--hairline)' }}>
              <span className="dot" style={{ background: 'var(--i1)' }} />
              <span className="text-[12.5px] flex-1">{a.text}</span>
              <span className="text-[10.5px] flex-none" style={{ color: 'var(--faint)' }}>{tsRel(a.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* one form for both creating and editing a contact */
function ContactFormModal({ open, onClose, contact = null }) {
  const { addContact, updateContact, groups, relFreq, tags, toast, contacts } = useCrm()
  const editing = !!contact
  const blank = { name: '', role: '', company: '', phone: '', email: '', birthday: '', anniversary: '', groupIds: ['g_leads'], rel: 'acquaintance', tags: [], introducedBy: '', interests: '', giftIdeas: '', linkedin: '', website: '', address: '', photo: null, cardImage: null }
  const [f, setF] = useState(blank)
  useEffect(() => {
    if (!open) return
    setF(contact ? {
      name: contact.name || '', role: contact.role || '', company: contact.company || '',
      phone: contact.phone || '', email: contact.email || '',
      birthday: contact.birthday || '', anniversary: contact.anniversary || '',
      groupIds: contactGroupIds(contact), rel: contact.rel || 'acquaintance',
      tags: [...(contact.tags || [])], introducedBy: contact.introducedBy || '',
      interests: (contact.interests || []).join(', '), giftIdeas: contact.giftIdeas || '',
      linkedin: contact.socials?.linkedin || '', website: contact.socials?.website || '',
      address: contact.address || '', photo: contact.photo || null, cardImage: contact.cardImage || null,
    } : { ...blank, groupIds: groups[0] ? [groups[0].id] : [] })
  }, [open, contact]) // eslint-disable-line
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const toggleTag = tid => set('tags', f.tags.includes(tid) ? f.tags.filter(x => x !== tid) : [...f.tags, tid])
  const toggleGroup = gid => set('groupIds', f.groupIds.includes(gid) ? f.groupIds.filter(x => x !== gid) : [...f.groupIds, gid])

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${contact.name}` : 'Add contact'} wide>
      <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: 'var(--cardbg2)', border: '1px solid var(--border)' }}>
        <Avatar name={f.name || 'New'} photo={f.photo} size={56} />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold">Portrait & visiting card</div>
          <div className="text-[11px]" style={{ color: 'var(--faint)' }}>Optional · stays on this device · compressed automatically</div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={async () => {
          const r = await pickAndCompress({ maxEdge: 640, quality: 0.72 })
          if (r) set('photo', r.dataUrl)
        }}><Camera size={13} /> {f.photo ? 'Change photo' : 'Add photo'}</button>
        {f.photo && <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--t-rose)' }} onClick={() => set('photo', null)}>Remove</button>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={async () => {
          const r = await pickAndCompress({ maxEdge: 1400, quality: 0.8 })
          if (r) set('cardImage', r.dataUrl)
        }}><IdCard size={13} /> {f.cardImage ? 'Change card' : 'Upload card'}</button>
        {f.cardImage && <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--t-rose)' }} onClick={() => set('cardImage', null)}>Remove card</button>}
        {f.cardImage && <CardThumb src={f.cardImage} size={72} />}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name *"><input className="input" value={f.name} onChange={e => set('name', e.target.value)} placeholder="Full name" /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="+880 …" /></Field>
        <Field label="Role"><input className="input" value={f.role} onChange={e => set('role', e.target.value)} placeholder="e.g. Product Manager" /></Field>
        <Field label="Company"><input className="input" value={f.company} onChange={e => set('company', e.target.value)} placeholder="e.g. bKash" /></Field>
        <Field label="Email"><input className="input" value={f.email} onChange={e => set('email', e.target.value)} placeholder="name@email.com" /></Field>
        <Field label="Birthday"><input className="input" type="date" value={f.birthday} onChange={e => set('birthday', e.target.value)} /></Field>
        <Field label="Anniversary"><input className="input" type="date" value={f.anniversary} onChange={e => set('anniversary', e.target.value)} /></Field>
        <Field label="Gift ideas"><input className="input" value={f.giftIdeas} onChange={e => set('giftIdeas', e.target.value)} placeholder="e.g. single-origin coffee" /></Field>
        <Field label="Relationship">
          <select className="input" value={f.rel} onChange={e => set('rel', e.target.value)}>
            {Object.entries(relFreq).map(([k, r]) => <option key={k} value={k}>{r.label} · every {r.everyDays}d</option>)}
          </select>
        </Field>
        <Field label="Met through / introduced by" hint="Who connected you two?">
          <input className="input" list="crm-contact-names" value={f.introducedBy} onChange={e => set('introducedBy', e.target.value)} placeholder="e.g. Karim Sheikh" />
          <datalist id="crm-contact-names">{contacts.map(c => <option key={c.id} value={c.name} />)}</datalist>
        </Field>
        <Field label="Interests & topics" hint="Comma separated — searchable">
          <input className="input" value={f.interests} onChange={e => set('interests', e.target.value)} placeholder="e.g. fintech, trekking, jazz" />
        </Field>
      </div>
      <div className="mt-4">
        <div className="label">Groups <span style={{ color: 'var(--faint)', textTransform: 'none', letterSpacing: 0 }}>· pick as many as fit</span></div>
        <div className="flex gap-1.5 flex-wrap">
          {groups.map(g => (
            <button key={g.id} type="button" onClick={() => toggleGroup(g.id)} className="chip chip-btn"
              style={f.groupIds.includes(g.id) ? { background: g.color + '22', color: g.color, borderColor: g.color + '55' } : {}}>
              <UsersRound size={11} /> {g.name}
            </button>
          ))}
        </div>
        <Field label="LinkedIn">
          <input className="input" value={f.linkedin || ''} onChange={e => set('linkedin', e.target.value)} placeholder="https://linkedin.com/in/…" />
        </Field>
        <Field label="Website">
          <input className="input" value={f.website || ''} onChange={e => set('website', e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Address">
          <input className="input" value={f.address || ''} onChange={e => set('address', e.target.value)} placeholder="Street, city" />
        </Field>
      </div>
      <div className="mt-4">
        <div className="label">Tags</div>
        <div className="flex gap-1.5 flex-wrap">
          {tags.map(t => (
            <button key={t.id} onClick={() => toggleTag(t.id)} className={`chip chip-btn ${f.tags.includes(t.id) ? 'on' : ''}`}>{t.icon} {t.name}</button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!f.name.trim()}
          onClick={() => {
            const payload = {
              ...f, birthday: f.birthday || null, anniversary: f.anniversary || null,
              introducedBy: f.introducedBy.trim() || null,
              giftIdeas: f.giftIdeas.trim(),
              address: (f.address || '').trim(),
              photo: f.photo || null,
              cardImage: f.cardImage || null,
              interests: f.interests.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
              socials: Object.fromEntries([['linkedin', f.linkedin], ['website', f.website]].filter(([, v]) => (v || '').trim()).map(([k, v]) => [k, v.trim()])),
            }
            delete payload.linkedin; delete payload.website
            if (editing) {
              updateContact(contact.id, payload)
              toast(`Saved changes to ${f.name.trim()}`)
            } else {
              addContact(payload)
              toast(`Added ${f.name.trim().split(' ')[0]} to contacts`)
            }
            onClose()
          }}>
          {editing ? <><Pencil size={15} /> Save changes</> : <><UserPlus size={15} /> Save contact</>}
        </button>
      </div>
    </Modal>
  )
}
