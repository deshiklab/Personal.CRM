/* Knowledge Base wiki engine — pure logic shared by the KB pages, the
 * contact drawer, GlobalSearch and tests.
 *
 * An article: { id, title, body, summary, collectionId, tags[], contactIds[],
 *               favorite, createdAt, updatedAt }
 * A collection: { id, name, parentId, icon, color, order }
 *
 * Wiki syntax: [[Article title]] anywhere in a body creates a link. The
 * target resolves case-insensitively by title; every article shows its
 * backlinks ("Mentioned in") and its resolved out-links ("See also"). */

export const WIKI_LINK_RE = /\[\[([^\[\]]+)\]\]/g

/* ── normalization ── */
export function normalizeArticle(a = {}) {
  return {
    id: a.id || `ka-${Math.random().toString(36).slice(2, 9)}`,
    title: (a.title || '').trim() || 'Untitled article',
    body: typeof a.body === 'string' ? a.body : '',
    summary: typeof a.summary === 'string' ? a.summary : '',
    collectionId: a.collectionId || null,
    tags: Array.isArray(a.tags) ? [...new Set(a.tags.filter(Boolean))] : [],
    contactIds: Array.isArray(a.contactIds) ? [...new Set(a.contactIds.filter(Boolean))] : [],
    favorite: !!a.favorite,
    createdAt: a.createdAt || new Date().toISOString(),
    updatedAt: a.updatedAt || new Date().toISOString(),
  }
}

export function normalizeCollection(c = {}) {
  return {
    id: c.id || `kc-${Math.random().toString(36).slice(2, 9)}`,
    name: (c.name || '').trim() || 'Untitled collection',
    parentId: c.parentId || null,
    icon: c.icon || '📚',
    color: c.color || '#818cf8',
    order: Number.isFinite(c.order) ? c.order : 0,
  }
}

/* ── wiki links ── */
/* every [[target]] mentioned in a body (trimmed, de-duped, order kept) */
export function parseWikiLinks(body = '') {
  const out = []
  const seen = new Set()
  for (const m of String(body).matchAll(WIKI_LINK_RE)) {
    const title = (m[1] || '').trim()
    if (!title) continue
    const key = title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(title)
  }
  return out
}

/* case-insensitive title → article */
export function findArticleByTitle(articles, title) {
  const key = String(title || '').trim().toLowerCase()
  if (!key) return null
  return (articles || []).find(a => a.title.trim().toLowerCase() === key) || null
}

/* out-links of one article, resolved to live articles ("See also") */
export function outLinksFor(article, articles) {
  return parseWikiLinks(article?.body || '')
    .map(t => findArticleByTitle(articles, t))
    .filter(a => a && a.id !== article?.id)
}

/* articles whose body links to `article` ("Mentioned in") */
export function backlinksFor(article, articles) {
  if (!article) return []
  const key = article.title.trim().toLowerCase()
  return (articles || []).filter(a =>
    a.id !== article.id &&
    parseWikiLinks(a.body || '').some(t => t.trim().toLowerCase() === key)
  )
}

/* articles related to a contact: explicit contactIds or a [[Name]] / name mention */
export function articlesForContact(articles, contact) {
  if (!contact) return []
  const name = (contact.name || '').toLowerCase()
  return (articles || []).filter(a =>
    (a.contactIds || []).includes(contact.id) ||
    (name && parseWikiLinks(a.body || '').some(t => t.trim().toLowerCase() === name)) ||
    (name && String(a.body || '').toLowerCase().includes(name))
  )
}

/* render body as HTML with [[links]] resolved to anchors (falls back to a
 * plain unresolved span). Call AFTER mdToHtml — brackets pass through it. */
const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export function linkifyHtml(html, articles, onIdAttr = 'data-wiki-id') {
  return String(html || '').replace(WIKI_LINK_RE, (_, raw) => {
    const title = raw.trim()
    const target = findArticleByTitle(articles, title)
    const safe = escAttr(title)
    return target
      ? `<a href="#/kb/${target.id}" ${onIdAttr}="${target.id}" class="wiki-link">${safe}</a>`
      : `<span class="wiki-link missing" title="No article with this title yet">${safe}?</span>`
  })
}

/* give every <h1|2|3> its TOC id so in-page links can scroll to it */
export function anchorHeadings(html, toc = []) {
  const used = toc.map(h => h.id)
  let i = 0
  return String(html || '').replace(/<h([123])>([\s\S]*?)<\/h\1>/g, (m, lvl, inner) => {
    const id = used[i++] || headingId(inner.replace(/<[^>]+>/g, ''))
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`
  })
}

/* ── TOC ── */
export function headingId(text = '') {
  return String(text).toLowerCase().replace(/[^\w\u0980-\u09ff]+/g, '-').replace(/^-+|-+$/g, '') || 'section'
}
export function extractToc(body = '') {
  const out = []
  const seen = new Set()
  for (const line of String(body || '').split('\n')) {
    const m = /^(#{1,3}) (.+)$/.exec(line.trim())
    if (!m) continue
    let id = headingId(m[2])
    while (seen.has(id)) id = id + '-x'
    seen.add(id)
    out.push({ level: m[1].length, text: m[2].trim(), id })
  }
  return out
}

/* ── search ── */
export function articleMatches(a, q) {
  const s = String(q || '').trim().toLowerCase()
  if (!s) return true
  return [a.title, a.summary, a.body, (a.tags || []).join(' ')].join('\n').toLowerCase().includes(s)
}

/* ── templates ── */
export const KB_TEMPLATES = [
  {
    id: 'meeting', name: 'Meeting notes', icon: '🗓️',
    title: 'Meeting notes — ',
    body: `# Meeting notes\n\n**Date:** ${''} · **Attendees:** \n\n## Agenda\n- \n\n## Notes\n- \n\n## Decisions\n- \n\n## Action items\n- [ ] \n`,
  },
  {
    id: 'person', name: 'Person profile', icon: '👤',
    title: 'Profile — ',
    body: `# Profile\n\n## Who\n\n## Context\n- first met:\n- how we know each other:\n\n## Talking points\n- \n\n## Follow-ups\n- [ ] \n`,
  },
  {
    id: 'project', name: 'Project brief', icon: '🎯',
    title: 'Project — ',
    body: `# Project brief\n\n## Goal\n\n## Why now\n\n## Scope\n- in:\n- out:\n\n## Milestones\n- [ ] \n\n## Links\n- see also [[ ]]\n`,
  },
  {
    id: 'book', name: 'Book / article summary', icon: '📖',
    title: 'Summary — ',
    body: `# Summary\n\n**Author:** · **Source:** \n\n## One-liner\n\n## Key ideas\n1. \n\n## Favorite quotes\n> \n\n## Apply\n- [ ] \n`,
  },
  {
    id: 'decision', name: 'Decision log', icon: '⚖️',
    title: 'Decision — ',
    body: `# Decision\n\n**Status:** proposed | accepted | reversed · **Date:** \n\n## Context\n\n## Options\n1. \n\n## Decision\n\n## Consequences\n- \n`,
  },
]
export function templateById(id) {
  return KB_TEMPLATES.find(t => t.id === id) || null
}

/* ── export ── */
export function toMarkdownFile(article, collectionName = '') {
  const meta = [
    `# ${article.title}`,
    collectionName ? `\n> Collection: ${collectionName}` : '',
    (article.tags || []).length ? `\n> Tags: ${article.tags.join(', ')}` : '',
    `\n> Updated: ${String(article.updatedAt || '').slice(0, 10)}`,
  ].filter(Boolean).join('\n')
  return `${meta}\n\n${article.body || ''}\n`
}

/* nested tree helpers */
export function childrenOf(collections, parentId) {
  return (collections || [])
    .filter(c => (c.parentId || null) === (parentId || null))
    .sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name))
}
export function descendantIds(collections, id) {
  const out = []
  const walk = pid => childrenOf(collections, pid).forEach(c => { out.push(c.id); walk(c.id) })
  walk(id)
  return out
}
