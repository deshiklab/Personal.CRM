import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, CheckSquare, StickyNote, Calendar, UsersRound, Tag, Plus, CornerDownLeft, History, Zap } from 'lucide-react'
import { useCrm } from '../store'
import { Avatar, Panel } from './ui'
import { cn } from '../lib'

const TYPES = [
  { id: 'contacts', label: 'Contacts', icon: Users, color: '#818cf8' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, color: '#38bdf8' },
  { id: 'notes', label: 'Notes', icon: StickyNote, color: '#fbbf24' },
  { id: 'events', label: 'Events', icon: Calendar, color: '#a78bfa' },
  { id: 'groups', label: 'Groups', icon: UsersRound, color: '#34d399' },
  { id: 'tags', label: 'Tags', icon: Tag, color: '#f472b6' },
]
const TMAP = Object.fromEntries(TYPES.map(t => [t.id, t]))

const ACTIONS = [
  { type: 'action', id: 'a1', title: 'New contact', subtitle: 'Add someone to your network', to: '/contacts?new=1' },
  { type: 'action', id: 'a2', title: 'New task', subtitle: 'Drop it on the kanban', to: '/tasks?new=1' },
  { type: 'action', id: 'a3', title: 'New note', subtitle: 'Markdown, with contact links', to: '/notes?new=1' },
  { type: 'action', id: 'a4', title: 'New event', subtitle: 'Schedule on the calendar', to: '/calendar?new=1' },
]

export default function GlobalSearch() {
  const crm = useCrm()
  const { contacts, tasks, notes, events, groups, tags, contactById, groupById, tagById } = crm
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [active, setActive] = useState(0)
  const [recents, setRecents] = useState([])

  /* global ⌘K / Ctrl+K + custom event from Topbar */
  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o) }
    }
    const onCustom = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('crm:search', onCustom)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('crm:search', onCustom) }
  }, [])

  useEffect(() => {
    if (open) { setQuery(''); setFilter('all'); setActive(0); setTimeout(() => inputRef.current?.focus(), 40) }
  }, [open])

  /* unified index across all entity types */
  const index = useMemo(() => {
    const items = []
    contacts.forEach(c => items.push({
      type: 'contacts', id: c.id, title: c.name,
      subtitle: [c.role, c.company].filter(Boolean).join(' · ') || 'Contact',
      keywords: `${c.email || ''} ${c.phone || ''} ${(c.tags || []).map(t => tagById[t]?.name || '').join(' ')} ${(c.interests || []).join(' ')} ${c.introducedBy || ''} ${c.company || ''} ${c.role || ''} ${Object.values(c.socials || {}).join(' ')}`,
      badge: groupById[c.groupId]?.name, to: `/contacts?open=${c.id}`,
    }))
    tasks.forEach(t => items.push({
      type: 'tasks', id: t.id, title: t.title,
      subtitle: `${t.column} · ${t.priority}${t.due ? ` · due ${t.due}` : ''}`,
      keywords: t.contactId ? contactById[t.contactId]?.name || '' : '',
      to: `/tasks?focus=${t.id}`,
    }))
    notes.forEach(n => items.push({
      type: 'notes', id: n.id, title: n.title || 'Untitled note',
      subtitle: n.body ? n.body.slice(0, 70) : 'Empty note',
      keywords: (n.contactIds || []).map(id => contactById[id]?.name || '').join(' '),
      badge: n.pinned ? 'Pinned' : null, to: `/notes?open=${n.id}`,
    }))
    events.forEach(e => items.push({
      type: 'events', id: e.id, title: e.title,
      subtitle: `${e.date} · ${e.time}${e.location ? ` · ${e.location}` : ''}`,
      keywords: `${e.location || ''} ${e.contactId ? contactById[e.contactId]?.name || '' : ''}`,
      to: `/calendar?event=${e.id}`,
    }))
    groups.forEach(g => items.push({
      type: 'groups', id: g.id, title: g.name,
      subtitle: g.desc || `${contacts.filter(c => c.groupId === g.id).length} contacts`,
      keywords: '', to: `/contacts?group=${g.id}`,
    }))
    tags.forEach(t => items.push({
      type: 'tags', id: t.id, title: t.name, subtitle: 'Tag',
      keywords: t.icon, to: `/tags?tag=${t.id}`,
    }))
    return items
  }, [contacts, tasks, notes, events, groups, tags, contactById, groupById, tagById])

  /* scoring + filtering */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = filter === 'all' ? index : index.filter(i => i.type === filter)
    if (!q) return filter === 'all' ? [] : pool.slice(0, 12).map(i => ({ ...i, score: 0 }))
    return pool.map(i => {
      const title = i.title.toLowerCase()
      const rest = `${i.subtitle} ${i.keywords}`.toLowerCase()
      let score = 0
      if (title === q) score = 6
      else if (title.startsWith(q)) score = 4
      else if (title.includes(q)) score = 3
      else if (rest.includes(q)) score = 1.5
      const item = { ...i, score }
      /* why did this contact match? surface the facet */
      if (i.type === 'contacts' && score > 0 && !title.includes(q)) {
        const c = contactById[i.id]
        const hit = (c.interests || []).find(x => x.toLowerCase().includes(q))
        if (hit) item.facet = `🎯 into ${hit}`
        else if (c.company?.toLowerCase().includes(q)) item.facet = `works at ${c.company}`
        else if (c.role?.toLowerCase().includes(q)) item.facet = c.role
        else if (c.introducedBy?.toLowerCase().includes(q)) item.facet = `via ${c.introducedBy}`
        else if ((c.tags || []).some(t => tagById[t]?.name.toLowerCase().includes(q))) item.facet = `tagged ${tagById[c.tags.find(t => tagById[t]?.name.toLowerCase().includes(q))]?.name}`
      }
      return item
    }).filter(i => i.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 15)
  }, [index, query, filter])

  const recentItems = useMemo(() =>
    recents.map(r => index.find(i => i.type === r.type && i.id === r.id)).filter(Boolean).slice(0, 5),
    [recents, index])

  /* sections for display */
  const sectioned = useMemo(() => {
    if (query.trim() || filter !== 'all') {
      const map = []
      results.forEach(r => {
        let s = map.find(m => m.id === r.type)
        if (!s) { s = { id: r.type, items: [] }; map.push(s) }
        s.items.push(r)
      })
      return map
    }
    const out = []
    if (recentItems.length) out.push({ id: 'recent', items: recentItems })
    out.push({ id: 'actions', items: ACTIONS })
    return out
  }, [results, query, filter, recentItems])

  const flat = useMemo(() => sectioned.flatMap(s => s.items), [sectioned])
  useEffect(() => setActive(0), [query, filter])

  const exec = item => {
    if (!item) return
    if (item.type !== 'action') {
      setRecents(r => [{ type: item.type, id: item.id }, ...r.filter(x => !(x.type === item.type && x.id === item.id))].slice(0, 6))
    }
    setOpen(false)
    navigate(item.to)
  }

  const onKeyDown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(flat.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); exec(flat[active] || flat[0]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  if (!open) return null

  let rowIndex = -1
  const sectionTitle = id => {
    if (id === 'recent') return <span className="inline-flex items-center gap-1.5"><History size={11} /> Recent</span>
    if (id === 'actions') return <span className="inline-flex items-center gap-1.5"><Zap size={11} /> Quick actions</span>
    return TMAP[id]?.label
  }
  const total = results.length

  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto p-4 flex justify-center items-start"
      style={{ background: 'rgba(6,8,12,.65)', backdropFilter: 'blur(5px)', paddingTop: '12vh' }}
      onClick={() => setOpen(false)}>
      <Panel className="fadein w-full max-w-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
          <Search size={16} style={{ color: 'var(--i1)' }} className="flex-none" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search contacts, tasks, notes, events, groups, tags…"
            className="flex-1 bg-transparent outline-none text-[14.5px] placeholder:text-[#6b7382]" />
          <kbd className="chip" style={{ fontSize: 10, padding: '1px 7px' }}>esc</kbd>
        </div>

        {/* type filters */}
        <div className="flex gap-1.5 px-4 pt-3 flex-wrap">
          <button className={`chip chip-btn ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>All</button>
          {TYPES.map(t => (
            <button key={t.id} className={`chip chip-btn ${filter === t.id ? 'on' : ''}`} onClick={() => setFilter(f => f === t.id ? 'all' : t.id)}>
              <t.icon size={11} /> {t.label}
            </button>
          ))}
        </div>

        {/* results */}
        <div className="px-2 py-2 max-h-[46vh] overflow-y-auto">
          {sectioned.length === 0 && (
            <div className="py-10 text-center text-[13px]" style={{ color: 'var(--faint)' }}>
              No matches for “{query}” — try a name, company, phone, or tag.
            </div>
          )}
          {sectioned.map(sec => (
            <div key={sec.id} className="mb-1.5">
              <div className="px-3 pt-2 pb-1 text-[10.5px] font-bold uppercase tracking-[.09em]" style={{ color: 'var(--faint)' }}>
                {sectionTitle(sec.id)}
              </div>
              {sec.items.map(item => {
                rowIndex++
                const idx = rowIndex
                const t = TMAP[item.type]
                const isActive = idx === active
                return (
                  <button key={`${item.type}-${item.id}`}
                    className={cn('w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors', isActive ? 'bg-indigo-400/18' : 'hover:bg-white/[.04]')}
                    onMouseEnter={() => setActive(idx)} onClick={() => exec(item)}>
                    {item.type === 'contacts'
                      ? <Avatar name={item.title} size={28} />
                      : item.type === 'action'
                        ? <span className="w-7 h-7 rounded-lg grid place-items-center flex-none" style={{ background: '#34d3991c', color: '#34d399' }}><Plus size={14} /></span>
                        : <span className="w-7 h-7 rounded-lg grid place-items-center flex-none" style={{ background: t.color + '1c', color: t.color }}><t.icon size={14} /></span>}
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13.5px] font-semibold truncate">{item.title}</span>
                      <span className="block text-[11.5px] truncate" style={{ color: 'var(--muted)' }}>{item.subtitle}</span>
                    </span>
                    {item.facet && <span className="chip flex-none" style={{ color: 'var(--i2)', borderColor: '#38bdf844', background: '#38bdf812' }}>{item.facet}</span>}
                    {item.badge && <span className="chip flex-none">{item.badge}</span>}
                    {isActive && <CornerDownLeft size={13} className="flex-none" style={{ color: 'var(--i1)' }} />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* footer */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t text-[10.5px] font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--faint)' }}>
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
          <span className="ml-auto">{query ? `${total} result${total === 1 ? '' : 's'}` : `${index.length} records indexed`} · client-side instant index</span>
        </div>
      </Panel>
    </div>
  )
}
