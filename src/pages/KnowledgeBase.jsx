import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOpen, Plus, Search, Star, FolderPlus, Folder, Hash, Clock, Trash2,
  ChevronRight, ChevronDown, FileText, X,
} from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Card, Stat, Pill, Empty, Modal, Field, TagPill } from '../components/ui'
import {
  articleMatches, childrenOf, descendantIds, KB_TEMPLATES,
} from '../lib/wiki'
import { tsRel } from '../lib'

const ICONS = ['📚', '🎯', '📖', '👥', '🗺️', '💡', '🧠', '🗂️', '⚙️', '🌱', '🔥', '🎨']
const COLORS = ['#34d399', '#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#fbbf24', '#fb7185', '#2dd4bf']

export default function KnowledgeBase() {
  const crm = useCrm()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [newCol, setNewCol] = useState(null)        // parentId for the modal
  const [pickTemplate, setPickTemplate] = useState(false)
  const [openNodes, setOpenNodes] = useState({ kc1: true, kc2: true, kc3: true })

  const { kbArticles, kbCollections, kbViews } = crm
  const activeCollection = params.get('collection')

  /* ?new=1 deep link (GlobalSearch action) */
  useEffect(() => {
    if (params.get('new')) { setPickTemplate(true); setParams(p => { p.delete('new'); return p }, { replace: true }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scopeIds = useMemo(() => {
    if (!activeCollection) return null
    return new Set([activeCollection, ...descendantIds(kbCollections, activeCollection)])
  }, [activeCollection, kbCollections])

  const visible = useMemo(() => kbArticles
    .filter(a => !scopeIds || scopeIds.has(a.collectionId))
    .filter(a => articleMatches(a, q))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    [kbArticles, scopeIds, q])

  const favorites = kbArticles.filter(a => a.favorite)
  const linkCount = kbArticles.reduce((n, a) => n + (a.body.match(/\[\[/g) || []).length, 0)
  const tagCloud = useMemo(() => {
    const m = new Map()
    kbArticles.forEach(a => (a.tags || []).forEach(t => m.set(t, (m.get(t) || 0) + 1)))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [kbArticles])
  const recent = useMemo(() =>
    Object.entries(kbViews)
      .sort((a, b) => (b[1] || '').localeCompare(a[1] || ''))
      .map(([id]) => kbArticles.find(a => a.id === id)).filter(Boolean).slice(0, 5),
    [kbViews, kbArticles])

  const createFromTemplate = tpl => {
    const a = crm.addKbArticle({
      title: tpl ? tpl.title + new Date().toISOString().slice(0, 10) : 'Untitled article',
      body: tpl ? tpl.body : '# Untitled article\n\n',
      collectionId: activeCollection || null,
    })
    setPickTemplate(false)
    navigate(`/kb/${a.id}`)
  }

  return (
    <div className="max-w-[1180px] mx-auto" data-testid="kb-home">
      <SectionHead
        kicker="New module · 6"
        title="Knowledge Base"
        sub="A personal wiki — long-form articles with [[wiki-links]], nested collections and backlinks, next to your quick notes."
        right={<div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" data-testid="new-collection-btn" onClick={() => setNewCol(activeCollection || null)}><FolderPlus size={13} /> Collection</button>
          <button className="btn btn-primary btn-sm" data-testid="new-article-btn" onClick={() => setPickTemplate(true)}><Plus size={13} /> Article</button>
        </div>}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat icon={BookOpen} label="Articles" value={kbArticles.length} tone="#2dd4bf" />
        <Stat icon={Folder} label="Collections" value={kbCollections.length} tone="#818cf8" />
        <Stat icon={Hash} label="Wiki-links" value={linkCount} tone="#34d399" />
        <Stat icon={Star} label="Favorites" value={favorites.length} tone="#fbbf24" />
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
          <input className="input pl-9" placeholder="Search articles — title, body, tags…" data-testid="kb-search"
            value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {activeCollection && (
          <button className="chip chip-btn on" data-testid="clear-collection" onClick={() => setParams({})}>
            <Folder size={11} /> {crm.kbCollectionById[activeCollection]?.name || 'collection'} <X size={11} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_220px] gap-4 items-start">
        {/* collection tree */}
        <Card className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[.09em]" style={{ color: 'var(--faint)' }}>Collections</span>
            <button className="icon-btn !w-6 !h-6" title="New collection" onClick={() => setNewCol(null)}><Plus size={12} /></button>
          </div>
          <CollectionTree
            collections={kbCollections} articles={kbArticles} activeId={activeCollection}
            openNodes={openNodes} setOpenNodes={setOpenNodes}
            onPick={id => setParams({ collection: id })}
            onAddChild={id => setNewCol(id)}
          />
        </Card>

        {/* articles */}
        <div className="flex flex-col gap-2" data-testid="kb-articles">
          {visible.length === 0 && (
            <Card><Empty icon={BookOpen} title="No articles yet">
              Start with a template — meeting notes, a project brief, a book summary — or write from scratch.
            </Empty></Card>
          )}
          {visible.map(a => (
            <Card key={a.id} className="p-4 cursor-pointer hover:translate-y-0 transition-transform" data-testid={`kb-card-${a.id}`}
              onClick={() => navigate(`/kb/${a.id}`)}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl grid place-items-center flex-none" style={{ background: 'rgba(45,212,191,.12)', color: '#2dd4bf' }}>
                  <FileText size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-[14px] tracking-tight truncate">{a.title}</h3>
                    {a.favorite && <Star size={12} style={{ color: '#fbbf24' }} fill="#fbbf24" />}
                  </div>
                  {a.summary && <div className="text-[12px] mt-0.5 line-clamp-2" style={{ color: 'var(--muted)' }}>{a.summary}</div>}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {a.collectionId && (
                      <Pill color={crm.kbCollectionById[a.collectionId]?.color || '#94a3b8'}>
                        {crm.kbCollectionById[a.collectionId]?.icon} {crm.kbCollectionById[a.collectionId]?.name || 'unknown'}
                      </Pill>
                    )}
                    {(a.tags || []).map(t => <TagPill key={t} tag={{ id: t, name: t }} small />)}
                    <span className="text-[10.5px] ml-auto" style={{ color: 'var(--faint)' }}>updated {tsRel(a.updatedAt)}</span>
                  </div>
                </div>
                <button className="icon-btn !w-7 !h-7 flex-none" title={a.favorite ? 'Unfavorite' : 'Favorite'}
                  onClick={e => { e.stopPropagation(); crm.updateKbArticle(a.id, { favorite: !a.favorite }) }}>
                  <Star size={13} style={{ color: a.favorite ? '#fbbf24' : 'var(--muted)' }} fill={a.favorite ? '#fbbf24' : 'none'} />
                </button>
              </div>
            </Card>
          ))}
        </div>

        {/* right rail */}
        <div className="flex flex-col gap-3">
          {favorites.length > 0 && (
            <Card className="p-3">
              <div className="text-[10px] font-bold uppercase tracking-[.09em] mb-2" style={{ color: 'var(--faint)' }}>Pinned</div>
              {favorites.slice(0, 5).map(a => (
                <button key={a.id} className="flex items-center gap-2 w-full text-left rounded-lg px-2 py-1.5 hover:bg-white/[.05] text-[12px] font-semibold"
                  onClick={() => navigate(`/kb/${a.id}`)}>
                  <Star size={11} style={{ color: '#fbbf24' }} fill="#fbbf24" className="flex-none" />
                  <span className="truncate">{a.title}</span>
                </button>
              ))}
            </Card>
          )}
          {recent.length > 0 && (
            <Card className="p-3">
              <div className="text-[10px] font-bold uppercase tracking-[.09em] mb-2" style={{ color: 'var(--faint)' }}>Recently viewed</div>
              {recent.map(a => (
                <button key={a.id} className="flex items-center gap-2 w-full text-left rounded-lg px-2 py-1.5 hover:bg-white/[.05] text-[12px]"
                  onClick={() => navigate(`/kb/${a.id}`)}>
                  <Clock size={11} style={{ color: 'var(--faint)' }} className="flex-none" />
                  <span className="truncate">{a.title}</span>
                </button>
              ))}
            </Card>
          )}
          {tagCloud.length > 0 && (
            <Card className="p-3">
              <div className="text-[10px] font-bold uppercase tracking-[.09em] mb-2" style={{ color: 'var(--faint)' }}>Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {tagCloud.map(([t, n]) => (
                  <button key={t} className="chip chip-btn" onClick={() => setQ(t)}>
                    <Hash size={9} /> {t} <span style={{ color: 'var(--faint)' }}>{n}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <NewCollectionModal open={newCol !== null} parentId={newCol} onClose={() => setNewCol(null)} />
      <Modal open={pickTemplate} onClose={() => setPickTemplate(false)} title="New article">
        <div className="flex flex-col gap-2" data-testid="template-picker">
          <button className="card p-3.5 text-left hover:translate-y-0" data-testid="tpl-blank"
            onClick={() => createFromTemplate(null)}>
            <div className="flex items-center gap-2.5">
              <span className="text-[17px]">✏️</span>
              <div><div className="font-bold text-[13px]">Blank article</div>
                <div className="text-[11.5px]" style={{ color: 'var(--faint)' }}>Start from scratch</div></div>
            </div>
          </button>
          {KB_TEMPLATES.map(t => (
            <button key={t.id} className="card p-3.5 text-left hover:translate-y-0" data-testid={`tpl-${t.id}`}
              onClick={() => createFromTemplate(t)}>
              <div className="flex items-center gap-2.5">
                <span className="text-[17px]">{t.icon}</span>
                <div><div className="font-bold text-[13px]">{t.name}</div>
                  <div className="text-[11.5px] truncate" style={{ color: 'var(--faint)' }}>
                    {(t.body.split('\n').find(l => l.startsWith('##')) || t.body.split('\n')[1] || '').replace(/^#+\s*/, '')}
                  </div></div>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}

function CollectionTree({ collections, articles, activeId, openNodes, setOpenNodes, onPick, onAddChild }) {
  return (
    <div className="flex flex-col gap-0.5">
      {collections.length === 0 && (
        <div className="text-[11.5px] px-2 py-1" style={{ color: 'var(--faint)' }}>No collections yet</div>
      )}
      <TreeLevel parentId={null} {...{ collections, articles, activeId, openNodes, setOpenNodes, onPick, onAddChild }} />
    </div>
  )
}

function TreeLevel({ parentId, collections, articles, activeId, openNodes, setOpenNodes, onPick, onAddChild, depth }) {
  const crm = useCrm()
  const nodes = childrenOf(collections, parentId)
  return nodes.map(c => {
    const kids = childrenOf(collections, c.id)
    const count = articles.filter(a => a.collectionId === c.id).length
    const open = openNodes[c.id] !== false
    return (
      <div key={c.id} data-testid={`kb-col-${c.id}`}>
        <div className="flex items-center gap-1 rounded-xl px-2 py-1.5 cursor-pointer hover:bg-white/[.05]"
          style={activeId === c.id ? { background: c.color + '1c' } : undefined}>
          {kids.length > 0 ? (
            <button className="icon-btn !w-5 !h-5" title={open ? 'Collapse' : 'Expand'}
              onClick={() => setOpenNodes(o => ({ ...o, [c.id]: !open }))}>
              {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          ) : <span className="w-5" />}
          <button className="flex items-center gap-1.5 flex-1 min-w-0 text-left text-[12.5px] font-semibold"
            onClick={() => onPick(c.id)}>
            <span>{c.icon}</span>
            <span className="truncate">{c.name}</span>
            <span className="text-[10px]" style={{ color: 'var(--faint)' }}>{count}</span>
          </button>
          <button className="icon-btn !w-5 !h-5" title="Add sub-collection" onClick={() => onAddChild(c.id)}><Plus size={10} /></button>
          <button className="icon-btn !w-5 !h-5" title="Delete collection"
            onClick={() => { if (confirm(`Delete collection "${c.name}"? Children move up, articles stay.`)) crm.deleteKbCollection(c.id) }}>
            <Trash2 size={10} />
          </button>
        </div>
        {open && kids.length > 0 && (
          <div style={{ paddingLeft: 12 }}>
            <TreeLevel parentId={c.id} {...{ collections, articles, activeId, openNodes, setOpenNodes, onPick, onAddChild }} />
          </div>
        )}
      </div>
    )
  })
}

function NewCollectionModal({ open, parentId, onClose }) {
  const crm = useCrm()
  const [f, setF] = useState({ name: '', icon: '📚', color: '#818cf8' })
  useEffect(() => { if (open) setF({ name: '', icon: '📚', color: '#818cf8' }) }, [open])
  return (
    <Modal open={open} onClose={onClose} title={parentId ? `New sub-collection in ${crm.kbCollectionById[parentId]?.name || ''}` : 'New collection'}>
      <div className="flex flex-col gap-4">
        <Field label="Name *">
          <input className="input" value={f.name} data-testid="col-name" placeholder="e.g. Research"
            onChange={e => setF(x => ({ ...x, name: e.target.value }))} />
        </Field>
        <Field label="Icon">
          <div className="flex flex-wrap gap-1.5">
            {ICONS.map(i => (
              <button key={i} className={`chip chip-btn ${f.icon === i ? 'on' : ''}`} onClick={() => setF(x => ({ ...x, icon: i }))}>{i}</button>
            ))}
          </div>
        </Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map(c => (
              <button key={c} className="w-6 h-6 rounded-full border-2" title={c}
                style={{ background: c, borderColor: f.color === c ? '#fff' : 'transparent' }}
                onClick={() => setF(x => ({ ...x, color: c }))} />
            ))}
          </div>
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" data-testid="col-create" disabled={!f.name.trim()}
          onClick={() => { crm.addKbCollection({ ...f, name: f.name.trim(), parentId: parentId || null }); onClose() }}>
          <FolderPlus size={14} /> Create
        </button>
      </div>
    </Modal>
  )
}
