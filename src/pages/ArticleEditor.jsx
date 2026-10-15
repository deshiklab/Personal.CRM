import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Star, Pencil, Check, Trash2, Download, Share2, X, Plus,
  BookOpen, Link2, Users, Hash, ListTree,
} from 'lucide-react'
import { useCrm } from '../store'
import { Card, Pill, Empty, Field, TagPill, Avatar } from '../components/ui'
import {
  mdToHtml,
} from '../lib/markdown'
import {
  parseWikiLinks, findArticleByTitle, backlinksFor, outLinksFor, linkifyHtml,
  extractToc, anchorHeadings, toMarkdownFile,
} from '../lib/wiki'
import { tsRel } from '../lib'
import { copyText } from '../lib/share'

/* Article page: rendered markdown with [[wiki-links]], TOC, backlinks,
 * front-matter strip (collection / tags / contacts), inline edit mode. */
export default function ArticleEditor() {
  const crm = useCrm()
  const { id } = useParams()
  const navigate = useNavigate()
  const bodyRef = useRef(null)
  const [edit, setEdit] = useState(false)
  const [draft, setDraft] = useState(null)
  const [tagDraft, setTagDraft] = useState('')

  const article = crm.kbArticleById[id]
  const articles = crm.kbArticles

  useEffect(() => { if (id) crm.touchKbView(id) }, [id]) // eslint-disable-next-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (article) setDraft({ title: article.title, body: article.body, summary: article.summary })
  }, [article?.id]) // eslint-disable-next-line react-hooks/exhaustive-deps

  const backlinks = useMemo(() => (article ? backlinksFor(article, articles) : []), [article, articles])
  const seeAlso = useMemo(() => (article ? outLinksFor(article, articles) : []), [article, articles])
  const toc = useMemo(() => extractToc(article?.body || ''), [article])
  const linkedContacts = (article?.contactIds || []).map(cid => crm.contactById[cid]).filter(Boolean)

  if (!article) {
    return (
      <div className="max-w-[860px] mx-auto">
        <Empty icon={BookOpen} title="Article not found">It may have been deleted. <button className="underline" onClick={() => navigate('/kb')}>Back to the Knowledge Base</button></Empty>
      </div>
    )
  }

  const html = anchorHeadings(linkifyHtml(mdToHtml(article.body || ''), articles), toc)

  const save = () => {
    crm.updateKbArticle(article.id, { title: draft.title.trim() || article.title, body: draft.body, summary: draft.summary })
    setEdit(false)
  }
  const exportMd = () => {
    const col = crm.kbCollectionById[article.collectionId]
    const text = toMarkdownFile(article, col ? `${col.icon} ${col.name}` : '')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }))
    a.download = `${article.title.replace(/[^\w\s-]/g, '').slice(0, 60) || 'article'}.md`
    document.body.appendChild(a); a.click(); a.remove()
    crm.toast('📄 Article exported as .md')
  }

  return (
    <div className="max-w-[1100px] mx-auto" data-testid="kb-article">
      {/* header */}
      <div className="flex items-start gap-3 mb-4">
        <button className="icon-btn flex-none" title="Back to Knowledge Base" onClick={() => navigate('/kb')}><ArrowLeft size={15} /></button>
        <div className="min-w-0 flex-1">
          {edit ? (
            <input className="input text-[19px] font-bold" data-testid="article-title-input" value={draft.title}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
          ) : (
            <h1 className="text-[21px] font-bold tracking-tight leading-tight">{article.title}</h1>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px]" style={{ color: 'var(--faint)' }}>
            {article.collectionId && (
              <button className="chip chip-btn" onClick={() => navigate(`/kb?collection=${article.collectionId}`)}>
                {crm.kbCollectionById[article.collectionId]?.icon} {crm.kbCollectionById[article.collectionId]?.name || 'collection'}
              </button>
            )}
            <span>updated {tsRel(article.updatedAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-none">
          <button className="icon-btn" title={article.favorite ? 'Unfavorite' : 'Favorite'}
            onClick={() => crm.updateKbArticle(article.id, { favorite: !article.favorite })}>
            <Star size={14} style={{ color: article.favorite ? '#fbbf24' : 'var(--muted)' }} fill={article.favorite ? '#fbbf24' : 'none'} />
          </button>
          <button className="icon-btn" title="Export .md" data-testid="article-export" onClick={exportMd}><Download size={14} /></button>
          <button className="icon-btn" title="Share" onClick={async () => {
            const ok = await copyText(`${article.title}\n\n${article.body}`)
            crm.toast(ok ? '📋 Article copied to clipboard' : 'Copy failed', ok ? 'ok' : 'warn')
          }}><Share2 size={14} /></button>
          {edit ? (
            <button className="btn btn-primary btn-sm" data-testid="article-save" onClick={save}><Check size={13} /> Save</button>
          ) : (
            <button className="btn btn-ghost btn-sm" data-testid="article-edit" onClick={() => setEdit(true)}><Pencil size={13} /> Edit</button>
          )}
          <button className="icon-btn" title="Delete article"
            onClick={() => {
              if (confirm(`Delete "${article.title}"?`)) { crm.deleteKbArticle(article.id); navigate('/kb'); crm.toast('Article deleted') }
            }}>
            <Trash2 size={14} style={{ color: '#fb7185' }} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4 items-start">
        {/* body */}
        <div>
          {edit ? (
            <div className="flex flex-col gap-4">
              <Field label="Summary (shown on cards)">
                <input className="input" data-testid="article-summary-input" value={draft.summary}
                  onChange={e => setDraft(d => ({ ...d, summary: e.target.value }))} placeholder="One line…" />
              </Field>
              <Field label="Body — markdown, [[Wiki links]] resolve to other articles">
                <textarea className="input font-mono text-[12.5px] leading-relaxed" rows={18} data-testid="article-body-input"
                  ref={bodyRef} value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} />
              </Field>
            </div>
          ) : (
            <Card className="p-6">
              {article.summary && <p className="text-[13px] italic mb-4 pb-4 border-b" style={{ color: 'var(--muted)', borderColor: 'var(--border)' }}>{article.summary}</p>}
              <div className="kb-body text-[14px] leading-[1.75]" data-testid="article-body"
                dangerouslySetInnerHTML={{ __html: html }} />
            </Card>
          )}

          {/* backlinks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <Card className="p-4" data-testid="mentioned-in">
              <div className="flex items-center gap-2 mb-2">
                <Link2 size={13} style={{ color: '#34d399' }} />
                <h3 className="font-bold text-[12px] uppercase tracking-[.08em]">Mentioned in</h3>
                <span className="text-[11px]" style={{ color: 'var(--faint)' }}>{backlinks.length}</span>
              </div>
              {backlinks.length === 0 && <div className="text-[12px]" style={{ color: 'var(--faint)' }}>No backlinks yet — link here with <code>[[{article.title}]]</code>.</div>}
              {backlinks.map(b => (
                <button key={b.id} className="flex items-center gap-2 w-full text-left rounded-lg px-2 py-1.5 hover:bg-white/[.05] text-[12.5px] font-semibold"
                  data-testid={`backlink-${b.id}`} onClick={() => navigate(`/kb/${b.id}`)}>
                  <BookOpen size={11} className="flex-none" style={{ color: '#2dd4bf' }} /> {b.title}
                </button>
              ))}
            </Card>
            <Card className="p-4" data-testid="see-also">
              <div className="flex items-center gap-2 mb-2">
                <ListTree size={13} style={{ color: '#a78bfa' }} />
                <h3 className="font-bold text-[12px] uppercase tracking-[.08em]">See also</h3>
                <span className="text-[11px]" style={{ color: 'var(--faint)' }}>{seeAlso.length}</span>
              </div>
              {seeAlso.length === 0 && <div className="text-[12px]" style={{ color: 'var(--faint)' }}>No outgoing links yet.</div>}
              {seeAlso.map(b => (
                <button key={b.id} className="flex items-center gap-2 w-full text-left rounded-lg px-2 py-1.5 hover:bg-white/[.05] text-[12.5px] font-semibold"
                  data-testid={`seealso-${b.id}`} onClick={() => navigate(`/kb/${b.id}`)}>
                  <BookOpen size={11} className="flex-none" style={{ color: '#a78bfa' }} /> {b.title}
                </button>
              ))}
            </Card>
          </div>
        </div>

        {/* meta rail */}
        <div className="flex flex-col gap-3">
          <Card className="p-4">
            <div className="text-[10px] font-bold uppercase tracking-[.09em] mb-2" style={{ color: 'var(--faint)' }}>Collection</div>
            <select className="input" data-testid="article-collection-select" value={article.collectionId || ''}
              onChange={e => crm.updateKbArticle(article.id, { collectionId: e.target.value || null })}>
              <option value="">— none —</option>
              {crm.kbCollections.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Hash size={11} style={{ color: 'var(--faint)' }} />
              <div className="text-[10px] font-bold uppercase tracking-[.09em]" style={{ color: 'var(--faint)' }}>Tags</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(article.tags || []).map(t => (
                <span key={t} className="chip inline-flex items-center gap-1" data-testid={`tag-${t}`}>
                  {t}
                  <button title="Remove tag" onClick={() => crm.updateKbArticle(article.id, { tags: article.tags.filter(x => x !== t) })}>
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5 mt-2">
              <input className="input flex-1 !py-1 text-[11.5px]" placeholder="add tag…" data-testid="article-tag-input"
                value={tagDraft} onChange={e => setTagDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tagDraft.trim()) {
                    crm.updateKbArticle(article.id, { tags: [...new Set([...(article.tags || []), tagDraft.trim()])] })
                    setTagDraft('')
                  }
                }} />
              <button className="icon-btn" title="Add tag"
                onClick={() => {
                  if (!tagDraft.trim()) return
                  crm.updateKbArticle(article.id, { tags: [...new Set([...(article.tags || []), tagDraft.trim()])] })
                  setTagDraft('')
                }}><Plus size={12} /></button>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users size={11} style={{ color: 'var(--faint)' }} />
              <div className="text-[10px] font-bold uppercase tracking-[.09em]" style={{ color: 'var(--faint)' }}>Linked contacts</div>
            </div>
            {linkedContacts.map(c => (
              <button key={c.id} className="flex items-center gap-2 w-full text-left rounded-lg px-1.5 py-1 hover:bg-white/[.05]"
                onClick={() => navigate(`/contacts?open=${c.id}`)}>
                <Avatar name={c.name} size={22} /> <span className="text-[12px] font-semibold truncate">{c.name}</span>
              </button>
            ))}
            <select className="input mt-2 !py-1 text-[11.5px]" data-testid="article-contact-select" value=""
              onChange={e => {
                const cid = e.target.value
                if (cid && !(article.contactIds || []).includes(cid)) {
                  crm.updateKbArticle(article.id, { contactIds: [...(article.contactIds || []), cid] })
                }
              }}>
              <option value="">+ link a contact…</option>
              {crm.contacts.filter(c => !(article.contactIds || []).includes(c.id)).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {(article.contactIds || []).map(cid => {
              const c = crm.contactById[cid]
              return c ? (
                <div key={cid} className="flex items-center gap-1.5 text-[11px] mt-1 px-1.5" style={{ color: 'var(--faint)' }}>
                  <span className="flex-1 truncate">{c.name}</span>
                  <button title="Unlink" onClick={() => crm.updateKbArticle(article.id, { contactIds: article.contactIds.filter(x => x !== cid) })}>
                    <X size={10} />
                  </button>
                </div>
              ) : null
            })}
          </Card>

          {toc.length > 0 && (
            <Card className="p-4">
              <div className="text-[10px] font-bold uppercase tracking-[.09em] mb-2" style={{ color: 'var(--faint)' }}>On this page</div>
              <div className="flex flex-col gap-1">
                {toc.map((h, i) => (
                  <a key={i} href={`#/kb/${article.id}`} onClick={e => {
                    e.preventDefault()
                    const el = document.getElementById(h.id)
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                    className="text-[11.5px] truncate hover:underline"
                    style={{ paddingLeft: (h.level - 1) * 10, color: 'var(--muted)' }}>
                    {h.text}
                  </a>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
