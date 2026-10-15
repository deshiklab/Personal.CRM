import { Pin, Archive, ArchiveRestore, Trash2, RotateCcw, Bell, CheckSquare, Square } from 'lucide-react'
import { noteColorStyle, noteColorHex, noteChecked, NOTE_COLORS } from '../lib/notes'
import { mdToText } from '../lib/markdown'
import { tsRel, cn } from '../lib'

/* Keep-style masonry card. Hover toolbar = pin / archive / trash. */
export default function NoteCard({ note, labelById = {}, contactById = {}, view = 'grid', onOpen, onPin, onToggleItem, onArchive, onTrash, onRestore, onPurge }) {
  const hex = noteColorHex(note.color)
  const style = noteColorStyle(note.color)
  const checked = noteChecked(note)
  const linked = (note.contactIds || []).map(id => contactById[id]).filter(Boolean)
  /* body + checklist text only — the title is already on the card */
  const previewSrc = [mdToText(note.body), ...(note.checklist || []).map(c => c.text)].filter(Boolean).join(' · ')
  const preview = previewSrc.slice(0, view === 'list' ? 240 : 160)

  return (
    <div
      className={cn('note-card break-inside-avoid mb-3 rounded-2xl border cursor-pointer transition-shadow relative group',
        view === 'list' && 'mb-2')}
      style={{ borderColor: hex ? hex + '55' : 'var(--border)', background: hex ? hex + '1c' : 'var(--panel)', minHeight: 96 }}
      onClick={onOpen}>

      {/* hover toolbar */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
        style={{ background: 'rgba(10,12,17,.35)', borderRadius: 10 }}>
        {onPin && <button className="icon-btn !w-7 !h-7" title={note.pinned ? 'Unpin' : 'Pin'}
          onClick={e => { e.stopPropagation(); onPin() }}>
          <Pin size={12} style={note.pinned ? { color: '#fbbf24' } : undefined} fill={note.pinned ? '#fbbf24' : 'none'} />
        </button>}
        {view !== 'trash' && onArchive && <button className="icon-btn !w-7 !h-7" title={note.archivedAt ? 'Unarchive' : 'Archive'}
          onClick={e => { e.stopPropagation(); onArchive() }}>
          {note.archivedAt ? <ArchiveRestore size={12} /> : <Archive size={12} />}
        </button>}
        {view === 'trash'
          ? <>
              {onRestore && <button className="icon-btn !w-7 !h-7" title="Restore" onClick={e => { e.stopPropagation(); onRestore() }}><RotateCcw size={12} /></button>}
              {onPurge && <button className="icon-btn !w-7 !h-7" title="Delete forever" onClick={e => { e.stopPropagation(); onPurge() }}><Trash2 size={12} /></button>}
            </>
          : onTrash && <button className="icon-btn !w-7 !h-7" title="Move to trash" onClick={e => { e.stopPropagation(); onTrash() }}><Trash2 size={12} /></button>}
      </div>

      <div className="p-3.5">
        <div className="flex items-start gap-1.5">
          {note.pinned && <Pin size={11} style={{ color: '#fbbf24' }} className="flex-none mt-1" />}
          <div className="font-semibold text-[13px] leading-snug pr-12">{note.title || 'Untitled'}</div>
        </div>

        {/* checklist preview — tickable straight from the card */}
        {(note.checklist || []).length > 0 && (
          <div className="flex flex-col gap-1 mt-2">
            {note.checklist.slice(0, 5).map(it => (
              <button key={it.id} className="flex items-start gap-1.5 text-left text-[11.5px] leading-snug w-full"
                onClick={e => { e.stopPropagation(); onToggleItem?.(it.id) }}>
                {it.done ? <CheckSquare size={12} className="flex-none mt-[1px] text-emerald-400" /> : <Square size={12} className="flex-none mt-[1px] opacity-50" />}
                <span className={it.done ? 'line-through opacity-50' : ''} style={{ color: 'var(--muted)' }}>{it.text || '…'}</span>
              </button>
            ))}
            {note.checklist.length > 5 && <div className="text-[10px]" style={{ color: 'var(--faint)' }}>+{note.checklist.length - 5} more</div>}
          </div>
        )}

        {/* body preview */}
        {preview && (note.checklist || []).length === 0 && (
          <div className="text-[11.5px] mt-1.5 leading-relaxed" style={{ color: 'var(--muted)' }}>{preview}</div>
        )}
        {preview && (note.checklist || []).length > 0 && note.body && (
          <div className="text-[11px] mt-1.5 leading-relaxed opacity-70" style={{ color: 'var(--muted)' }}>{preview}</div>
        )}

        {/* labels */}
        {(note.labels || []).filter(l => labelById[l]).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {note.labels.filter(l => labelById[l]).map(l => (
              <span key={l} className="text-[9.5px] font-bold px-1.5 py-[2px] rounded-full"
                style={{ background: (labelById[l].color || '#818cf8') + '26', color: labelById[l].color || '#818cf8' }}>
                {labelById[l].name}
              </span>
            ))}
          </div>
        )}

        {/* footer: reminder, checklist count, contacts, time */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {note.remindAt && (
            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-[2px] rounded-full"
              style={{ background: 'rgba(251,191,36,.18)', color: '#fbbf24' }}>
              <Bell size={9} /> {note.remindAt.replace('T', ' ').slice(5)}{note.repeat !== 'none' ? ` ↻` : ''}
            </span>
          )}
          {note.kind === 'checklist' && (note.checklist || []).length > 0 && (
            <span className="text-[9.5px] font-bold px-1.5 py-[2px] rounded-full" style={{ background: 'rgba(52,211,153,.15)', color: '#34d399' }}>
              {checked}/{note.checklist.length} done
            </span>
          )}
          {note.archivedAt && <span className="text-[9.5px] font-semibold opacity-60" style={{ color: 'var(--faint)' }}>Archived</span>}
          {note.trashedAt && <span className="text-[9.5px] font-semibold text-rose-400/80">In trash</span>}
          <div className="flex -space-x-1.5 ml-auto">
            {linked.slice(0, 3).map(c => (
              <div key={c.id} className="w-[18px] h-[18px] rounded-full text-[8px] font-black grid place-items-center"
                style={{ background: 'rgba(129,140,248,.35)', border: '1.5px solid var(--panel)' }}
                title={c.name}>
                {(c.name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
          <span className="text-[9.5px] flex-none" style={{ color: 'var(--faint)' }}>{tsRel(note.updated)}</span>
        </div>
      </div>
    </div>
  )
}

export const colorSwatchProps = id => ({
  key: id, title: id || 'No color',
  style: id
    ? { background: NOTE_COLORS[id], borderColor: NOTE_COLORS[id] }
    : { background: 'transparent', borderColor: 'var(--border2)' },
})
