/**
 * WS-6 probe — Knowledge Base (personal wiki)
 *
 * Covers: the wiki engine ([[links]], backlinks, TOC, contact mentions),
 * nested collections, template creation, the article editor's meta rail,
 * contact-drawer Knowledge strip, ⌘K search integration, and .md export.
 */
import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { CrmProvider } from './src/store'
import App from './src/App'
import {
  parseWikiLinks, findArticleByTitle, backlinksFor, outLinksFor, extractToc,
  anchorHeadings, articlesForContact, linkifyHtml, toMarkdownFile, KB_TEMPLATES,
  normalizeArticle, headingId, childrenOf, descendantIds,
} from './src/lib/wiki'

afterEach(() => cleanup())

async function mountApp(hash = '#/') {
  window.localStorage.clear()
  window.location.hash = hash
  return render(
    <HashRouter>
      <CrmProvider>
        <App />
      </CrmProvider>
    </HashRouter>
  )
}
async function skipLock() {
  const skip = screen.queryByRole('button', { name: /skip for now/i })
  if (skip) fireEvent.click(skip)
}

const A1 = normalizeArticle({ id: 'x1', title: 'Alpha', body: 'links to [[Beta]] and [[beta]] again' })
const A2 = normalizeArticle({ id: 'x2', title: 'Beta', body: 'back to [[Alpha]] and [[Missing Page]]' })
const A3 = normalizeArticle({ id: 'x3', title: 'Gamma', body: 'mentions [[Beta]] only' })
const ALL = [A1, A2, A3]

describe('wiki engine (pure)', () => {
  it('parseWikiLinks extracts unique targets; findArticleByTitle is case-insensitive', () => {
    expect(parseWikiLinks('a [[One]] b [[Two]] c [[One]] [[  Spaced  ]]')).toEqual(['One', 'Two', 'Spaced'])
    expect(parseWikiLinks('no links here')).toEqual([])
    expect(findArticleByTitle(ALL, 'beta')?.id).toBe('x2')
    expect(findArticleByTitle(ALL, 'BETA ')?.id).toBe('x2')
    expect(findArticleByTitle(ALL, 'nope')).toBeNull()
  })

  it('backlinks and see-also are reciprocal and exclude self + unresolved', () => {
    expect(backlinksFor(A2, ALL).map(a => a.id).sort()).toEqual(['x1', 'x3'])
    expect(backlinksFor(A1, ALL).map(a => a.id)).toEqual(['x2'])
    expect(outLinksFor(A2, ALL).map(a => a.id)).toEqual(['x1']) // Missing Page drops
    expect(outLinksFor(A1, ALL).map(a => a.id)).toEqual(['x2']) // dupes collapse
  })

  it('TOC extracts headings and anchorHeadings stamps matching ids', () => {
    const body = '# Title\n\ntext\n\n## Section A\n\n### Deep\n\n## Section B\n'
    const toc = extractToc(body)
    expect(toc.map(t => [t.level, t.text])).toEqual([[1, 'Title'], [2, 'Section A'], [3, 'Deep'], [2, 'Section B']])
    const html = anchorHeadings('<h1>Title</h1><h2>Section A</h2><h3>Deep</h3><h2>Section B</h2>', toc)
    expect(html).toContain(`id="${toc[0].id}"`)
    expect(html).toContain(`id="${toc[2].id}"`)
    expect(headingId('Section A!')).toBe('section-a')
  })

  it('articlesForContact matches contactIds, [[Name]] and plain mentions; linkifyHtml resolves + escapes', () => {
    const c = { id: 'c9', name: 'Beta' }
    const arts = [
      normalizeArticle({ id: 'y1', title: 'Y1', body: '[[Beta]] rules', contactIds: [] }),
      normalizeArticle({ id: 'y2', title: 'Y2', body: 'nothing', contactIds: ['c9'] }),
      normalizeArticle({ id: 'y3', title: 'Y3', body: 'just says beta in prose' }),
      normalizeArticle({ id: 'y4', title: 'Y4', body: 'unrelated' }),
    ]
    expect(articlesForContact(arts, c).map(a => a.id).sort()).toEqual(['y1', 'y2', 'y3'])
    const linked = linkifyHtml('go [[Beta]] now', ALL)
    expect(linked).toContain('href="#/kb/x2"')
    expect(linked).toContain('wiki-link')
    const missing = linkifyHtml('go [[Nowhere]] now', ALL)
    expect(missing).toContain('wiki-link missing')
    expect(missing).toContain('Nowhere?')
    // hostile titles can't inject markup
    const evil = linkifyHtml('x [[<img src=x onerror=alert(1)>]] y', [])
    expect(evil).not.toContain('<img')
  })

  it('templates carry wiki syntax and export builds a markdown file', () => {
    expect(KB_TEMPLATES.length).toBe(5)
    expect(KB_TEMPLATES.map(t => t.id)).toEqual(['meeting', 'person', 'project', 'book', 'decision'])
    const md = toMarkdownFile(ALL[0], '📁 Work')
    expect(md).toContain('# Alpha')
    expect(md).toContain('📁 Work')
    expect(md).toContain('[[Beta]]')
    expect(childrenOf([{ id: 'a', parentId: null, order: 0, name: 'A' }, { id: 'b', parentId: 'a', order: 0, name: 'B' }], 'a').map(c => c.id)).toEqual(['b'])
    expect(descendantIds([{ id: 'a', parentId: null, order: 0, name: 'A' }, { id: 'b', parentId: 'a', order: 0, name: 'B' }, { id: 'c', parentId: 'b', order: 0, name: 'C' }], 'a')).toEqual(['b', 'c'])
  })
})

describe('KB home + collections', () => {
  it('renders seeded collections tree and sample articles', async () => {
    await mountApp('#/kb')
    await skipLock()
    await screen.findByTestId('kb-home')
    // seeded articles visible inside their cards (unique scope per card)
    expect(within(screen.getByTestId('kb-card-ka1')).getByText('Personal CRM Handbook')).toBeTruthy()
    expect(within(screen.getByTestId('kb-card-ka2')).getByText('Project Atlas')).toBeTruthy()
    expect(within(screen.getByTestId('kb-card-ka3')).getByText('Deep Work notes')).toBeTruthy()
    // nested collection chip in tree
    expect(screen.getByTestId('kb-col-kc1')).toBeTruthy()
    expect(screen.getByTestId('kb-col-kc4')).toBeTruthy() // child of Projects
    // stat strip
    expect(screen.getByText('Wiki-links')).toBeTruthy()
  })

  it('creates a sub-collection and filters by collection', async () => {
    await mountApp('#/kb')
    await skipLock()
    await screen.findByTestId('kb-home')
    // + on Projects row (kc1's own button — nested kids live inside the same subtree) → sub-collection modal
    fireEvent.click(within(screen.getByTestId('kb-col-kc1')).getAllByTitle('Add sub-collection')[0])
    fireEvent.change(screen.getByTestId('col-name'), { target: { value: 'Launch plan' } })
    fireEvent.click(screen.getByTestId('col-create'))
    await waitFor(() => expect(screen.getByText('Launch plan')).toBeTruthy())
    // clicking the collection chip filters — ka1 lives in kc1
    fireEvent.click(within(screen.getByTestId('kb-col-kc1')).getByRole('button', { name: /Projects/ }))
    await waitFor(() => expect(screen.getByTestId('clear-collection')).toBeTruthy())
    // Project Atlas lives in kc4 (child) → descendant scope keeps it visible
    expect(screen.getByTestId('kb-card-ka2')).toBeTruthy()
    expect(screen.queryByText('Deep Work notes')).toBeNull() // kc2 out of scope
  })

  it('search filters the article list live', async () => {
    await mountApp('#/kb')
    await skipLock()
    await screen.findByTestId('kb-home')
    // "Newport" appears only in ka3's summary — ka1/ka2 must drop out of the list
    fireEvent.change(screen.getByTestId('kb-search'), { target: { value: 'Newport' } })
    await waitFor(() => expect(screen.queryByTestId('kb-card-ka1')).toBeNull())
    expect(screen.queryByTestId('kb-card-ka2')).toBeNull()
    expect(screen.getByTestId('kb-card-ka3')).toBeTruthy()
  })
})

describe('articles: templates, links, backlinks, meta', () => {
  it('creates from the project template and lands in the editor', async () => {
    await mountApp('#/kb?new=1')
    await skipLock()
    await screen.findByTestId('template-picker')
    fireEvent.click(screen.getByTestId('tpl-project'))
    await screen.findByTestId('kb-article')
    expect(screen.getByTestId('article-body').textContent).toContain('Project brief')
    // persisted
    const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
    expect((saved.kbArticles || []).length).toBe(4) // 3 seeded + 1
  })

  it('[[wiki links]] resolve, and the target lists the source under Mentioned in', async () => {
    await mountApp('#/kb/ka1')
    await skipLock()
    await screen.findByTestId('kb-article')
    // rendered body has a real anchor to ka2
    const link = screen.getByTestId('article-body').querySelector('a[href="#/kb/ka2"]')
    expect(link).toBeTruthy()
    // ka1 links both [[Project Atlas]] and [[Deep Work notes]] → see-also has both
    expect(screen.getByTestId('seealso-ka2')).toBeTruthy()
    fireEvent.click(screen.getByTestId('seealso-ka3'))
    await waitFor(() => expect(screen.getByTestId('kb-article')).toBeTruthy())
    // now on ka3 — its "Mentioned in" is empty (nothing links to it)... ka1 links [[Deep Work notes]]!
    await waitFor(() => expect(screen.getByTestId('backlink-ka1')).toBeTruthy())
  })

  it('contact drawer shows the Knowledge strip for mentioned people', async () => {
    await mountApp('#/contacts?open=c3')
    await skipLock()
    await screen.findByTestId('contact-kb-strip')
    // Tanvir (c3) is linked from Project Atlas
    expect(within(screen.getByTestId('contact-kb-ka2')).getByText('Project Atlas')).toBeTruthy()
  })

  it('editor meta rail: favorite, move collection, add tag, link contact', async () => {
    await mountApp('#/kb/ka3')
    await skipLock()
    await screen.findByTestId('kb-article')
    // favorite star (title toggles)
    fireEvent.click(screen.getByTitle('Favorite'))
    await waitFor(() => expect(screen.getByTitle('Unfavorite')).toBeTruthy())
    // move into kc1
    fireEvent.change(screen.getByTestId('article-collection-select'), { target: { value: 'kc1' } })
    // add a tag
    fireEvent.change(screen.getByTestId('article-tag-input'), { target: { value: 'reviewed' } })
    fireEvent.keyDown(screen.getByTestId('article-tag-input'), { key: 'Enter' })
    await waitFor(() => expect(screen.getByTestId('tag-reviewed')).toBeTruthy())
    // link contact c1
    fireEvent.change(screen.getByTestId('article-contact-select'), { target: { value: 'c1' } })
    const saved = JSON.parse(window.localStorage.getItem('pcrm-v1') || '{}')
    const a3 = (saved.kbArticles || []).find(a => a.id === 'ka3')
    expect(a3?.favorite).toBe(true)
    expect(a3?.collectionId).toBe('kc1')
    expect(a3?.tags).toContain('reviewed')
    expect(a3?.contactIds).toContain('c1')
  })

  it('export .md produces the article markdown', async () => {
    let captured = null
    const realCreate = URL.createObjectURL
    URL.createObjectURL = blob => { captured = blob; return 'blob:test' }
    await mountApp('#/kb/ka2')
    await skipLock()
    await screen.findByTestId('kb-article')
    fireEvent.click(screen.getByTestId('article-export'))
    expect(captured).toBeTruthy()
    const text = await captured.text()
    expect(text).toContain('# Project Atlas')
    expect(text).toContain('[[Personal CRM Handbook]]')
    URL.createObjectURL = realCreate
  })

  it('editing body creates a new backlink that shows up on the target', async () => {
    await mountApp('#/kb/ka3')
    await skipLock()
    await screen.findByTestId('kb-article')
    fireEvent.click(screen.getByTestId('article-edit'))
    const ta = screen.getByTestId('article-body-input')
    fireEvent.change(ta, { target: { value: 'links to [[Personal CRM Handbook]] now' } })
    fireEvent.click(screen.getByTestId('article-save'))
    // navigate within the SAME app instance (a remount would lose the edit)
    window.location.hash = '#/kb/ka1'
    await waitFor(() => expect(screen.getByTestId('backlink-ka3')).toBeTruthy())
  })
})

describe('search integration', () => {
  it('⌘K GlobalSearch indexes articles and navigates to them', async () => {
    await mountApp('#/')
    await skipLock()
    window.dispatchEvent(new Event('crm:search'))
    const input = await screen.findByPlaceholderText(/search contacts, tasks, notes, articles/i)
    fireEvent.change(input, { target: { value: 'Deep Work' } })
    await waitFor(() => expect(screen.getByText('Deep Work notes')).toBeTruthy())
    fireEvent.click(screen.getByText('Deep Work notes'))
    await waitFor(() => expect(screen.getByTestId('kb-article')).toBeTruthy())
    expect(screen.getByTestId('article-body').textContent).toContain('Key ideas')
  })
})
