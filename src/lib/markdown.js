/* Tiny safe Markdown renderer (shared by Notes + Knowledge Base).
 * Placeholders are digit-free tokens so the stash restore can never eat
 * ordinary numbers in the source text. */
const STASH = '\u0000'

export function mdToHtml(src) {
  const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const stash = []
  const keep = html => { stash.push(html); return `${STASH}${stash.length - 1}${STASH}` }
  let t = esc(src)
  /* fenced code + inline code first (their contents stay literal) */
  t = t.replace(/```([\s\S]*?)```/g, (_, c) => keep(`<pre>${c.replace(/^\n+|\n+$/g, '')}</pre>`))
  t = t.replace(/`([^`\n]+)`/g, (_, c) => keep(`<code>${c}</code>`))
  /* headings */
  t = t.replace(/^### (.*)$/gm, '<h3>$1</h3>')
       .replace(/^## (.*)$/gm, '<h2>$1</h2>')
       .replace(/^# (.*)$/gm, '<h1>$1</h1>')
  /* inline emphasis + links */
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
  /* blockquote */
  t = t.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>')
  /* task list items (- [ ] / - [x]) then plain lists */
  t = t.replace(/(^|\n)((?:- \[[ x]\] .+(?:\n|$))+)/g, (_, p, list) =>
    `${p}<ul class="md-tasks">${list.trimEnd().split('\n').map(li => {
      const done = /^- \[[xX]\]/.test(li)
      return `<li class="md-task${done ? ' done' : ''}">${li.replace(/^- \[[ xX]\] /, '')}</li>`
    }).join('')}</ul>`)
  t = t.replace(/(^|\n)(- .+(?:\n- .+)*)/g, (_, p, list) =>
    `${p}<ul>${list.split('\n').map(li => `<li>${li.slice(2)}</li>`).join('')}</ul>`)
  t = t.replace(/(^|\n)(\d+\. .+(?:\n\d+\. .+)*)/g, (_, p, list) =>
    `${p}<ol>${list.split('\n').map(li => `<li>${li.replace(/^\d+\. /, '')}</li>`).join('')}</ol>`)
  /* paragraphs */
  t = t.split(/\n{2,}/).map(block => {
    const b = block.trim()
    if (!b) return ''
    if (/^<(h[123]|ul|ol|pre|blockquote)/.test(b) || new RegExp(`^(${STASH}\\d+${STASH})+$`).test(b)) return block
    return `<p>${block.replace(/\n/g, '<br>')}</p>`
  }).join('')
  /* restore stashed html */
  return t.replace(new RegExp(`${STASH}(\\d+)${STASH}`, 'g'), (_, i) => stash[+i] ?? '')
}

/* Plain-text version (previews, search snippets) */
export function mdToText(src) {
  return (src || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6} /gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^&gt; /gm, '')
    .replace(/^- \[[ xX]\] /gm, '')
    .replace(/^[-*\d.]+ /gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}
