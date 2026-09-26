import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Network, Search, ArrowRight, Users, X, Download } from 'lucide-react'
import { ProBadge } from '../components/ProGate'
import { useCrm } from '../store'
import { contactGroupIds } from '../store'
import { SectionHead, Card, Avatar, Pill, Empty } from '../components/ui'
import { initials } from '../lib'

const EDGE_COLORS = { group: '#818cf8', tag: '#22d3ee', introduced: '#f472b6' }
const EDGE_LABELS = { group: 'Same group', tag: 'Shared tags', introduced: 'Introduced by' }
const VB = { w: 960, h: 620 }

function buildGraph(contacts, opts) {
  const nameToId = {}
  contacts.forEach(c => { nameToId[c.name] = c.id })
  const links = []
  const seen = new Set()
  const push = (from, to, type) => {
    const k = from < to ? `${from}|${to}` : `${to}|${from}`
    if (seen.has(k)) return
    seen.add(k)
    links.push({ from, to, type, k })
  }
  if (opts.introduced) contacts.forEach(c => {
    const by = c.introducedBy && nameToId[c.introducedBy]
    if (by && by !== c.id) push(by, c.id, 'introduced')
  })
  if (opts.group) {
    const byG = {}
    contacts.forEach(c => { contactGroupIds(c).forEach(gid => { (byG[gid] = byG[gid] || []).push(c.id) }) })
    Object.values(byG).forEach(m => { for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) push(m[i], m[j], 'group') })
  }
  if (opts.tag) {
    for (let i = 0; i < contacts.length; i++) for (let j = i + 1; j < contacts.length; j++) {
      const [A, B] = [contacts[i], contacts[j]]
      if (A.tags.filter(t => B.tags.includes(t)).length >= 2) push(A.id, B.id, 'tag')
    }
  }
  const deg = {}
  links.forEach(l => { deg[l.from] = (deg[l.from] || 0) + 1; deg[l.to] = (deg[l.to] || 0) + 1 })
  const nodes = contacts.map(c => ({ id: c.id, c, deg: deg[c.id] || 0, r: Math.min(26, 13 + (deg[c.id] || 0) * 0.9) }))
  return { nodes, links, deg }
}

function stepPhysics(nodes, links, pos, dragId) {
  const F = {}
  nodes.forEach(n => { F[n.id] = { x: 0, y: 0 } })
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = pos[nodes[i].id], b = pos[nodes[j].id]
    let dx = b.x - a.x, dy = b.y - a.y
    let d2 = dx * dx + dy * dy; if (d2 < 1) d2 = 1
    const d = Math.sqrt(d2), f = 3400 / d2
    dx /= d; dy /= d
    F[nodes[i].id].x -= dx * f; F[nodes[i].id].y -= dy * f
    F[nodes[j].id].x += dx * f; F[nodes[j].id].y += dy * f
  }
  links.forEach(l => {
    const a = pos[l.from], b = pos[l.to]
    if (!a || !b) return
    let dx = b.x - a.x, dy = b.y - a.y
    const d = Math.max(1, Math.hypot(dx, dy))
    const rest = l.type === 'introduced' ? 130 : l.type === 'group' ? 88 : 112
    const f = (d - rest) * 0.028
    dx /= d; dy /= d
    F[l.from].x += dx * f; F[l.from].y += dy * f
    F[l.to].x -= dx * f; F[l.to].y -= dy * f
  })
  nodes.forEach(n => {
    const p = pos[n.id]
    F[n.id].x += (VB.w / 2 - p.x) * 0.011
    F[n.id].y += (VB.h / 2 - p.y) * 0.011
    if (dragId === n.id) { p.vx = 0; p.vy = 0; return }
    p.vx = (p.vx + F[n.id].x) * 0.82
    p.vy = (p.vy + F[n.id].y) * 0.82
    p.x = Math.min(VB.w - 20, Math.max(20, p.x + p.vx))
    p.y = Math.min(VB.h - 20, Math.max(20, p.y + p.vy))
  })
}

export default function GraphPage() {
  const { contacts, groups, contactById, groupById, can, toast } = useCrm()
  const navigate = useNavigate()
  const [opts, setOpts] = useState({ group: true, tag: true, introduced: true })
  const [gfilter, setGfilter] = useState([])
  const [q, setQ] = useState('')
  const [selId, setSelId] = useState(null)
  const [focus, setFocus] = useState(null) // { ids:Set, linkKeys:Set, label }
  const [mutA, setMutA] = useState(''); const [mutB, setMutB] = useState('')
  const [brA, setBrA] = useState(''); const [brB, setBrB] = useState('')

  const svgRef = useRef(null)
  const posRef = useRef({})
  const dragRef = useRef(null)
  const lastDragRef = useRef(0)
  const alphaRef = useRef(1)
  const graphRef = useRef(null)
  const [, forceRender] = useState(0)
  const kick = a => { alphaRef.current = Math.max(alphaRef.current, a) }

  const visible = useMemo(
    () => contacts.filter(c => gfilter.length === 0 || contactGroupIds(c).some(g => gfilter.includes(g))),
    [contacts, gfilter])
  const graph = useMemo(() => buildGraph(visible, opts), [visible, opts])
  graphRef.current = graph

  /* clear selection if contact left the visible set */
  useEffect(() => { if (selId && !graph.nodes.some(n => n.id === selId)) setSelId(null) }, [graph])

  /* (re)initialize positions for unseen nodes */
  useEffect(() => {
    graph.nodes.forEach((n, i) => {
      if (!posRef.current[n.id]) {
        const ang = (i / Math.max(1, graph.nodes.length)) * Math.PI * 2
        posRef.current[n.id] = { x: VB.w / 2 + 210 * Math.cos(ang), y: VB.h / 2 + 210 * Math.sin(ang), vx: 0, vy: 0 }
      }
    })
    kick(1)
  }, [graph])

  /* animation loop — renders only while hot or dragging */
  useEffect(() => {
    let raf
    const tick = () => {
      const g = graphRef.current
      if (g) {
        alphaRef.current *= 0.992
        if (alphaRef.current > 0.015 || dragRef.current) stepPhysics(g.nodes, g.links, posRef.current, dragRef.current)
        if (alphaRef.current > 0.015 || dragRef.current) forceRender(f => f + 1)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const neighborsOf = useMemo(() => {
    const m = {}
    graph.links.forEach(l => {
      (m[l.from] = m[l.from] || []).push({ id: l.to, type: l.type, k: l.k });
      (m[l.to] = m[l.to] || []).push({ id: l.from, type: l.type, k: l.k })
    })
    return m
  }, [graph])

  /* active focus = explicit result set, else selected node's neighborhood */
  const activeFocus = focus || (selId ? {
    ids: new Set([selId, ...(neighborsOf[selId] || []).map(x => x.id)]),
    linkKeys: new Set((neighborsOf[selId] || []).map(x => x.k)),
  } : null)
  const dim = id => activeFocus && !activeFocus.ids.has(id)
  const dimLink = k => activeFocus && !activeFocus.linkKeys.has(k)

  /* mutual connections */
  const runMutual = () => {
    if (!mutA || !mutB || mutA === mutB) return
    const na = new Set((neighborsOf[mutA] || []).map(x => x.id))
    const nb = new Set((neighborsOf[mutB] || []).map(x => x.id))
    const inter = [...na].filter(id => nb.has(id))
    const linkKeys = new Set(graph.links.filter(l =>
      (l.from === mutA || l.from === mutB || l.to === mutA || l.to === mutB) &&
      (inter.includes(l.from) || inter.includes(l.to) || (l.from === mutA && l.to === mutB) || (l.from === mutB && l.to === mutA))).map(l => l.k))
    setFocus({ ids: new Set([mutA, mutB, ...inter]), linkKeys, label: `${inter.length} mutual connection(s)` })
    kick(0.3)
  }

  /* group bridges */
  const runBridge = () => {
    if (!brA || !brB || brA === brB) return
    const mA = new Set(visible.filter(c => contactGroupIds(c).includes(brA)).map(c => c.id))
    const mB = new Set(visible.filter(c => contactGroupIds(c).includes(brB)).map(c => c.id))
    const bridges = graph.nodes.filter(n => {
      const ns = new Set((neighborsOf[n.id] || []).map(x => x.id))
      return [...mA].some(a => ns.has(a)) && [...mB].some(b => ns.has(b))
    }).map(n => n.id)
    const linkKeys = new Set(graph.links.filter(l => bridges.includes(l.from) || bridges.includes(l.to)).map(l => l.k))
    setFocus({ ids: new Set(bridges), linkKeys, label: `${bridges.length} bridge(s)` })
    kick(0.3)
  }

  const locate = e => {
    const v = e.target.value; setQ(v)
    if (!v.trim()) return
    const hit = graph.nodes.find(n => n.c.name.toLowerCase().includes(v.toLowerCase()))
    if (hit) { setSelId(hit.id); kick(0.25) }
  }

  const pt = e => {
    const r = svgRef.current.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width * VB.w, y: (e.clientY - r.top) / r.height * VB.h }
  }

  const sel = selId && contactById[selId]
  const introducedBy = sel?.introducedBy
  const introReverse = sel ? visible.filter(c => c.introducedBy === sel.name) : []
  const introducedCount = graph.links.filter(l => l.type === 'introduced').length
  const avgDeg = graph.nodes.length ? (graph.nodes.reduce((s, n) => s + n.deg, 0) / graph.nodes.length).toFixed(1) : 0

  
  const exportGraph = (fmt = 'svg') => {
    if (!can?.('graph_export')) {
      toast?.('Graph export is a Pro feature', 'warn')
      return
    }
    const svg = svgRef.current
    if (!svg) return
    const clone = svg.cloneNode(true)
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%')
    bg.setAttribute('fill', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0a0c11')
    clone.insertBefore(bg, clone.firstChild)
    const xml = new XMLSerializer().serializeToString(clone)
    if (fmt === 'svg') {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
      a.download = 'personal-crm-network.svg'
      document.body.appendChild(a); a.click(); a.remove()
      toast?.('Network exported as SVG')
      return
    }
    const img = new Image()
    const svgUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const vb = svg.viewBox.baseVal
      canvas.width = (vb?.width || 900) * 2
      canvas.height = (vb?.height || 600) * 2
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0a0c11'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'personal-crm-network.png'
        document.body.appendChild(a); a.click(); a.remove()
        toast?.('Network exported as PNG')
      }, 'image/png')
      URL.revokeObjectURL(svgUrl)
    }
    img.onerror = () => { URL.revokeObjectURL(svgUrl); toast?.('PNG export failed', 'warn') }
    img.src = svgUrl
  }

return (
    <div className="max-w-[1280px] mx-auto">
      <SectionHead kicker="Beyond the core · 1" title="Relationship Map"
        sub="Who-knows-who: edges from shared groups (indigo), shared tags (cyan) and introductions (pink arrows). Drag nodes to rearrange; click for details." />

      {/* toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
          <input className="input pl-8" style={{ width: 210 }} placeholder="Locate a contact…" value={q} onChange={locate} />
        </div>
        {Object.entries(EDGE_LABELS).map(([k, l]) => (
          <button key={k} className={`chip chip-btn ${opts[k] ? 'on' : ''}`} onClick={() => setOpts(o => ({ ...o, [k]: !o[k] }))}>
            <span className="dot" style={{ background: EDGE_COLORS[k] }} /> {l}
          </button>
        ))}
        <span className="text-[11.5px] ml-auto" style={{ color: 'var(--faint)' }}>
          {graph.nodes.length} nodes · {graph.links.length} edges · {introducedCount} introductions · avg {avgDeg} links
        </span>
        <button type="button" className="btn btn-ghost btn-sm"
          title={can?.('graph_export') ? 'Export SVG' : 'Pro feature'}
          onClick={() => exportGraph('svg')}>
          <Download size={13} /> SVG{!can?.('graph_export') ? ' · Pro' : ''}
        </button>
        <button type="button" className="btn btn-ghost btn-sm"
          title={can?.('graph_export') ? 'Export PNG' : 'Pro feature'}
          onClick={() => exportGraph('png')}>
          <Download size={13} /> PNG{!can?.('graph_export') ? ' · Pro' : ''}
        </button>
        {!can?.('graph_export') && (
          <a href="#/pro" className="btn btn-ghost btn-sm inline-flex items-center gap-1.5" title="Unlock graph export">
            <ProBadge /> Unlock export
          </a>
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <span className="text-[11px] font-bold uppercase tracking-wider mr-1" style={{ color: 'var(--faint)' }}>Groups</span>
        {groups.map(g => (
          <button key={g.id} className={`chip chip-btn ${gfilter.includes(g.id) ? 'on' : ''}`}
            onClick={() => setGfilter(f => f.includes(g.id) ? f.filter(x => x !== g.id) : [...f, g.id])}>
            <span className="dot" style={{ background: g.color }} /> {g.name} · {contacts.filter(c => contactGroupIds(c).includes(g.id)).length}
          </button>
        ))}
        {gfilter.length > 0 && <button className="chip chip-btn" onClick={() => setGfilter([])}><X size={11} /> clear</button>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 items-start">
        {/* graph canvas */}
        <Card className="overflow-hidden relative">
          <svg ref={svgRef} viewBox={`0 0 ${VB.w} ${VB.h}`} style={{ width: '100%', aspectRatio: `${VB.w}/${VB.h}`, display: 'block', touchAction: 'none' }}
            onPointerMove={e => {
              if (!dragRef.current) return
              const p = pt(e)
              const n = posRef.current[dragRef.current]
              if (n) { n.x = p.x; n.y = p.y; n.vx = 0; n.vy = 0 }
            }}
            onPointerUp={() => { if (dragRef.current) { dragRef.current = null; lastDragRef.current = Date.now(); kick(0.1) } }}
            onPointerLeave={() => { if (dragRef.current) { dragRef.current = null; lastDragRef.current = Date.now(); kick(0.1) } }}
            onClick={() => { setSelId(null); setFocus(null) }}>
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill={EDGE_COLORS.introduced} />
              </marker>
            </defs>
            {graph.links.map(l => {
              const a = posRef.current[l.from], b = posRef.current[l.to]
              if (!a || !b) return null
              const isIntro = l.type === 'introduced'
              const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy))
              const trim = isIntro ? { x1: a.x, y1: a.y, x2: b.x - dx / d * 24, y2: b.y - dy / d * 24 } : { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
              return (
                <line key={l.k} {...trim}
                  stroke={EDGE_COLORS[l.type]} strokeWidth={isIntro ? 1.8 : 1}
                  strokeDasharray={isIntro ? '5 4' : 'none'}
                  markerEnd={isIntro ? 'url(#arr)' : 'none'}
                  opacity={dimLink(l.k) ? 0.07 : isIntro ? 0.9 : 0.35} />
              )
            })}
            {graph.nodes.map(n => {
              const p = posRef.current[n.id]
              if (!p) return null
              const g = groupById[contactGroupIds(n.c)[0]]
              const color = g?.color || '#94a3b8'
              const d = dim(n.id)
              return (
                <g key={n.id} transform={`translate(${p.x},${p.y})`} style={{ cursor: 'grab' }}
                  onPointerDown={e => { e.stopPropagation(); dragRef.current = n.id; e.target.setPointerCapture?.(e.pointerId) }}
                  onClick={e => { e.stopPropagation(); if (Date.now() - lastDragRef.current < 200) return; setSelId(s => s === n.id ? null : n.id); setFocus(null) }}>
                  <circle r={n.r + 7} fill="transparent" />
                  {selId === n.id && <circle r={n.r + 4} fill="none" stroke="var(--text)" strokeWidth="1.5" strokeDasharray="3 3" opacity=".7" />}
                  <circle r={n.r} fill={color + '2a'} stroke={color} strokeWidth="1.6" opacity={d ? 0.18 : 1} />
                  <text textAnchor="middle" dy=".36em" fontSize={10.5} fontWeight="800" fill={d ? '#4a5261' : color} style={{ pointerEvents: 'none' }}>{initials(n.c.name)}</text>
                  <text y={n.r + 14} textAnchor="middle" fontSize="10" fontWeight="700" fill={d ? '#3a4150' : '#9aa3b2'} style={{ pointerEvents: 'none' }}>{n.c.name.split(' ')[0]}</text>
                </g>
              )
            })}
          </svg>
          <div className="absolute left-4 bottom-3 flex gap-3 text-[10.5px] font-semibold flex-wrap" style={{ color: 'var(--faint)' }}>
            {Object.entries(EDGE_LABELS).map(([k, l]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span style={{ width: 18, borderTop: k === 'introduced' ? `2px dashed ${EDGE_COLORS[k]}` : `1.5px solid ${EDGE_COLORS[k]}` }} />{l}
              </span>
            ))}
          </div>
          {activeFocus?.label && (
            <div className="absolute right-4 top-3 chip" style={{ background: 'rgba(129,140,248,.15)', color: '#c7d2fe', borderColor: 'rgba(129,140,248,.4)' }}>
              {activeFocus.label} <button onClick={e => { e.stopPropagation(); setFocus(null) }}><X size={11} /></button>
            </div>
          )}
        </Card>

        {/* side column */}
        <div className="flex flex-col gap-4">
          {/* finder card */}
          <Card className="p-4">
            <h3 className="font-bold text-[13.5px] mb-3 inline-flex items-center gap-2"><Users size={14} style={{ color: 'var(--t-sky)' }} /> Connection finders</h3>
            <div className="label">Mutual connections of</div>
            <div className="flex gap-1.5 mb-3">
              <select className="input" style={{ fontSize: 12 }} value={mutA} onChange={e => setMutA(e.target.value)}>
                <option value="">Person A…</option>
                {visible.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="input" style={{ fontSize: 12 }} value={mutB} onChange={e => setMutB(e.target.value)}>
                <option value="">Person B…</option>
                {visible.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="btn btn-primary btn-sm flex-none" disabled={!mutA || !mutB || mutA === mutB} onClick={runMutual}>Find</button>
            </div>
            <div className="label">Bridges between groups</div>
            <div className="flex gap-1.5">
              <select className="input" style={{ fontSize: 12 }} value={brA} onChange={e => setBrA(e.target.value)}>
                <option value="">Group A…</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <select className="input" style={{ fontSize: 12 }} value={brB} onChange={e => setBrB(e.target.value)}>
                <option value="">Group B…</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button className="btn btn-primary btn-sm flex-none" disabled={!brA || !brB || brA === brB} onClick={runBridge}>Find</button>
            </div>
          </Card>

          {/* selected contact */}
          {sel ? (
            <Card className="p-4 fadein">
              <div className="flex items-center gap-3">
                <Avatar name={sel.name} photo={sel.photo} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[14.5px] truncate">{sel.name}</div>
                  <div className="text-[11.5px] truncate" style={{ color: 'var(--faint)' }}>{[sel.role, sel.company].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <span className="chip flex-none">{(neighborsOf[selId] || []).length} links</span>
              </div>
              <div className="flex gap-1.5 mt-2.5 flex-wrap">
                {contactGroupIds(sel).map(gid => groupById[gid] && <Pill key={gid} color={groupById[gid].color}>{groupById[gid].name}</Pill>)}
              </div>
              {introducedBy && contactById && (
                <div className="mt-3 text-[12.5px]" style={{ color: 'var(--muted)' }}>
                  Introduced by{' '}
                  {visible.some(c => c.name === introducedBy)
                    ? <button className="font-bold hover:underline" style={{ color: EDGE_COLORS.introduced }}
                        onClick={() => setSelId(graph.nodes.find(n => n.c.name === introducedBy)?.id || null)}>{introducedBy}</button>
                    : <strong style={{ color: 'var(--text)' }}>{introducedBy}</strong>}
                </div>
              )}
              {introReverse.length > 0 && (
                <div className="mt-1 text-[12.5px]" style={{ color: 'var(--muted)' }}>
                  Introduced: {introReverse.map(c => (
                    <button key={c.id} className="font-bold hover:underline mr-2" style={{ color: EDGE_COLORS.introduced }}
                      onClick={() => setSelId(c.id)}>{c.name.split(' ')[0]}</button>
                  ))}
                </div>
              )}
              <div className="mt-3">
                <div className="label">Connections</div>
                <div className="flex flex-col gap-1 max-h-44 overflow-y-auto pr-1">
                  {(neighborsOf[selId] || []).map(x => contactById[x.id] && (
                    <button key={x.id} onClick={() => setSelId(x.id)}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[var(--hover)] text-left">
                      <Avatar name={contactById[x.id].name} photo={contactById[x.id].photo} size={22} />
                      <span className="text-[12.5px] font-medium flex-1 truncate">{contactById[x.id].name}</span>
                      <span className="chip" style={{ color: EDGE_COLORS[x.type], borderColor: EDGE_COLORS[x.type] + '45', fontSize: 10 }}>{EDGE_LABELS[x.type]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary btn-sm w-full mt-3" onClick={() => navigate(`/contacts?open=${selId}`)}>
                Open profile <ArrowRight size={13} />
              </button>
            </Card>
          ) : (
            <Card><Empty icon={Network} title="Click any node">Or use the finders to reveal how people connect.</Empty></Card>
          )}
        </div>
      </div>
    </div>
  )
}
