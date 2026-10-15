import { useMemo, useRef, useState } from 'react'
import {
  Pin, PinOff, Pencil, Eye, X, Plus, Check, Trash2, GitMerge, PlusSquare, Bell, BellOff,
  Share2, Copy, Download, Archive, ArchiveRestore, RotateCcw, Bold, Italic, Code, Heading,
  List, ListTodo, Quote, Link2, Clock,
} from 'lucide-react'
import { useCrm } from '../store'
import { Modal, Avatar, Pill, Seg } from './ui'
import { tsRel, cn } from '../lib'
import { mdToHtml, mdToText } from '../lib/markdown'
import { NOTE_COLORS, NOTE_COLOR_IDS, noteColorHex, noteWords, noteChecked, newChecklistItem, fmtLocalDT, TRASH_RETENTION_DAYS } from '../lib/notes'

const LABEL_COLORS = ['#818cf8', '#f472b6', '#fbbf24', '#34d399', '#38bdf8', '#fb7185', '#a78bfa', '#94a3b8']

export default function NoteEditor({ note, onClose }) {
  const crm = useCrm()
  const [mode, setMode] = useState('edit')
  const [linkQ, setLinkQ] = useState('')
  const [labelQ, setLabelQ] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const bodyRef = useRef(null)
  const words = noteWords(note)
  const linked = (note.contactIds || []).map(id => crm.contactById[id]).filter(Boolean)
  const suggestions = linkQ.trim()
    ? crm.contacts.filter(c => !(note.contactIds || []).includes(c.id) && c.name.toLowerCase().includes(linkQ.toLowerCase())).slice(0, 6)
    : []
  const patch = p => crm.updateNote(note.id, p)

  /* ── markdown helpers ── */
  const wrap = (before, after = before) => {
    const ta = bodyRef.current
    const body = note.body || ''
    if (!ta) { patch({ body: body + before + 'text' + after }); return }
    const s = ta.selectionStart, e = ta.selectionEnd
    const sel = body.slice(s, e) || 'text'
    patch({ body: body.slice(0, s) + before + sel + after + body.slice(e) })
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + before.length, s + before.length + sel.length) })
  }
  const prefixLine = prefix => {
    const ta = bodyRef.current
    const body = note.body || ''
    if (!ta) { patch({ body: body + `\n${prefix}` }); return }
    const s = ta.selectionStart
    const ls = body.lastIndexOf('\n', s - 1) + 1
    patch({ body: body.slice(0, ls) + prefix + body.slice(ls) })
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + prefix.length, s + prefix.length) })
  }

  /* ── checklist ── */
  const setChecklist = checklist => patch({ checklist })
  const toggleItem = id => setChecklist(note.checklist.map(c => c.id === id ? { ...c, done: !c.done } : c))
  const editItem = (id, text) => setChecklist(note.checklist.map(c => c.id === id ? { ...c, text } : c))
  const delItem = id => setChecklist(note.checklist.filter(c => c.id !== id))
  const addItem = text => { if (text.trim()) setChecklist([...note.checklist, newChecklistItem(text.trim())]) }

  /* ── labels ── */
  const toggleLabel = id => patch({ labels: note.labels.includes(id) ? note.labels.filter(x => x !== id) : [...note.labels, id] })
  const createLabel = () => {
    const name = labelQ.trim()
    if (!name) return
    const existing = crm.noteLabels.find(l => l.name.toLowerCase() === name.toLowerCase())
    const l = existing || crm.addNoteLabel(name, LABEL_COLORS[crm.noteLabels.length % LABEL_COLORS.length])
    if (!existing) crm.toast(`Label “${name}” created`)
    patch({ labels: [...new Set([...note.labels, l.id])] })
    setLabelQ('')
  }

  /* ── reminder quick chips ── */
  const setReminder = (offsetMs, repeat = 'none') =>
    patch({ remindAt: fmtLocalDT(new Date(Date.now() + offsetMs)), repeat })
  const REMINDER_CHIPS = [
    ['In 1 hour', 3600e3],
    ['Later today', null],
    ['Tomorrow 9:00', null],
    ['Next week', null],
  ]
  const quickReminder = label => {
    const now = new Date()
    if (label === 'In 1 hour') return setReminder(3600e3)
    if (label === 'Later today') {
      const d = new Date(now); d.setHours(18, 0, 0, 0)
      if (d < now) d.setDate(d.getDate() + 1)
      return patch({ remindAt: fmtLocalDT(d), repeat: 'none' })
    }
    if (label === 'Tomorrow 9:00') {
      const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0)
      return patch({ remindAt: fmtLocalDT(d), repeat: 'none' })
    }
    if (label === 'Next week') {
      const d = new Date(now); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0)
      return patch({ remindAt: fmtLocalDT(d), repeat: 'none' })
    }
  }

  /* ── share / export / duplicate / merge ── */
  const asMarkdown = () => {
    const lines = [`# ${note.title || 'Untitled'}`, '']
    if (note.body) lines.push(note.body, '')
    if (note.checklist.length) lines.push(...note.checklist.map(c => `- [${c.done ? 'x' : ' '}] ${c.text}`), '')
    if (linked.length) lines.push(`**Linked contacts:** ${linked.map(c => c.name).join(', ')}`)
    return lines.join('\n')
  }
  const shareNote = async () => {
    const text = `${note.title || 'Untitled'}\n\n${mdToText(note.body)}${note.checklist.length ? '\n' + note.checklist.map(c => `${c.done ? '☑' : '☐'} ${c.text}`).join('\n') : ''}`
    try {
      if (navigator.share) { await navigator.share({ title: note.title || 'Note', text }); return }
      await navigator.clipboard.writeText(text)
      crm.toast('Note copied to clipboard')
    } catch { crm.toast('Share cancelled', 'warn') }
  }
  const exportMd = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([asMarkdown()], { type: 'text/markdown' }))
    a.download = `${(note.title || 'note').replace(/[^\w\- ]+/g, '').slice(0, 40) || 'note'}.md`
    document.body.appendChild(a); a.click(); a.remove()
    crm.toast('Exported as .md')
  }
  const merge = () => {
    linked.forEach(c => crm.logActivity(`Note merged: \"${note.title}\"`, c.id))
    crm.logAudit('user', 'Merged note into timeline', note.title, `${linked.length} contact(s)`)
    patch({ mergedAt: new Date().toISOString() })
    crm.toast(`Merged into ${linked.length} contact timeline(s)`)
  }

  const hex = noteColorHex(note.color)

  return (
      <Modal open onClose={onClose} size="xl" title={
      <span className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: hex || 'var(--border2)' }} />
        {note.trashedAt ? 'Trashed note' : note.archivedAt ? 'Archived note' : 'Note'}
      </span>}>
      <div data-testid="note-editor">

      {/* title + pin + mode */}
      <div className="flex items-center gap-2 flex-wrap">
        <input className="bg-transparent font-bold text-[18px] tracking-tight outline-none flex-1 min-w-[200px]"
          value={note.title} placeholder="Title"
          onChange={e => patch({ title: e.target.value })} />
        <button className="icon-btn" title={note.pinned ? 'Unpin' : 'Pin to top'} onClick={() => patch({ pinned: !note.pinned })}>
          {note.pinned ? <Pin size={15} style={{ color: '#fbbf24' }} fill="#fbbf24" /> : <PinOff size={15} />}
        </button>
        <Seg value={mode} onChange={setMode}
          options={[{ value: 'edit', label: <span className="inline-flex items-center gap-1.5"><Pencil size={12} /> Write</span> },
                    { value: 'preview', label: <span className="inline-flex items-center gap-1.5"><Eye size={12} /> Preview</span> }]} />
      </div>

      {/* meta row */}
      <div className="flex items-center gap-3 mt-2 text-[11px] flex-wrap" style={{ color: 'var(--faint)' }}>
        <span>updated {tsRel(note.updated)}</span>
        <span>· {words} words</span>
        {note.checklist.length > 0 && <span>· {noteChecked(note)}/{note.checklist.length} checked</span>}
        {note.mergedAt && <Pill color="#34d399"><GitMerge size={10} /> merged {tsRel(note.mergedAt)}</Pill>}
      </div>

      {/* colors */}
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--faint)' }}>Color</span>
        <button className={cn('w-[18px] h-[18px] rounded-full border-2 transition-transform hover:scale-110')}
          style={{ background: 'transparent', borderColor: note.color ? 'var(--border2)' : 'var(--text)' }}
          title="No color" onClick={() => patch({ color: null })} />
        {NOTE_COLOR_IDS.map(id => (
          <button key={id} className="w-[18px] h-[18px] rounded-full border-2 transition-transform hover:scale-110"
            style={{ background: NOTE_COLORS[id], borderColor: note.color === id ? 'var(--text)' : NOTE_COLORS[id] }}
            title={id} onClick={() => patch({ color: id })} />
        ))}
      </div>

      {/* labels */}
      <div className="mt-3">
        <div className="label">Labels</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {crm.noteLabels.map(l => (
            <button key={l.id} className={cn('chip chip-btn', note.labels.includes(l.id) && 'on')}
              style={note.labels.includes(l.id) ? { background: l.color + '26', borderColor: l.color + '77', color: l.color } : {}}
              onClick={() => toggleLabel(l.id)}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: l.color }} /> {l.name}
            </button>
          ))}
          <input className="input" style={{ width: 130, padding: '4px 9px', fontSize: 11.5 }} placeholder="+ New label…"
            value={labelQ} onChange={e => setLabelQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createLabel() }} />
          {note.labels.length > 0 && <button className="text-[11px] underline opacity-60" onClick={() => patch({ labels: [] })}>clear</button>}
        </div>
      </div>

      {/* reminder */}
      <div className="mt-3">
        <div className="label">Reminder</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {note.remindAt
            ? <>
                <span className="chip on inline-flex items-center gap-1.5" style={{ borderColor: '#fbbf2477' }}>
                  <Bell size={11} style={{ color: '#fbbf24' }} />
                  <input type="datetime-local" className="bg-transparent outline-none text-[11.5px]"
                    value={note.remindAt} onChange={e => patch({ remindAt: e.target.value || null })} />
                </span>
                <select className="input" style={{ width: 110, padding: '4px 8px', fontSize: 11.5 }}
                  value={note.repeat} onChange={e => patch({ repeat: e.target.value })}>
                  <option value="none">No repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <button className="icon-btn !w-7 !h-7" title="Clear reminder" onClick={() => patch({ remindAt: null, repeat: 'none' })}><BellOff size={12} /></button>
              </>
            : <>
                {['In 1 hour', 'Later today', 'Tomorrow 9:00', 'Next week'].map(l => (
                  <button key={l} className="chip chip-btn" onClick={() => quickReminder(l)}><Clock size={10} /> {l}</button>
                ))}
                <label className="chip chip-btn inline-flex items-center gap-1 cursor-pointer">
                  <Bell size={10} /> Pick time
                  <input type="datetime-local" className="hidden" onChange={e => e.target.value && patch({ remindAt: e.target.value, repeat: 'none' })} />
                </label>
              </>}
        </div>
      </div>

      {/* linked contacts */}
      <div className="mt-3">
        <div className="label">Linked contacts</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {linked.map(c => (
            <span key={c.id} className="chip">
              <Avatar name={c.name} size={16} /> {c.name}
              <button className="opacity-60 hover:opacity-100 ml-0.5" onClick={() => patch({ contactIds: note.contactIds.filter(x => x !== c.id) })}><X size={11} /></button>
            </span>
          ))}
          <div className="relative">
            <input className="input" style={{ width: 170, padding: '5px 10px', fontSize: 12 }} placeholder="+ Link a contact…"
              value={linkQ} onChange={e => setLinkQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && suggestions[0]) { patch({ contactIds: [...note.contactIds, suggestions[0].id] }); setLinkQ('') } }} />
            {suggestions.length > 0 && (
              <div className="panel absolute z-20 mt-1 w-56 p-1.5 flex flex-col gap-0.5">
                {suggestions.map(c => (
                  <button key={c.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-white/[.06] text-left"
                    onClick={() => { patch({ contactIds: [...note.contactIds, c.id] }); setLinkQ('') }}>
                    <Avatar name={c.name} size={22} />
                    <span className="text-[12.5px] font-medium truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* checklist */}
      {(note.kind === 'checklist' || note.checklist.length > 0) && (
        <div className="mt-3">
          <div className="label">Checklist</div>
          <div className="flex flex-col gap-1">
            {note.checklist.map(it => (
              <div key={it.id} className="flex items-center gap-2 group/item">
                <button className="flex-none" onClick={() => toggleItem(it.id)} title={it.done ? 'Mark undone' : 'Mark done'}>
                  {it.done ? <Check size={14} className="text-emerald-400" /> : <span className="w-[14px] h-[14px] rounded-[4px] border inline-block" style={{ borderColor: 'var(--border2)' }} />}
                </button>
                <input className={cn('bg-transparent flex-1 outline-none text-[12.5px]', it.done && 'line-through opacity-50')}
                  value={it.text} onChange={e => editItem(it.id, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { const inp = document.getElementById('note-add-item'); inp?.focus() } }} />
                <button className="opacity-0 group-hover/item:opacity-100 icon-btn !w-6 !h-6" title="Remove" onClick={() => delItem(it.id)}><X size={11} /></button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Plus size={13} style={{ color: 'var(--faint)' }} className="flex-none" />
              <input id="note-add-item" className="bg-transparent flex-1 outline-none text-[12.5px]" placeholder="List item…"
                onKeyDown={e => { if (e.key === 'Enter' && e.target.value.trim()) { addItem(e.target.value); e.target.value = '' } }} />
            </div>
          </div>
        </div>
      )}
      {note.kind !== 'checklist' && note.checklist.length === 0 && (
        <button className="chip chip-btn mt-3" onClick={() => patch({ kind: 'checklist' })}>
          <ListTodo size={11} /> Turn into checklist
        </button>
      )}

      {/* body */}
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <div className="label">{note.kind === 'checklist' ? 'Description' : 'Note'}</div>
          {mode === 'edit' && (
            <div className="flex items-center gap-0.5">
              {[[Bold, () => wrap('**')], [Italic, () => wrap('*')], [Code, () => wrap('`')],
                [Heading, () => prefixLine('## ')], [List, () => prefixLine('- ')], [ListTodo, () => prefixLine('- [ ] ')],
                [Quote, () => prefixLine('> ')], [Link2, () => wrap('[', '](https://)')]].map(([Ic, fn], i) => (
                <button key={i} className="icon-btn !w-7 !h-7" onClick={fn}><Ic size={12} /></button>
              ))}
            </div>
          )}
        </div>
        {mode === 'edit' ? (
          <textarea ref={bodyRef} className="input font-mono" style={{ fontSize: 13, lineHeight: 1.7, minHeight: 200, resize: 'vertical' }}
            placeholder={'Write in Markdown…\n\n# Heading\n**bold** · *italic* · `code`\n- bullet lists\n- [ ] task items\n> quotes'}
            value={note.body} onChange={e => patch({ body: e.target.value })} />
        ) : (
          <div className="md card p-4" style={{ minHeight: 200 }}
            dangerouslySetInnerHTML={{ __html:
              (note.checklist.length
                ? `<ul class="md-tasks">${note.checklist.map(c => `<li class="md-task${c.done ? ' done' : ''}">${(c.text || '').replace(/</g, '&lt;')}</li>`).join('')}</ul>`
                : '') +
              (mdToHtml(note.body) || (note.checklist.length ? '' : '<p style="color:var(--faint)">Nothing to preview yet.</p>')) }} />
        )}
      </div>

      {/* actions */}
      <div className="flex items-center gap-2 mt-5 pt-4 border-t flex-wrap" style={{ borderColor: 'rgba(255,255,255,.06)' }}>
        <button className="btn btn-ghost btn-sm" onClick={shareNote}><Share2 size={13} /> Share</button>
        <button className="btn btn-ghost btn-sm" onClick={exportMd}><Download size={13} /> .md</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const n = crm.duplicateNote(note.id); crm.toast('Note duplicated'); onClose?.(n?.id) }}><Copy size={13} /> Duplicate</button>
        <button className="btn btn-ghost btn-sm"
          onClick={() => { crm.addTask({ title: note.title || 'Note follow-up', column: 'todo', priority: 'med', due: null, contactId: note.contactIds?.[0] || null }); crm.toast('Task created from note') }}>
          <PlusSquare size={13} /> Turn into task
        </button>
        <button className="btn btn-primary btn-sm" disabled={linked.length === 0}
          title={linked.length === 0 ? 'Link at least one contact first' : `Push this note into ${linked.length} contact timeline(s)`}
          onClick={merge}>
          <GitMerge size={13} /> Merge into timeline {linked.length > 0 && `(${linked.length})`}
        </button>

        <div className="ml-auto flex items-center gap-2">
          {note.trashedAt
            ? <>
                <button className="btn btn-ghost btn-sm" onClick={() => { crm.restoreNote(note.id); crm.toast('Note restored'); onClose?.() }}>
                  <RotateCcw size={13} /> Restore
                </button>
                {confirmDel
                  ? <button className="btn btn-danger btn-sm" onClick={() => { crm.purgeNote(note.id); crm.toast('Note deleted forever'); onClose?.() }}>Sure? Delete forever</button>
                  : <button className="btn btn-ghost btn-sm" onClick={() => { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 2500) }}><Trash2 size={13} /> Delete forever</button>}
                <span className="text-[10px]" style={{ color: 'var(--faint)' }}>auto-purges after {TRASH_RETENTION_DAYS}d</span>
              </>
            : <>
                <button className="btn btn-ghost btn-sm" onClick={() => { crm.toggleArchiveNote(note.id); crm.toast(note.archivedAt ? 'Unarchived' : 'Archived'); onClose?.() }}>
                  {note.archivedAt ? <><ArchiveRestore size={13} /> Unarchive</> : <><Archive size={13} /> Archive</>}
                </button>
                {confirmDel
                  ? <button className="btn btn-danger btn-sm" onClick={() => { crm.trashNote(note.id); crm.toast('Moved to trash'); onClose?.() }}>Sure? Move to trash</button>
                  : <button className="btn btn-ghost btn-sm" onClick={() => { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 2500) }}><Trash2 size={13} /> Trash</button>}
              </>}
        </div>
      </div>
      </div>
    </Modal>
  )
}
