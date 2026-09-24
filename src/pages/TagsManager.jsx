import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Tag, Plus, Merge, Trash2, Search, Users, CheckSquare } from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Card, Modal, Avatar, Empty, Field, Pill, CsvButton, toneVar} from '../components/ui'
import { TAG_COLORS, TAG_ICONS } from '../data/seed'
import { cn } from '../lib'

export default function TagsManager() {
  const crm = useCrm()
  const { tags, contacts } = crm
  const [selectedId, setSelectedId] = useState(tags[0]?.id || null)
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState(null) // {type:'merge'|'delete', ...}
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    const t = params.get('tag')
    if (t && tags.some(x => x.id === t)) { setSelectedId(t); params.delete('tag'); setParams(params, { replace: true }) }
  }, [])

  const usage = useMemo(() =>
    Object.fromEntries(tags.map(t => [t.id, contacts.filter(c => c.tags.includes(t.id)).length])),
    [tags, contacts])
  const maxUsage = Math.max(1, ...Object.values(usage))

  const selected = tags.find(t => t.id === selectedId) || tags[0]
  const visible = tags.filter(t => t.name.toLowerCase().includes(q.toLowerCase()))
  const untagged = contacts.filter(c => c.tags.length === 0).length
  const topTag = [...tags].sort((a, b) => (usage[b.id] || 0) - (usage[a.id] || 0))[0]

  return (
    <div className="max-w-[1200px] mx-auto">
      <SectionHead kicker="Roadmap #6" title="Tags Manager"
        sub="Rename, recolor, merge and bulk-assign tags — usage stats update live."
        right={<div className="flex items-center gap-2">
          <CsvButton filename="tags.csv" rows={crm.tags} headers={[
            { label: 'Tag', get: r => r.name }, { label: 'Icon', get: r => r.icon },
            { label: 'Color', get: r => r.color },
            { label: 'Contacts tagged', get: r => crm.contacts.filter(c => (c.tags || []).includes(r.id)).length },
          ]} />
          <button className="btn btn-primary btn-sm" onClick={() => setSelectedId(crm.addTag().id)}><Plus size={14} /> New tag</button>
        </div>} />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total tags', value: tags.length },
          { label: 'Most used', value: topTag ? `${topTag.icon} ${topTag.name} · ${usage[topTag.id]}` : '—' },
          { label: 'Avg usage / tag', value: tags.length ? (tags.reduce((s, t) => s + usage[t.id], 0) / tags.length).toFixed(1) : 0 },
          { label: 'Untagged contacts', value: untagged },
        ].map((s, i) => (
          <Card key={i} className="p-4">
            <div className="text-[19px] font-extrabold tracking-tight truncate">{s.value}</div>
            <div className="text-[10.5px] font-bold uppercase tracking-[.08em]" style={{ color: 'var(--faint)' }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">
        {/* tag list */}
        <Card className="p-3">
          <div className="relative mb-2">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
            <input className="input pl-8" placeholder="Filter tags…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 max-h-[480px] overflow-y-auto">
            {visible.map(t => (
              <button key={t.id} onClick={() => setSelectedId(t.id)}
                className={cn('w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                  selected?.id === t.id ? 'bg-[var(--chipbg)]' : 'hover:bg-[var(--hover)]')}>
                <span className="w-8 h-8 rounded-lg grid place-items-center text-[15px] flex-none"
                  style={{ background: t.color + '1c', border: `1px solid ${t.color}40` }}>{t.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold truncate">{t.name}</span>
                  <span className="block h-1 rounded-full mt-1.5" style={{ background: 'var(--chipbg)' }}>
                    <span className="block h-1 rounded-full" style={{ width: `${(usage[t.id] / maxUsage) * 100}%`, background: t.color }} />
                  </span>
                </span>
                <span className="chip flex-none">{usage[t.id]}</span>
              </button>
            ))}
            {visible.length === 0 && (tags.length === 0
              ? <Empty icon={Tag} title="No tags yet"
                  steps={[
                    'Create a tag — Client, Investor, Friend, whatever helps you filter.',
                    'Open any contact and tap the tag to attach it.',
                    'Filter the contacts list or search by tag when you need a slice.',
                  ]}
                  action={() => setSelectedId(crm.addTag().id)} actionLabel="Create a tag"
                  guide="people.tags">
                  Tags are free-form labels. Use them for things that cut across groups.
                </Empty>
              : <Empty icon={Tag} title="No tags match" />)}
          </div>
        </Card>

        {/* editor + bulk assign */}
        {selected && (
          <div className="flex flex-col gap-4">
            <Card className="p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl grid place-items-center text-[20px]"
                    style={{ background: selected.color + '1c', border: `1px solid ${selected.color}40` }}>{selected.icon}</span>
                  <div>
                    <input className="bg-transparent font-bold text-[16px] tracking-tight outline-none border-b border-dashed w-52"
                      style={{ borderColor: 'var(--border2)' }}
                      value={selected.name} onChange={e => crm.updateTag(selected.id, { name: e.target.value })} />
                    <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--faint)' }}>Used by {usage[selected.id]} contact(s) — click the name to rename</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost btn-sm" disabled={tags.length < 2} onClick={() => setConfirm({ type: 'merge', targetId: tags.find(t => t.id !== selected.id)?.id })}>
                    <Merge size={13} /> Merge into…
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirm({ type: 'delete' })}>
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <div className="label">Color</div>
                  <div className="flex gap-2 flex-wrap">
                    {TAG_COLORS.map(c => (
                      <button key={c} onClick={() => crm.updateTag(selected.id, { color: c })}
                        className="w-8 h-8 rounded-lg transition-transform"
                        style={{ background: c, outline: selected.color === c ? `2px solid ${c}` : 'none', outlineOffset: 2, transform: selected.color === c ? 'scale(1.12)' : 'none' }} />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="label">Icon</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {TAG_ICONS.map(ic => (
                      <button key={ic} onClick={() => crm.updateTag(selected.id, { icon: ic })}
                        className={cn('w-8 h-8 rounded-lg grid place-items-center text-[15px] transition-colors',
                          selected.icon === ic ? 'bg-indigo-400/25' : 'bg-[var(--chipbg)] hover:bg-[var(--hover)]')}>{ic}</button>
                    ))}
                  </div>
                </div>
              </div>

              {usage[selected.id] > 0 && (
                <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--hairline)' }}>
                  <div className="label">Tagged contacts</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {contacts.filter(c => c.tags.includes(selected.id)).slice(0, 8).map(c => (
                      <span key={c.id} className="chip"><Avatar name={c.name} size={16} /> {c.name}</span>
                    ))}
                    {usage[selected.id] > 8 && <span className="chip">+{usage[selected.id] - 8} more</span>}
                  </div>
                </div>
              )}
            </Card>

            <BulkAssign tag={selected} />
          </div>
        )}
      </div>

      <ConfirmModal confirm={confirm} setConfirm={setConfirm} selected={selected} />
    </div>
  )
}

function BulkAssign({ tag }) {
  const { contacts, bulkTag } = useCrm()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState([])
  const list = contacts.filter(c => c.name.toLowerCase().includes(q.toLowerCase()))
  const toggle = id => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const withTag = contacts.filter(c => c.tags.includes(tag.id)).length

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-bold text-[14.5px] inline-flex items-center gap-2"><Users size={15} style={{ color: 'var(--t-sky)' }} /> Bulk assign “{tag.icon} {tag.name}”</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/contacts?tag=${tag.id}`)}>Open filtered view</button>
      </div>
      <div className="relative mb-2">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
        <input className="input pl-8" placeholder="Search contacts…" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="max-h-[220px] overflow-y-auto flex flex-col gap-1 pr-1">
        {list.map(c => {
          const has = c.tags.includes(tag.id)
          const on = picked.includes(c.id)
          return (
            <button key={c.id} onClick={() => toggle(c.id)}
              className={cn('flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors', on ? 'bg-indigo-400/15' : 'hover:bg-[var(--hover)]')}>
              <span className={cn('w-4 h-4 rounded grid place-items-center flex-none border',
                on ? 'bg-indigo-400 border-indigo-400 text-[#0a0c11]' : 'border-white/25 text-transparent')}><CheckSquare size={11} /></span>
              <Avatar name={c.name} size={24} />
              <span className="text-[13px] font-medium flex-1 truncate">{c.name}</span>
              {has && <span className="chip" style={{ color: toneVar(tag.color), borderColor: tag.color + '40' }}>has tag</span>}
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
        <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{picked.length} selected · {withTag} currently tagged</span>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" disabled={!picked.length} onClick={() => { bulkTag(picked, tag.id, 'remove'); setPicked([]) }}>Remove tag</button>
          <button className="btn btn-primary btn-sm" disabled={!picked.length} onClick={() => { bulkTag(picked, tag.id, 'add'); setPicked([]) }}>Add tag</button>
        </div>
      </div>
    </Card>
  )
}

function ConfirmModal({ confirm, setConfirm, selected }) {
  const { tags, contacts, deleteTag, mergeTags } = useCrm()
  if (!confirm || !selected) return null
  const affected = contacts.filter(c => c.tags.includes(selected.id)).length

  if (confirm.type === 'delete') {
    return (
      <Modal open onClose={() => setConfirm(null)} title={`Delete tag “${selected.name}”?`}>
        <p className="text-[13.5px]" style={{ color: 'var(--muted)' }}>
          This removes the tag from <strong style={{ color: 'var(--text)' }}>{affected} contact(s)</strong>. The contacts themselves are untouched. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { deleteTag(selected.id); setConfirm(null) }}><Trash2 size={14} /> Delete tag</button>
        </div>
      </Modal>
    )
  }

  const others = tags.filter(t => t.id !== selected.id)
  return (
    <Modal open onClose={() => setConfirm(null)} title={`Merge “${selected.name}” into…`}>
      <p className="text-[13px] mb-4" style={{ color: 'var(--muted)' }}>
        All {affected} contact(s) tagged <Pill color={selected.color}>{selected.icon} {selected.name}</Pill> will be retagged, then “{selected.name}” is deleted.
      </p>
      <Field label="Target tag">
        <select className="input" value={confirm.targetId} onChange={e => setConfirm({ ...confirm, targetId: e.target.value })}>
          {others.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
        </select>
      </Field>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
        <button className="btn btn-primary" disabled={!confirm.targetId}
          onClick={() => { mergeTags(selected.id, confirm.targetId); setConfirm(null) }}>
          <Merge size={14} /> Merge tags
        </button>
      </div>
    </Modal>
  )
}
