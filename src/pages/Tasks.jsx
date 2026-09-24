import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  PlusSquare, GripVertical, Search, CheckCircle2, Circle, Trash2, Copy,
  AlignLeft, ListChecks, CalendarDays, UserRound, X, ChevronRight
} from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Avatar, DueBadge, Modal, Field, TagPill, PRIORITY_COLORS, CsvButton, toneVar } from '../components/ui'
import { cn, tsRel } from '../lib'

const COLUMNS = [
  { id: 'todo', name: 'To do', color: 'var(--t-slate)' },
  { id: 'progress', name: 'In progress', color: 'var(--t-sky)' },
  { id: 'waiting', name: 'Waiting', color: 'var(--t-amber)' },
  { id: 'done', name: 'Done', color: 'var(--t-green)' },
]
const COL_BY_ID = Object.fromEntries(COLUMNS.map(c => [c.id, c]))
const PRIO_ORDER = { high: 0, med: 1, low: 2 }

export default function Tasks() {
  const { tasks, moveTask, contactById, tagById } = useCrm()
  const [params, setParams] = useSearchParams()
  const [addOpen, setAddOpen] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [overCol, setOverCol] = useState(null)

  /* advanced filtering */
  const [q, setQ] = useState('')
  const [prio, setPrio] = useState('all')
  const [tagF, setTagF] = useState(params.get('tag') || '')
  const [sort, setSort] = useState('manual')
  const [hideDone, setHideDone] = useState(false)

  useEffect(() => {
    let dirty = false
    if (params.get('new') === '1') { setAddOpen(true); params.delete('new'); dirty = true }
    const f = params.get('focus')
    if (f) { setDetailId(f); params.delete('focus'); dirty = true }
    if (params.get('open')) { setDetailId(params.get('open')); params.delete('open'); dirty = true }
    if (dirty) setParams(params, { replace: true })
  }, [])

  const visible = useMemo(() => {
    let xs = tasks.filter(t => {
      if (q) {
        const blob = `${t.title} ${t.desc || ''} ${(t.subtasks || []).map(s => s.text).join(' ')} ${contactById[t.contactId]?.name || ''} ${(t.tags || []).map(x => tagById[x]?.name).join(' ')}`.toLowerCase()
        if (!blob.includes(q.toLowerCase())) return false
      }
      if (prio !== 'all' && t.priority !== prio) return false
      if (tagF && !(t.tags || []).includes(tagF)) return false
      if (hideDone && t.column === 'done') return false
      return true
    })
    if (sort === 'due') xs = [...xs].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
    else if (sort === 'priority') xs = [...xs].sort((a, b) => PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority])
    else if (sort === 'name') xs = [...xs].sort((a, b) => a.title.localeCompare(b.title))
    return xs
  }, [tasks, q, prio, tagF, sort, hideDone, contactById, tagById])

  const detail = detailId && tasks.find(t => t.id === detailId)
  const doneCount = tasks.filter(t => t.column === 'done').length
  const subTotal = tasks.reduce((s, t) => s + (t.subtasks || []).length, 0)
  const subDone = tasks.reduce((s, t) => s + (t.subtasks || []).filter(x => x.done).length, 0)

  return (
    <div className="max-w-[1280px] mx-auto h-full flex flex-col">
      <SectionHead kicker="Workflow" title="Tasks"
        sub={`${tasks.length} tasks · ${doneCount} done · ${subDone}/${subTotal} subtasks checked — click any card for full details`}
        right={<div className="flex items-center gap-2">
          <CsvButton filename="tasks.csv" rows={tasks} headers={[
            { label: 'Title', get: r => r.title }, { label: 'Column', get: r => r.column },
            { label: 'Priority', get: r => r.priority }, { label: 'Due', get: r => r.due || '' },
            { label: 'Contact', get: r => contactById[r.contactId]?.name || '' },
            { label: 'Tags', get: r => (r.tags || []).map(t => tagById[t]?.name).filter(Boolean).join('; ') },
            { label: 'Description', get: r => r.desc || '' },
            { label: 'Subtasks done', get: r => (r.subtasks || []).filter(s => s.done).length },
            { label: 'Subtasks total', get: r => (r.subtasks || []).length },
          ]} />
          <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}><PlusSquare size={14} /> New task</button>
        </div>} />

      {/* toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
          <input className="input" style={{ paddingLeft: 30, width: 220 }} placeholder="Search title, notes, subtask…"
            value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className={`chip chip-btn ${prio === 'all' ? 'on' : ''}`} onClick={() => setPrio('all')}>All priorities</button>
        {['high', 'med', 'low'].map(p => (
          <button key={p} className={`chip chip-btn ${prio === p ? 'on' : ''}`} onClick={() => setPrio(x => x === p ? 'all' : p)}>
            <span className="dot" style={{ background: PRIORITY_COLORS[p] }} />{p}
          </button>
        ))}
        <select className="input" style={{ width: 'auto', padding: "5px 30px 5px 10px", fontSize: 12 }} value={sort} onChange={e => setSort(e.target.value)} title="Sort within columns">
          <option value="manual">Manual order</option>
          <option value="due">Sort: due date</option>
          <option value="priority">Sort: priority</option>
          <option value="name">Sort: A–Z</option>
        </select>
        <button className={`chip chip-btn ${hideDone ? 'on' : ''}`} onClick={() => setHideDone(h => !h)}>Hide done</button>
        {(q || prio !== 'all' || tagF) && (
          <button className="chip chip-btn" onClick={() => { setQ(''); setPrio('all'); setTagF('') }}>
            <X size={11} /> clear — {visible.length} of {tasks.length} shown
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 flex-1 items-start">
        {COLUMNS.map(col => {
          const items = visible.filter(t => t.column === col.id)
          return (
            <div key={col.id}
              className={cn('rounded-2xl p-2.5 min-h-[120px] transition-colors', overCol === col.id && 'dragover')}
              style={{ background: 'var(--chipbg)' }}
              onDragOver={e => { e.preventDefault(); setOverCol(col.id) }}
              onDragLeave={() => setOverCol(c => c === col.id ? null : c)}
              onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/task'); if (id) moveTask(id, col.id); setDragId(null); setOverCol(null) }}>
              <div className="flex items-center gap-2 px-1.5 pb-2.5">
                <span className="dot" style={{ background: col.color }} />
                <span className="text-[12.5px] font-bold" data-tip={`tasks.${col.id}`}>{col.name}</span>
                {items.length !== tasks.filter(t => t.column === col.id).length &&
                  <span className="text-[10px]" style={{ color: 'var(--faint)' }}>of {tasks.filter(t => t.column === col.id).length}</span>}
                <span className="chip ml-auto">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map(t => <TaskCard key={t.id} t={t} dragId={dragId} setDragId={setDragId} onOpen={() => setDetailId(t.id)} />)}
                {items.length === 0 && (
                  <div className="text-[11px] text-center py-4 rounded-xl border border-dashed" style={{ color: 'var(--faint)', borderColor: 'var(--border)' }}>
                    {q || prio !== 'all' || tagF ? 'nothing matches here' : 'drop tasks here'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <AddTaskModal open={addOpen} onClose={() => setAddOpen(false)} />
      {detail && <TaskDetailModal t={detail} onClose={() => setDetailId(null)} />}
    </div>
  )
}

/* ── card ── */
function TaskCard({ t, dragId, setDragId, onOpen }) {
  const { contactById, tagById } = useCrm()
  const contact = t.contactId && contactById[t.contactId]
  const subs = t.subtasks || []
  const subsDone = subs.filter(s => s.done).length
  const pct = subs.length ? Math.round(subsDone / subs.length * 100) : 0
  return (
    <div draggable id={`task-${t.id}`}
      onDragStart={e => { e.dataTransfer.setData('text/task', t.id); e.dataTransfer.effectAllowed = 'move'; setDragId(t.id) }}
      onDragEnd={() => setDragId(null)}
      onClick={onOpen}
      className={cn('card p-3 cursor-pointer hoverable', dragId === t.id && 'dragging')}>
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="mt-0.5 flex-none cursor-grab active:cursor-grabbing" style={{ color: 'var(--faint)' }}
          onClick={e => e.stopPropagation()} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold leading-snug">{t.title}</div>
          {t.desc && (
            <div className="text-[11.5px] mt-1 leading-snug line-clamp-2 flex items-start gap-1.5" style={{ color: 'var(--muted)' }}>
              <AlignLeft size={11} className="flex-none mt-0.5" style={{ color: 'var(--faint)' }} />
              <span className="line-clamp-2">{t.desc}</span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: toneVar(PRIORITY_COLORS[t.priority]) }}>
              <span className="dot" style={{ background: PRIORITY_COLORS[t.priority] }} />{t.priority}
            </span>
            <DueBadge date={t.due} />
            {t.tags.map(tid => tagById[tid] && <TagPill key={tid} tag={tagById[tid]} small />)}
            {subs.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold" style={{ color: pct === 100 ? 'var(--t-green)' : 'var(--muted)' }}>
                <ListChecks size={11} /> {subsDone}/{subs.length}
              </span>
            )}
          </div>
          {subs.length > 0 && (
            <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--chipbg)' }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: pct === 100 ? '#34d399' : 'linear-gradient(90deg,var(--i1),var(--i2))' }} />
            </div>
          )}
        </div>
        {contact && <Avatar name={contact.name} size={24} />}
      </div>
    </div>
  )
}

/* ── detail modal (view details per card) ── */
function TaskDetailModal({ t, onClose }) {
  const { contacts, tags, contactById, activity, audit, moveTask, updateTask, deleteTask, duplicateTask, toast } = useCrm()
  const [confirmDel, setConfirmDel] = useState(false)
  const [subDraft, setSubDraft] = useState('')
  const contact = t.contactId && contactById[t.contactId]
  const subs = t.subtasks || []
  const done = subs.filter(s => s.done).length
  const pct = subs.length ? Math.round(done / subs.length * 100) : 0

  const trail = [
    ...activity.filter(a => a.text.toLowerCase().includes(t.title.toLowerCase().slice(0, 18))).map(a => ({ ts: a.ts, text: a.text })),
    ...audit.filter(a => (a.entity || '').toLowerCase().includes(t.title.toLowerCase().slice(0, 18))).map(a => ({ ts: a.ts, text: `${a.action} — ${a.detail || ''}` })),
  ].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 5)

  const toggleSub = sid => updateTask(t.id, { subtasks: subs.map(s => s.id === sid ? { ...s, done: !s.done } : s) })
  const addSub = () => {
    const v = subDraft.trim(); if (!v) return
    updateTask(t.id, { subtasks: [...subs, { id: Math.random().toString(36).slice(2, 8), text: v, done: false }] })
    setSubDraft('')
  }

  return (
    <Modal open onClose={onClose} title="" wide>
      {/* header */}
      <div className="flex items-start gap-3 -mt-1 mb-4">
        <input className="input text-[16px] font-extrabold flex-1" value={t.title} style={{ padding: '10px 13px' }}
          onChange={e => updateTask(t.id, { title: e.target.value })} />
        <span className="chip mt-1" style={{ color: COL_BY_ID[t.column]?.color, borderColor: COL_BY_ID[t.column]?.color + '55' }}>
          {COL_BY_ID[t.column]?.name}
        </span>
      </div>

      {/* meta grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-1">
        <Field label="Column">
          <select className="input" value={t.column} onChange={e => moveTask(t.id, e.target.value)}>
            {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select className="input" value={t.priority} onChange={e => updateTask(t.id, { priority: e.target.value })}>
            <option value="high">🔴 High</option><option value="med">🟡 Medium</option><option value="low">⚪ Low</option>
          </select>
        </Field>
        <Field label="Due date">
          <input className="input" type="date" value={t.due || ''} onChange={e => updateTask(t.id, { due: e.target.value || null })} />
        </Field>
        <Field label="Linked contact">
          <select className="input" value={t.contactId || ''} onChange={e => updateTask(t.id, { contactId: e.target.value || null })}>
            <option value="">None</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>

      {/* tags */}
      <div className="mb-4">
        <div className="label">Tags</div>
        <div className="flex gap-1.5 flex-wrap">
          {tags.map(x => {
            const on = (t.tags || []).includes(x.id)
            return (
              <button key={x.id} className="chip chip-btn"
                style={on ? { background: x.color + '22', color: x.color, borderColor: x.color + '55' } : {}}
                onClick={() => updateTask(t.id, { tags: on ? t.tags.filter(y => y !== x.id) : [...(t.tags || []), x.id] })}>
                {x.icon} {x.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* description */}
      <Field label="Description / notes">
        <textarea className="input" rows={3} placeholder="Context, links, decisions…"
          value={t.desc || ''} onChange={e => updateTask(t.id, { desc: e.target.value })} />
      </Field>

      {/* subtasks */}
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="label" style={{ marginBottom: 0 }}>Subtasks</div>
          {subs.length > 0 && <span className="chip" style={{ color: pct === 100 ? 'var(--t-green)' : 'var(--muted)' }}>{done}/{subs.length} · {pct}%</span>}
        </div>
        {subs.length > 0 && (
          <div className="h-1.5 rounded-full mb-3 overflow-hidden" style={{ background: 'var(--chipbg)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? '#34d399' : 'linear-gradient(90deg,var(--i1),var(--i2))' }} />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {subs.map(s => (
            <div key={s.id} className="flex items-center gap-2.5 group">
              <button onClick={() => toggleSub(s.id)} className="flex-none transition-colors" style={{ color: s.done ? 'var(--t-green)' : 'var(--faint)' }}>
                {s.done ? <CheckCircle2 size={17} /> : <Circle size={17} />}
              </button>
              <input className="input flex-1" value={s.text} style={{ padding: '6px 10px', fontSize: 12.5, textDecoration: s.done ? 'line-through' : 'none', opacity: s.done ? .55 : 1 }}
                onChange={e => updateTask(t.id, { subtasks: subs.map(x => x.id === s.id ? { ...x, text: e.target.value } : x) })} />
              <button className="icon-btn opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: 26, height: 26 }}
                onClick={() => updateTask(t.id, { subtasks: subs.filter(x => x.id !== s.id) })}><Trash2 size={12} /></button>
            </div>
          ))}
          <div className="flex items-center gap-2.5">
            <span className="w-[17px] grid place-items-center flex-none" style={{ color: 'var(--faint)' }}>+</span>
            <input className="input flex-1" style={{ padding: '6px 10px', fontSize: 12.5 }} placeholder="Add a subtask and press Enter…"
              value={subDraft} onChange={e => setSubDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSub()} />
          </div>
        </div>
      </div>

      {/* activity trail */}
      {trail.length > 0 && (
        <div className="mt-5">
          <div className="label">Activity trail</div>
          {trail.map((a, i) => (
            <div key={i} className="flex items-center gap-2.5 py-1.5 text-[11.5px]" style={{ color: 'var(--muted)' }}>
              <span className="dot flex-none" style={{ background: 'var(--i2)' }} />
              <span className="truncate flex-1">{a.text}</span>
              <span className="flex-none" style={{ color: 'var(--faint)' }}>{tsRel(a.ts)}</span>
            </div>
          ))}
        </div>
      )}

      {/* footer */}
      <div className="flex items-center gap-2 mt-6">
        {contact && (
          <span className="chip mr-auto"><UserRound size={11} /> {contact.name}</span>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => { const c = duplicateTask(t.id); if (c) { onClose() } }}>
          <Copy size={13} /> Duplicate
        </button>
        {confirmDel
          ? <button className="btn btn-danger btn-sm" onClick={() => { deleteTask(t.id); onClose() }}>Confirm delete?</button>
          : <button className="btn btn-ghost btn-sm" style={{ color: 'var(--t-rose)' }}
              onClick={() => { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 2600) }}>
              <Trash2 size={13} /> Delete
            </button>}
        <button className="btn btn-primary btn-sm" onClick={onClose}>Done <ChevronRight size={13} /></button>
      </div>
    </Modal>
  )
}

/* ── add modal (extended) ── */
function AddTaskModal({ open, onClose }) {
  const { addTask, contacts, toast } = useCrm()
  const empty = { title: '', column: 'todo', priority: 'med', due: '', contactId: '', desc: '', subs: '' }
  const [f, setF] = useState(empty)
  useEffect(() => { if (open) setF(empty) }, [open])
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  return (
    <Modal open={open} onClose={onClose} title="New task">
      <div className="flex flex-col gap-4">
        <Field label="Title *"><input className="input" value={f.title} onChange={e => set('title', e.target.value)} placeholder="What needs doing?" /></Field>
        <Field label="Description"><textarea className="input" rows={2} value={f.desc} onChange={e => set('desc', e.target.value)} placeholder="Optional context…" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Column">
            <select className="input" value={f.column} onChange={e => set('column', e.target.value)}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className="input" value={f.priority} onChange={e => set('priority', e.target.value)}>
              <option value="high">High</option><option value="med">Medium</option><option value="low">Low</option>
            </select>
          </Field>
          <Field label="Due date"><input className="input" type="date" value={f.due} onChange={e => set('due', e.target.value)} /></Field>
          <Field label="Linked contact">
            <select className="input" value={f.contactId} onChange={e => set('contactId', e.target.value)}>
              <option value="">None</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Subtasks" hint="One per line — show up as a checklist with progress">
          <textarea className="input" rows={2} value={f.subs} onChange={e => set('subs', e.target.value)}
            placeholder={"Research venues\nDraft guest list"} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!f.title.trim()}
          onClick={() => {
            addTask({
              title: f.title, column: f.column, priority: f.priority, desc: f.desc,
              due: f.due || null, contactId: f.contactId || null,
              subtasks: f.subs.split('\n').map(s => s.trim()).filter(Boolean).map((text, i) => ({ id: 'new' + i, text, done: false })),
            })
            toast('Task created'); onClose()
          }}>
          Create task
        </button>
      </div>
    </Modal>
  )
}
