import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Phone, Mail, Building2, Clock } from 'lucide-react'
import { TIPS, TERMS } from '../lib/kb'
import { useCrm } from '../store'
import { relDay, initials } from '../lib'

/* ═════════════════════════════════════════════════════════════════════════════
 * Tooltips — one global engine, driven by attributes.
 *
 *   <button data-tip="contacts.merge">…</button>        → looks the id up in TIPS
 *   data-tip-title / data-tip-body / data-tip-place     → inline override
 *   data-tip-learn="article-id"                         → adds "Learn more"
 *   data-tip-contact="<contactId>"                      → mini profile card
 *   <Term id="rhythm">follow-up</Term>                  → dotted term, defined
 *
 * Mounted once (see <TooltipHost /> in App). Works with mouse, keyboard focus
 * and touch; flips and clamps so it never leaves the viewport.
 * ═════════════════════════════════════════════════════════════════════════════ */

const OPEN_DELAY = 320     // ms of hover before showing
const CLOSE_DELAY = 90
const TOUCH_LINGER = 2600  // ms a tap-shown tooltip stays

const isTyping = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)

export default function TooltipHost({ enabled = true }) {
  const navigate = useNavigate()
  const { contacts, relFreq, followUpStatus } = useCrm()
  const [tip, setTip] = useState(null)          // { title, body, shortcut, learn, contact, place }
  const [pos, setPos] = useState({ x: 0, y: 0, side: 'top', arrow: 0, ready: false })
  const cardRef = useRef(null)
  const targetRef = useRef(null)
  const timer = useRef(null)
  const hideTimer = useRef(null)
  const touchTimer = useRef(null)

  const clearTimers = () => {
    clearTimeout(timer.current); clearTimeout(hideTimer.current); clearTimeout(touchTimer.current)
  }

  const hide = useCallback(() => {
    clearTimers()
    targetRef.current = null
    setTip(null)
    setPos(p => ({ ...p, ready: false }))
  }, [])

  /* read a tip definition off an element */
  const readTip = useCallback(el => {
    const contactId = el.getAttribute('data-tip-contact')
    if (contactId) {
      const c = contacts.find(x => x.id === contactId)
      if (c) return { contact: c }
      return null
    }
    const id = el.getAttribute('data-tip')
    const inlineTitle = el.getAttribute('data-tip-title')
    const inlineBody = el.getAttribute('data-tip-body')
    const t = id ? TIPS[id] : null
    const term = id && !t ? TERMS[id] : null

    if (t) return { title: t.title, body: t.body, shortcut: t.shortcut, learn: t.learn || el.getAttribute('data-tip-learn') }
    if (term) return { title: term.term, body: term.def, learn: term.learn }
    if (inlineTitle || inlineBody) return {
      title: inlineTitle, body: inlineBody, shortcut: el.getAttribute('data-tip-shortcut'),
      learn: el.getAttribute('data-tip-learn'),
    }
    return null
  }, [contacts])

  const showFor = useCallback(el => {
    const data = readTip(el)
    if (!data) return
    targetRef.current = el
    setTip({ ...data, place: el.getAttribute('data-tip-place') || 'top' })
  }, [readTip])

  /* ── listeners ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!enabled) { hide(); return }

    const onOver = e => {
      const el = e.target.closest?.('[data-tip],[data-tip-contact]')
      if (!el) return
      if (el === targetRef.current) return
      clearTimers()
      hideTimer.current = setTimeout(() => showFor(el), el === targetRef.current ? 0 : OPEN_DELAY)
    }
    const onOut = e => {
      const el = e.target.closest?.('[data-tip],[data-tip-contact]')
      if (!el) return
      clearTimeout(timer.current)
      timer.current = setTimeout(hide, CLOSE_DELAY)
    }
    const onFocus = e => {
      const el = e.target.closest?.('[data-tip],[data-tip-contact]')
      if (!el) return
      clearTimers(); showFor(el)          // keyboard users get it immediately
    }
    const onTouch = e => {
      const el = e.target.closest?.('[data-tip],[data-tip-contact]')
      if (!el) { hide(); return }
      clearTimers()
      showFor(el)
      touchTimer.current = setTimeout(hide, TOUCH_LINGER)
    }
    const onKey = e => { if (e.key === 'Escape') hide() }
    const onDown = e => {
      if (isTyping(e.target)) { hide(); return }
      if (e.target.closest?.('[data-tip],[data-tip-contact]')) return
      /* clicking the tooltip itself (Learn more) must not dismiss it first */
      if (e.target.closest?.('[data-tip-card]')) return
      hide()
    }

    document.addEventListener('mouseover', onOver, true)
    document.addEventListener('mouseout', onOut, true)
    document.addEventListener('focusin', onFocus, true)
    document.addEventListener('touchstart', onTouch, true)
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      document.removeEventListener('mouseover', onOver, true)
      document.removeEventListener('mouseout', onOut, true)
      document.removeEventListener('focusin', onFocus, true)
      document.removeEventListener('touchstart', onTouch, true)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [enabled, hide, showFor])

  useEffect(() => () => clearTimers(), [])

  /* ── positioning ───────────────────────────────────────────────────────── */
  useLayoutEffect(() => {
    if (!tip || !cardRef.current || !targetRef.current) return
    const r = targetRef.current.getBoundingClientRect()
    const c = cardRef.current.getBoundingClientRect()
    const margin = 10, gap = 11
    const vw = window.innerWidth, vh = window.innerHeight
    const w = Math.min(c.width, vw - margin * 2)
    const h = c.height

    let side = tip.place && tip.place !== 'top' ? tip.place : 'top'
    if (side === 'top' && r.top - h - gap < margin) side = 'bottom'
    if (side === 'bottom' && r.bottom + h + gap > vh - margin) side = r.top > vh - r.bottom ? 'top' : 'bottom'

    let y = side === 'top' ? r.top - h - gap : r.bottom + gap
    y = Math.max(margin, Math.min(y, vh - h - margin))

    let x = r.left + r.width / 2 - w / 2
    x = Math.max(margin, Math.min(x, vw - w - margin))

    const arrow = Math.max(14, Math.min(w - 14, r.left + r.width / 2 - x))
    setPos({ x, y, side, arrow, ready: true })
  }, [tip])

  if (!tip || !enabled) return null

  const goLearn = () => {
    const slug = tip.learn
    hide()
    if (slug) navigate(`/knowledge?a=${encodeURIComponent(slug)}`)
  }

  return createPortal(
    <div
      ref={cardRef}
      role="tooltip"
      data-tip-card=""
      className="fadein"
      style={{
        position: 'fixed', left: pos.x, top: pos.y, zIndex: 9000,
        width: tip.contact ? 268 : 288,
        maxWidth: 'calc(100vw - 20px)',
        opacity: pos.ready ? 1 : 0,
        pointerEvents: 'auto',
        background: 'var(--panel)',
        border: '1px solid var(--border2)',
        borderRadius: 14,
        boxShadow: '0 18px 50px rgba(0,0,0,.55)',
        padding: tip.contact ? 12 : '11px 13px',
        transition: 'opacity .12s ease',
      }}
      onMouseEnter={() => { clearTimeout(timer.current); clearTimeout(touchTimer.current) }}
      onMouseLeave={() => { timer.current = setTimeout(hide, CLOSE_DELAY) }}
    >
      {tip.contact
        ? <ContactCard c={tip.contact} relFreq={relFreq} status={followUpStatus?.(tip.contact)} />
        : (
          <>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                {tip.title && <div className="text-[13px] font-extrabold leading-tight">{tip.title}</div>}
                {tip.body && (
                  <div className="text-[12px] leading-snug mt-1" style={{ color: 'var(--muted)' }}>{tip.body}</div>
                )}
              </div>
              {tip.shortcut && (
                <span className="flex-none text-[10.5px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: 'var(--hover)', border: '1px solid var(--border2)', color: 'var(--muted)' }}>
                  {tip.shortcut}
                </span>
              )}
            </div>
            {tip.learn && (
              <button type="button" onClick={goLearn}
                className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-bold"
                style={{ color: 'var(--t-sky)', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
                <BookOpen size={11} /> Learn more
              </button>
            )}
          </>
        )}

      {/* arrow */}
      <span style={{
        position: 'absolute', left: pos.arrow, width: 10, height: 10, marginLeft: -5,
        background: 'var(--panel)',
        borderRight: '1px solid var(--border2)',
        borderBottom: '1px solid var(--border2)',
        transform: 'rotate(45deg)',
        ...(pos.side === 'top' ? { bottom: -6 } : { top: -6, transform: 'rotate(225deg)' }),
      }} />
    </div>,
    document.body,
  )
}

/* ── mini profile (used by data-tip-contact) ──────────────────────────────── */
function ContactCard({ c, relFreq, status }) {
  const rhythm = relFreq?.[c.rel]?.label || '—'
  const line = (Icon, text) => text
    ? <div key={text} className="flex items-center gap-2 text-[12px] truncate" style={{ color: 'var(--muted)' }}>
        <Icon size={11} className="flex-none" />{text}
      </div>
    : null

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl grid place-items-center text-[12px] font-black flex-none"
          style={{ background: 'linear-gradient(120deg,#818cf8,#38bdf8)', color: '#0a0c11' }}>
          {initials(c.name)}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-extrabold truncate">{c.name}</div>
          {(c.role || c.company) && (
            <div className="text-[11.5px] truncate" style={{ color: 'var(--muted)' }}>
              {[c.role, c.company].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2.5 flex flex-col gap-1">
        {line(Phone, c.phone)}
        {line(Mail, c.email)}
        {line(Building2, rhythm)}
        {line(Clock, c.lastContact ? `Last touch ${relDay(c.lastContact)}` : 'Never contacted')}
      </div>
      {status?.state === 'overdue' && (
        <div className="mt-2 text-[11px] font-bold" style={{ color: 'var(--t-rose)' }}>
          {status.overdueBy}d overdue for a follow-up
        </div>
      )}
    </div>
  )
}

/* ── helpers for JSX ──────────────────────────────────────────────────────── */

/** Spread onto any element to attach a registry tooltip:
 *  <button {...tip('contacts.merge')} …> */
export const tip = (id, extra = {}) => ({ 'data-tip': id, ...extra })

/** Ad-hoc tooltip content, no registry entry needed. */
export const tipWith = (title, body, place = 'top') => ({
  'data-tip-title': title, 'data-tip-body': body, 'data-tip-place': place,
})

/** Inline glossary term: dotted underline + definition on hover. */
export function Term({ id, children, className = '' }) {
  const t = TERMS[id]
  const label = children ?? t?.term ?? id
  return (
    <span data-tip={id} className={className}
      title=""
      style={{
        borderBottom: '1px dotted var(--border2)',
        cursor: 'help',
        textDecoration: 'none',
      }}>{label}</span>
  )
}
