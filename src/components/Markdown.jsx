import { Fragment } from 'react'
import { Lightbulb, AlertTriangle, Info, Link2 } from 'lucide-react'
import { toneVar } from './ui'

/* ═════════════════════════════════════════════════════════════════════════════
 * Markdown — a small, safe subset rendered straight to React elements.
 * Nothing here touches innerHTML, so content can never inject markup.
 *
 *   ## heading      ### subheading
 *   - bullet        1. step        - [ ] task      - [x] done
 *   > [!TIP] text   > [!WARN] text > [!NOTE] text
 *   ```lang\ncode\n```            --- rule
 *   | col | col |   (with a | --- | separator row)
 *   inline: **bold**  *italic*  `code`  [label](article:slug)  [label](https://…)
 * ═════════════════════════════════════════════════════════════════════════════ */

const slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

/* ── inline ────────────────────────────────────────────────────────────────── */
const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g

function inline(text, onArticle, keyBase) {
  const parts = String(text).split(INLINE).filter(p => p !== '' && p !== undefined)
  return parts.map((p, i) => {
    const k = `${keyBase}-${i}`
    if (p.startsWith('**') && p.endsWith('**'))
      return <strong key={k} style={{ color: 'var(--text)' }}>{inline(p.slice(2, -2), onArticle, k)}</strong>
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2)
      return <em key={k}>{inline(p.slice(1, -1), onArticle, k)}</em>
    if (p.startsWith('`') && p.endsWith('`'))
      return <code key={k} style={{
        background: 'var(--codebg)', borderRadius: 6, padding: '1px 6px',
        fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 12.5,
      }}>{p.slice(1, -1)}</code>
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(p)
    if (link) {
      const [, label, href] = link
      if (href.startsWith('article:')) {
        const id = href.slice(8)
        return (
          <button key={k} type="button" onClick={() => onArticle?.(id)}
            className="inline-flex items-center gap-1 font-semibold"
            style={{ color: 'var(--t-sky)', background: 'none', border: 0, padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, fontSize: 'inherit' }}>
            <Link2 size={11} />{label}
          </button>
        )
      }
      return (
        <a key={k} href={href} target="_blank" rel="noreferrer"
          style={{ color: 'var(--t-sky)', textDecoration: 'underline', textUnderlineOffset: 2 }}>{label}</a>
      )
    }
    return <Fragment key={k}>{p}</Fragment>
  })
}

/* ── callouts ──────────────────────────────────────────────────────────────── */
const CALLOUTS = {
  TIP:  { icon: Lightbulb,      label: 'Tip',    color: 'var(--t-amber)', bg: 'rgba(251,191,36,.10)', border: 'rgba(251,191,36,.32)' },
  WARN: { icon: AlertTriangle,  label: 'Careful', color: 'var(--t-rose)', bg: 'rgba(251,113,133,.10)', border: 'rgba(251,113,133,.32)' },
  NOTE: { icon: Info,           label: 'Note',   color: 'var(--t-sky)', bg: 'rgba(56,189,248,.10)', border: 'rgba(56,189,248,.32)' },
}

function Callout({ kind, children }) {
  const c = CALLOUTS[kind] || CALLOUTS.NOTE
  const Icon = c.icon
  return (
    <div className="flex gap-2.5 rounded-xl p-3.5 my-3.5" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <Icon size={15} className="flex-none mt-0.5" style={{ color: toneVar(c.color) }} />
      <div className="text-[13px] leading-relaxed min-w-0">
        <b style={{ color: toneVar(c.color) }}>{c.label}</b> — {children}
      </div>
    </div>
  )
}

/* ── block parser ──────────────────────────────────────────────────────────── */
function parseBlocks(src) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // fenced code
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim()
      const buf = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) { buf.push(lines[i]); i++ }
      i++
      blocks.push({ type: 'code', lang, text: buf.join('\n') })
      continue
    }

    // rule
    if (/^---+$/.test(line.trim())) { blocks.push({ type: 'hr' }); i++; continue }

    // headings
    const h = /^(#{2,3})\s+(.*)$/.exec(line)
    if (h) { blocks.push({ type: h[1].length === 2 ? 'h2' : 'h3', text: h[2].trim() }); i++; continue }

    // table
    if (line.trim().startsWith('|') && /^\|[\s:|-]+\|$/.test((lines[i + 1] || '').trim())) {
      const head = line.trim().slice(1, -1).split('|').map(s => s.trim())
      i += 2
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].trim().slice(1, -1).split('|').map(s => s.trim())); i++
      }
      blocks.push({ type: 'table', head, rows })
      continue
    }

    // callout
    if (line.trim().startsWith('>')) {
      const buf = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(lines[i].trim().replace(/^>\s?/, '')); i++
      }
      const text = buf.join(' ').trim()
      const m = /^\[!(TIP|WARN|NOTE)\]\s*/.exec(text)
      blocks.push({ type: 'callout', kind: m ? m[1] : 'NOTE', text: m ? text.slice(m[0].length) : text })
      continue
    }

    // ordered list
    if (/^\d+\.\s+/.test(line.trim())) {
      const items = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, '')); i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    // bullet list
    if (/^[-*]\s+/.test(line.trim())) {
      const items = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, '')); i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    // paragraph
    if (line.trim()) {
      const buf = []
      while (i < lines.length && lines[i].trim() &&
             !/^([-*]\s+|\d+\.\s+|>|#{2,3}\s+|```|---+$|\|)/.test(lines[i].trim())) {
        buf.push(lines[i].trim()); i++
      }
      blocks.push({ type: 'p', text: buf.join(' ') })
      continue
    }

    i++
  }
  return blocks
}

/* ── component ─────────────────────────────────────────────────────────────── */
export function ArticleOutline({ body = [] }) {
  const blocks = Array.isArray(body) ? body : parseBlocks(body)
  return blocks.filter(b => b.type === 'h2' || b.type === 'h3')
}

export default function Markdown({ source, onArticle, className = '' }) {
  const blocks = parseBlocks(source)

  return (
    <div className={`md ${className}`}>
      {blocks.map((b, i) => {
        const k = `b${i}`
        switch (b.type) {
          case 'h2':
            return <h2 key={k} id={slug(b.text)} className="!mt-6 scroll-mt-4">{inline(b.text, onArticle, k)}</h2>
          case 'h3':
            return <h3 key={k} id={slug(b.text)} className="!mt-4 scroll-mt-4">{inline(b.text, onArticle, k)}</h3>
          case 'hr':
            return <hr key={k} style={{ border: 0, borderTop: '1px solid var(--border)', margin: '18px 0' }} />
          case 'code':
            return (
              <pre key={k}><code>{b.text}</code></pre>
            )
          case 'callout':
            return <Callout key={k} kind={b.kind}>{inline(b.text, onArticle, k)}</Callout>
          case 'table':
            return (
              <div key={k} className="overflow-x-auto my-3.5">
                <table className="table" style={{ minWidth: 340 }}>
                  <thead>
                    <tr>{b.head.map((c, j) => <th key={j}>{inline(c, onArticle, `${k}h${j}`)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, ri) => (
                      <tr key={ri}>
                        {r.map((c, ci) => (
                          <td key={ci} className="text-[13px]">{inline(c, onArticle, `${k}c${ri}-${ci}`)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'ul':
            return (
              <ul key={k}>
                {b.items.map((it, j) => {
                  const task = /^\[( |x)\]\s*/.exec(it)
                  if (task) {
                    const done = task[1] === 'x'
                    return (
                      <li key={j} style={{ listStyle: 'none', marginLeft: -18 }}>
                        <span className="inline-block w-3.5 text-center mr-1.5"
                          style={{ color: done ? '#34d399' : 'var(--faint)' }}>{done ? '✓' : '□'}</span>
                        {inline(it.slice(task[0].length), onArticle, `${k}i${j}`)}
                      </li>
                    )
                  }
                  return <li key={j}>{inline(it, onArticle, `${k}i${j}`)}</li>
                })}
              </ul>
            )
          case 'ol':
            return <ol key={k}>{b.items.map((it, j) => <li key={j}>{inline(it, onArticle, `${k}i${j}`)}</li>)}</ol>
          case 'p':
          default:
            return <p key={k}>{inline(b.text, onArticle, k)}</p>
        }
      })}
    </div>
  )
}
