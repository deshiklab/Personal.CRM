import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Search, BookOpen, Sparkles, ArrowLeft, Star, ThumbsUp, ThumbsDown, Plus, Pencil, Trash2,
  X, ChevronRight, Compass, Keyboard, Clock, CheckCircle2, Circle, FileText, Tag, Users,
  HeartHandshake, StickyNote, Database, ShieldCheck, LifeBuoy, GraduationCap, Eye, Save,
} from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Card, Pill } from '../components/ui'
import Markdown from '../components/Markdown'
import { Term } from '../components/Tooltip'
import {
  ARTICLES, CATEGORIES, CAT_BY_ID, KB_VERSION, searchArticles, relatedTo, readingTime,
} from '../lib/kb'
import { cn } from '../lib'
import { toneVar } from '../components/ui'

const CAT_ICONS = { Sparkles, Users, HeartHandshake, StickyNote, Database, ShieldCheck, LifeBuoy, BookOpen }

/* ═════════════════════════════════════════════════════════════════════════════
 * Knowledge base — browse, search, read and write.
 * URL shape:  /knowledge            home
 *             /knowledge?a=<id>     open an article
 *             /knowledge?cat=<id>   filter to a category
 *             /knowledge?q=<text>   search
 *             /knowledge?new=1      write a new article
 *             /knowledge?edit=<id>  edit one of yours
 * ═════════════════════════════════════════════════════════════════════════════ */

export default function KnowledgeBase() {
  const crm = useCrm()
  const {
    kbArticles, upsertKbArticle, deleteKbArticle,
    helpPrefs, patchHelpPrefs, toggleBookmark, voteArticle,
    contacts, tasks, notes, driveState, toast,
  } = crm

  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') || '')
  const [cat, setCat] = useState(params.get('cat') || 'all')
  const [active, setActive] = useState(0)
  const searchRef = useRef(null)

  const openId = params.get('a')
  const editId = params.get('edit')
  const isNew = params.get('new') === '1'

  /* everything the user can read: shipped articles + their own */
  const all = useMemo(() => {
    const mine = (kbArticles || []).map(a => ({ ...a, cat: a.cat || 'mine' }))
    return [...ARTICLES, ...mine]
  }, [kbArticles])

  const setParam = (patch, base = {}) => {
    const next = { ...Object.fromEntries(params.entries()), ...base, ...patch }
    Object.keys(next).forEach(k => next[k] === undefined && delete next[k])
    setParams(next)
  }
  /* keep q/cat in the url when moving around, so back returns to your search */
  const goHome = () => {
    const next = { ...Object.fromEntries(params.entries()) }
    delete next.a; delete next.edit; delete next.new
    setParams(next)
  }
  const openArticle = id => setParams({ ...Object.fromEntries(params.entries()), a: id })

  /* the url is the source of truth when it changes underneath us
     (deep link, back button, palette) — typing never touches it */
  const urlQ = params.get('q') || ''
  const urlCat = params.get('cat') || 'all'
  useEffect(() => { setQuery(urlQ) }, [urlQ])
  useEffect(() => { setCat(urlCat) }, [urlCat])

  const results = useMemo(() => {
    if (!query.trim() && cat === 'all') return []
    return searchArticles(all, query, { cat, limit: 60 })
  }, [all, query, cat])

  const article = openId ? all.find(a => a.id === openId) : null
  const editing = isNew || !!editId
  const editTarget = editId ? (kbArticles || []).find(a => a.id === editId) : null

  /* ── keyboard: / to search, arrows + enter to move, esc to go back, b to star ── */
  useEffect(() => {
    const onKey = e => {
      const typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable
      if (e.key === 'Escape') {
        if (typing) { e.target.blur(); return }
        if (openId) goHome()
        else if (query) { setQuery(''); setParams({}) }
        return
      }
      if (typing) return
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); return }
      if (!openId && results.length) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(results.length - 1, a + 1)) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
        else if (e.key === 'Enter') { e.preventDefault(); openArticle(results[active]?.a.id) }
      }
      if (openId && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); toggleBookmark(openId) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId, results, active, query, params])

  useEffect(() => { setActive(0) }, [query, cat])

  /* remember which release notes the user has seen */
  const seenVersion = helpPrefs?.seenVersion
  const hasNews = seenVersion !== KB_VERSION

  /* ── quick-start checklist, computed from real data ── */
  const checklist = useMemo(() => {
    const touched = contacts.filter(c => c.lastContact).length
    return [
      { label: 'Add five contacts', done: contacts.length >= 5, to: '/contacts?new=1', why: 'Enough people for follow-ups to mean something.' },
      { label: 'Mark someone as contacted', done: touched >= 1, to: '/follow-ups', why: 'Starts the clock on their rhythm.' },
      { label: 'Create your first task', done: tasks.length >= 1, to: '/tasks?new=1', why: 'Something you promised someone.' },
      { label: 'Write a note', done: notes.length >= 1, to: '/notes?new=1', why: 'Details decay fast — write them down.' },
      { label: 'Take a backup', done: !!driveState?.lastBackup, to: '/settings', why: 'You are the backup on a local app.' },
      { label: 'Take the guided tour', done: !!helpPrefs?.tourDone, why: 'Sixty seconds, then you know the layout.' },
    ]
  }, [contacts, tasks, notes, driveState, helpPrefs])
  const doneCount = checklist.filter(c => c.done).length

  /* ── editing state ── */
  const [draft, setDraft] = useState(null)
  const [preview, setPreview] = useState(false)
  useEffect(() => {
    if (!editing) { setDraft(null); return }
    setDraft(editTarget
      ? { ...editTarget }
      : { id: '', title: '', cat: 'mine', summary: '', tags: [], body: '## Why this matters\n\n' })
    setPreview(false)
  }, [editing, editId])

  const saveDraft = () => {
    if (!draft?.title?.trim()) { toast?.('Give the article a title first', 'warn'); return }
    const id = upsertKbArticle({
      ...draft,
      id: draft.id || `mine-${Date.now().toString(36)}`,
      tags: Array.isArray(draft.tags) ? draft.tags : String(draft.tags || '').split(',').map(s => s.trim()).filter(Boolean),
      mine: true,
    })
    toast?.('Article saved to your knowledge base')
    setParams({ a: id })
  }

  const removeDraft = () => {
    if (!editId) return
    deleteKbArticle(editId)
    toast?.('Article deleted', 'warn')
    goHome()
  }

  /* ══ render ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="max-w-[1180px] mx-auto">
      <SectionHead
        kicker="Help & guidance"
        title="Knowledge base"
        sub={`${ARTICLES.length} articles · works completely offline · press ? for shortcuts`}
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn btn-ghost btn-sm" onClick={() => patchHelpPrefs(p => ({ tips: !p.tips }))}
              title="Turn hover explanations on or off">
              {helpPrefs?.tips ? 'Tooltips on' : 'Tooltips off'}
            </button>
            <button className="btn btn-ghost btn-sm" data-tip="kb.tour"
              onClick={() => window.dispatchEvent(new CustomEvent('crm:tour'))}>
              <Compass size={13} /> Guided tour
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setParams({ new: '1' })} data-tip="kb.yours">
              <Plus size={13} /> Write an article
            </button>
          </div>
        }
      />

      {/* ── search ── */}
      {!editing && (
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
          <input
            ref={searchRef}
            className="input"
            style={{ paddingLeft: 40, paddingRight: query ? 40 : 14, fontSize: 14 }}
            placeholder="Search the manual — try “pincode”, “import”, “sync conflict”…"
            value={query}
            data-tip="kb.search"
            onChange={e => { setQuery(e.target.value); setCat(c => c) }}
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 icon-btn"
              style={{ width: 26, height: 26 }} title="Clear"><X size={13} /></button>
          )}
        </div>
      )}

      {/* ── editor ── */}
      {editing && draft && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="font-extrabold text-[15px]">
              {editId ? 'Edit your article' : 'Write an article'}
            </div>
            <div className="flex items-center gap-2">
              <button className={cn('btn btn-ghost btn-sm', preview && 'btn-primary')} onClick={() => setPreview(p => !p)}>
                <Eye size={13} /> {preview ? 'Editing' : 'Preview'}
              </button>
              {editId && <button className="btn btn-danger btn-sm" onClick={removeDraft}><Trash2 size={13} /> Delete</button>}
            </div>
          </div>

          {preview ? (
            <div className="panel p-5" style={{ minHeight: 260 }}>
              <h1 className="text-[20px] font-extrabold mb-1">{draft.title || 'Untitled'}</h1>
              {draft.summary && <p className="text-[13px] mb-3" style={{ color: 'var(--muted)' }}>{draft.summary}</p>}
              <Markdown source={draft.body} />
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid sm:grid-cols-[2fr_1fr] gap-3">
                <label className="block">
                  <span className="label">Title</span>
                  <input className="input" value={draft.title}
                    onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="My meeting playbook" />
                </label>
                <label className="block">
                  <span className="label">Category</span>
                  <select className="input" value={draft.cat}
                    onChange={e => setDraft(d => ({ ...d, cat: e.target.value }))}>
                    <option value="mine">My articles</option>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="label">One-line summary</span>
                <input className="input" value={draft.summary || ''}
                  onChange={e => setDraft(d => ({ ...d, summary: e.target.value }))}
                  placeholder="What someone will get out of this" />
              </label>
              <label className="block">
                <span className="label">Tags (comma separated)</span>
                <input className="input" value={Array.isArray(draft.tags) ? draft.tags.join(', ') : draft.tags || ''}
                  onChange={e => setDraft(d => ({ ...d, tags: e.target.value }))} placeholder="playbook, meetings" />
              </label>
              <label className="block">
                <span className="label">{"Body — markdown · ## heading, - bullet, **bold**, `code`, > [!TIP]"}</span>
                <textarea className="input" rows={16} style={{ fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 12.5 }}
                  value={draft.body || ''} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} />
              </label>
              <div className="text-[11.5px]" style={{ color: 'var(--faint)' }}>
                Your articles are stored with your data, so they travel in every backup and restore.
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-4">
            <button className="btn btn-primary" onClick={saveDraft}><Save size={14} /> Save article</button>
            <button className="btn btn-ghost" onClick={goHome}>Cancel</button>
          </div>
        </Card>
      )}

      {/* ── article view ── */}
      {!editing && article && (
        <ArticleView
          article={article}
          all={all}
          onBack={goHome}
          onOpen={openArticle}
          onBookmark={() => toggleBookmark(article.id)}
          bookmarked={(helpPrefs?.bookmarks || []).includes(article.id)}
          vote={helpPrefs?.votes?.[article.id]}
          onVote={v => voteArticle(article.id, v)}
          onEdit={() => setParams({ edit: article.id })}
        />
      )}

      {/* ── home / results ── */}
      {!editing && !article && (
        <div className="grid lg:grid-cols-[232px_1fr] gap-5">
          {/* category rail */}
          <div className="lg:order-1 order-2">
            <div className="flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0 -mx-1 px-1">
              <CatButton active={cat === 'all'} onClick={() => { setCat('all'); setParam({}, { cat: undefined }) }}
                icon={BookOpen} label="All articles" count={all.length} />
              {CATEGORIES.map(c => {
                const count = all.filter(a => a.cat === c.id).length
                if (!count) return null
                return (
                  <CatButton key={c.id} active={cat === c.id} onClick={() => { setCat(c.id); setParam({ cat: c.id }) }}
                    icon={CAT_ICONS[c.icon] || BookOpen} label={c.label} count={count} color={c.color} />
                )
              })}
              {(kbArticles || []).length > 0 && (
                <CatButton active={cat === 'mine'} onClick={() => { setCat('mine'); setParam({ cat: 'mine' }) }}
                  icon={Pencil} label="My articles" count={kbArticles.length} color="#34d399" />
              )}
            </div>

            {(helpPrefs?.bookmarks || []).length > 0 && (
              <div className="hidden lg:block mt-5">
                <div className="label">Bookmarked</div>
                <div className="flex flex-col gap-1 mt-1">
                  {(helpPrefs.bookmarks || []).map(id => {
                    const a = all.find(x => x.id === id)
                    if (!a) return null
                    return (
                      <button key={id} onClick={() => openArticle(id)}
                        className="text-left text-[12.5px] px-2 py-1.5 rounded-lg hoverable truncate"
                        style={{ color: 'var(--muted)', background: 'transparent', border: 0, cursor: 'pointer' }}>
                        <Star size={11} className="inline mr-1.5" style={{ color: 'var(--t-amber)' }} />{a.title}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* main column */}
          <div className="lg:order-2 order-1 min-w-0">
            {query.trim() || cat !== 'all'
              ? <ResultsList results={results} active={active} onOpen={openArticle} query={query} cat={cat} onClear={() => { setQuery(''); setCat('all'); setParams({}) }} />
              : (
                <div className="grid gap-4">
                  {/* start here */}
                  <div>
                    <div className="label">Start here</div>
                    <div className="grid sm:grid-cols-3 gap-3 mt-1.5">
                      {[
                        { id: 'start.first-5-minutes', icon: Sparkles, title: 'First five minutes', sub: 'Register, pincode, import, rhythm', color: 'var(--t-indigo)' },
                        { id: 'start.tour', icon: Compass, title: 'Guided tour', sub: 'A spotlight walkthrough', color: 'var(--t-sky)' },
                        { id: 'ref.shortcuts', icon: Keyboard, title: 'Keyboard shortcuts', sub: 'Move without the mouse', color: 'var(--t-green)' },
                      ].map(s => {
                        const Icon = s.icon
                        return (
                          <button key={s.id} onClick={() => openArticle(s.id)}
                            className="card p-4 text-left hoverable" style={{ cursor: 'pointer' }}>
                            <div className="w-9 h-9 rounded-xl grid place-items-center mb-2.5"
                              style={{ background: s.color + '1f', color: s.color }}>
                              <Icon size={16} />
                            </div>
                            <div className="font-bold text-[13.5px]">{s.title}</div>
                            <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--muted)' }}>{s.sub}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* checklist */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                      <div className="font-bold text-[14px]">Getting set up</div>
                      <Pill color={doneCount === checklist.length ? '#34d399' : '#818cf8'}>
                        {doneCount} of {checklist.length} done
                      </Pill>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'var(--hover)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${(doneCount / checklist.length) * 100}%`, background: 'linear-gradient(90deg,#818cf8,#34d399)' }} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-1.5">
                      {checklist.map(item => (
                        <button key={item.label} onClick={() => navigate(item.to)}
                          className="flex items-start gap-2 text-left px-2 py-1.5 rounded-lg hoverable"
                          style={{ background: 'transparent', border: 0, cursor: 'pointer' }}>
                          {item.done
                            ? <CheckCircle2 size={15} className="flex-none mt-0.5" style={{ color: 'var(--t-green)' }} />
                            : <Circle size={15} className="flex-none mt-0.5" style={{ color: 'var(--faint)' }} />}
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold" style={{ textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'var(--faint)' : 'var(--text)' }}>
                              {item.label}
                            </span>
                            <span className="block text-[11px]" style={{ color: 'var(--faint)' }}>{item.why}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </Card>

                  {/* what's new */}
                  <button onClick={() => { openArticle('ref.changelog'); patchHelpPrefs({ seenVersion: KB_VERSION }) }}
                    className="card p-4 text-left hoverable flex items-center gap-3" style={{ cursor: 'pointer' }}>
                    <div className="w-9 h-9 rounded-xl grid place-items-center flex-none"
                      style={{ background: '#fbbf241f', color: 'var(--t-amber)' }}><Sparkles size={16} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[13.5px] flex items-center gap-2">
                        What&apos;s new in {KB_VERSION}
                        {hasNews && <Pill color="#fbbf24">NEW</Pill>}
                      </div>
                      <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
                        Knowledge base, tooltips, guided tour and the mobile fixes
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--faint)' }} />
                  </button>

                  {/* categories */}
                  <div>
                    <div className="label">Browse by topic</div>
                    <div className="grid sm:grid-cols-2 gap-3 mt-1.5">
                      {CATEGORIES.map(c => {
                        const count = all.filter(a => a.cat === c.id).length
                        if (!count) return null
                        const Icon = CAT_ICONS[c.icon] || BookOpen
                        return (
                          <button key={c.id} onClick={() => { setCat(c.id); setParam({ cat: c.id }) }}
                            className="card p-4 text-left hoverable" style={{ cursor: 'pointer' }}>
                            <div className="flex items-center gap-2.5 mb-1.5">
                              <div className="w-8 h-8 rounded-lg grid place-items-center flex-none"
                                style={{ background: c.color + '1f', color: c.color }}><Icon size={15} /></div>
                              <div className="font-bold text-[13.5px]">{c.label}</div>
                              <span className="ml-auto text-[11px] font-bold" style={{ color: 'var(--faint)' }}>{count}</span>
                            </div>
                            <div className="text-[11.5px] leading-snug" style={{ color: 'var(--muted)' }}>{c.blurb}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* glossary teaser */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="font-bold text-[14px]">Words we use</div>
                      <button className="btn btn-ghost btn-sm" onClick={() => openArticle('ref.glossary')}>
                        Full glossary <ChevronRight size={12} />
                      </button>
                    </div>
                    <div className="text-[13px] mt-2 leading-relaxed" style={{ color: 'var(--muted)' }}>
                      A <Term id="rhythm">rhythm</Term> is how often you want to speak to someone; miss it and you get a{' '}
                      <Term id="follow-up">follow-up</Term>. Mark a <Term id="touch">touch</Term> to reset the clock, or{' '}
                      <Term id="snooze">snooze</Term> when the timing is wrong. Hover any dotted word for its definition.
                    </div>
                  </Card>

                  {/* credit */}
                  <div className="text-[11.5px] text-center py-2" style={{ color: 'var(--faint)' }}>
                    {BRAND_CREDIT}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  )
}

const BRAND_CREDIT = 'BITSCOL · www.bitscol.com · sales@bitscol.com · Mobile +880 1711-853769'

/* ── small pieces ──────────────────────────────────────────────────────────── */
function CatButton({ active, onClick, icon: Icon, label, count, color = '#818cf8' }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-semibold whitespace-nowrap lg:w-full"
      style={{
        background: active ? color + '1f' : 'transparent',
        color: active ? toneVar(color) : 'var(--muted)',
        border: `1px solid ${active ? color + '55' : 'transparent'}`,
        cursor: 'pointer',
      }}>
      <Icon size={14} className="flex-none" />
      <span className="truncate">{label}</span>
      <span className="ml-auto text-[10.5px] font-bold" style={{ color: 'var(--faint)' }}>{count}</span>
    </button>
  )
}

function ResultsList({ results, active, onOpen, query, cat, onClear }) {
  if (!results.length) {
    return (
      <Card className="p-8 text-center">
        <div className="text-[15px] font-bold mb-1">Nothing matched</div>
        <div className="text-[12.5px] mb-4" style={{ color: 'var(--muted)' }}>
          Try a shorter word, or browse a topic instead.
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClear}>Clear search</button>
      </Card>
    )
  }
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[12px]" style={{ color: 'var(--faint)' }}>
          {results.length} result{results.length === 1 ? '' : 's'}
          {query ? <> for “{query}”</> : null}
          {cat !== 'all' ? <> in {CAT_BY_ID[cat]?.label || 'My articles'}</> : null}
        </div>
        <button className="text-[11.5px] font-bold" style={{ color: 'var(--t-sky)', background: 'none', border: 0, cursor: 'pointer' }} onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="grid gap-2">
        {results.map(({ a, why }, i) => (
          <button key={a.id} onClick={() => onOpen(a.id)}
            className="card p-3.5 text-left hoverable"
            style={{
              cursor: 'pointer',
              borderColor: i === active ? 'var(--i1)' : undefined,
              background: i === active ? 'rgba(129,140,248,.07)' : undefined,
            }}>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10.5px] font-extrabold uppercase tracking-wide"
                style={{ color: CAT_BY_ID[a.cat]?.color || '#818cf8' }}>
                {CAT_BY_ID[a.cat]?.label || (a.mine ? 'My articles' : 'Article')}
              </span>
              {a.mine && <Pill color="#34d399">yours</Pill>}
              {(a.tags || []).slice(0, 3).map(t => (
                <span key={t} className="text-[10.5px]" style={{ color: 'var(--faint)' }}>#{t}</span>
              ))}
            </div>
            <div className="font-bold text-[14px]">{a.title}</div>
            <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--muted)' }}>{a.summary}</div>
            {query && why && (
              <div className="text-[11.5px] mt-1.5 line-clamp-2" style={{ color: 'var(--faint)' }}>…{why}…</div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function ArticleView({ article, all, onBack, onOpen, onBookmark, bookmarked, vote, onVote, onEdit }) {
  const cat = CAT_BY_ID[article.cat]
  const { words, minutes } = readingTime(article.body)
  const related = relatedTo(article, all)
  const siblings = all.filter(a => a.cat === article.cat)
  const idx = siblings.findIndex(a => a.id === article.id)
  const prev = siblings[idx - 1], next = siblings[idx + 1]

  return (
    <div className="grid xl:grid-cols-[1fr_190px] gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button className="btn btn-ghost btn-sm" onClick={onBack}><ArrowLeft size={13} /> Knowledge base</button>
          <span className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: cat?.color || '#818cf8' }}>
            {cat?.label || (article.mine ? 'My articles' : 'Article')}
          </span>
          <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--faint)' }}>
            <Clock size={11} /> {minutes} min · {words} words
          </span>
          {article.updated && <span className="text-[11px]" style={{ color: 'var(--faint)' }}>updated {article.updated}</span>}
          <div className="ml-auto flex items-center gap-1.5">
            {article.mine && (
              <button className="btn btn-ghost btn-sm" onClick={onEdit}><Pencil size={12} /> Edit</button>
            )}
            <button className={cn('btn btn-ghost btn-sm', bookmarked && 'btn-primary')} onClick={onBookmark} data-tip="kb.bookmark">
              <Star size={12} /> {bookmarked ? 'Bookmarked' : 'Bookmark'}
            </button>
          </div>
        </div>

        <Card className="p-5 sm:p-7">
          <h1 className="text-[21px] sm:text-[24px] font-extrabold tracking-tight leading-tight">{article.title}</h1>
          {article.summary && (
            <p className="text-[13.5px] mt-2 leading-relaxed" style={{ color: 'var(--muted)' }}>{article.summary}</p>
          )}

          <div className="mt-5">
            <Markdown source={article.body} onArticle={onOpen} />
          </div>

          <div className="mt-7 pt-4 flex items-center gap-3 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-[12px]" style={{ color: 'var(--muted)' }}>Was this helpful?</span>
            <button className={cn('btn btn-ghost btn-sm', vote === 'up' && 'btn-primary')} onClick={() => onVote('up')}>
              <ThumbsUp size={12} /> Yes
            </button>
            <button className={cn('btn btn-ghost btn-sm', vote === 'down' && 'btn-primary')} onClick={() => onVote('down')}>
              <ThumbsDown size={12} /> Not really
            </button>
            {vote && (
              <span className="text-[11.5px]" style={{ color: 'var(--faint)' }}>
                {vote === 'up' ? 'Thanks — glad it helped.' : 'Noted — we will improve this one.'}
              </span>
            )}
          </div>
        </Card>

        {/* prev / next */}
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {prev ? (
            <button onClick={() => onOpen(prev.id)} className="card p-3.5 text-left hoverable" style={{ cursor: 'pointer' }}>
              <div className="text-[10.5px] uppercase font-bold" style={{ color: 'var(--faint)' }}>← Previous</div>
              <div className="text-[13px] font-semibold mt-0.5 truncate">{prev.title}</div>
            </button>
          ) : <span />}
          {next && (
            <button onClick={() => onOpen(next.id)} className="card p-3.5 text-left hoverable sm:text-right" style={{ cursor: 'pointer' }}>
              <div className="text-[10.5px] uppercase font-bold" style={{ color: 'var(--faint)' }}>Next →</div>
              <div className="text-[13px] font-semibold mt-0.5 truncate">{next.title}</div>
            </button>
          )}
        </div>

        {related.length > 0 && (
          <div className="mt-5">
            <div className="label">Related</div>
            <div className="grid sm:grid-cols-2 gap-2 mt-1.5">
              {related.map(r => (
                <button key={r.id} onClick={() => onOpen(r.id)} className="card p-3 text-left hoverable" style={{ cursor: 'pointer' }}>
                  <div className="text-[10.5px] font-extrabold uppercase" style={{ color: toneVar(CAT_BY_ID[r.cat]?.color || '#818cf8') }}>
                    {CAT_BY_ID[r.cat]?.label || 'Article'}
                  </div>
                  <div className="text-[13px] font-semibold mt-0.5">{r.title}</div>
                  <div className="text-[11.5px] mt-0.5 line-clamp-2" style={{ color: 'var(--muted)' }}>{r.summary}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* table of contents */}
      <div className="hidden xl:block">
        <div className="sticky top-4">
          <div className="label">On this page</div>
          <Toc body={article.body} />
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="text-[11px]" style={{ color: 'var(--faint)' }}>{BRAND_CREDIT}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Toc({ body }) {
  const items = useMemo(() => {
    const out = []
    String(body || '').split('\n').forEach(line => {
      const m = /^(#{2,3})\s+(.*)$/.exec(line)
      if (m) out.push({
        level: m[1].length,
        text: m[2].trim(),
        id: m[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      })
    })
    return out
  }, [body])

  if (!items.length) return null
  return (
    <div className="flex flex-col gap-1 mt-1">
      {items.map((it, i) => (
        <a key={i} href={`#${it.id}`} onClick={e => {
          e.preventDefault()
          document.getElementById(it.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
          className="text-[12px] leading-snug truncate hoverable rounded px-1"
          style={{
            color: 'var(--muted)', textDecoration: 'none',
            paddingLeft: it.level === 3 ? 12 : 0,
            fontWeight: it.level === 2 ? 600 : 400,
          }}>
          {it.text}
        </a>
      ))}
    </div>
  )
}
