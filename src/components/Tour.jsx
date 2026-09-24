import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowRight, ArrowLeft, Compass } from 'lucide-react'
import { TOUR_STEPS } from '../lib/kb'
import { useCrm } from '../store'

/* ═════════════════════════════════════════════════════════════════════════════
 * Guided tour — spotlight one control at a time and explain it.
 *
 * Starts on the `crm:tour` event (knowledge base, shortcuts overlay) and once
 * automatically for new users. Progress is saved, so quitting mid-tour resumes
 * from the same step next time.
 * ═════════════════════════════════════════════════════════════════════════════ */

const visible = el => {
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width < 2 || r.height < 2) return null
  const cs = getComputedStyle(el)
  if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) return null
  return el
}
/** first element matching the selector that is actually on screen */
const resolve = sel => {
  try {
    for (const el of document.querySelectorAll(sel)) {
      const v = visible(el)
      if (v) return v
    }
  } catch {}
  return null
}

export default function Tour({ autoStart = false }) {
  const { helpPrefs, patchHelpPrefs } = useCrm()
  const [step, setStep] = useState(-1)          // -1 = not running
  const [rect, setRect] = useState(null)
  const [card, setCard] = useState({ x: 0, y: 0, side: 'bottom' })
  const running = step >= 0

  const stop = useCallback((save = true) => {
    setStep(-1); setRect(null)
    if (save) patchHelpPrefs(p => ({ ...p, tourStarted: true }))
  }, [patchHelpPrefs])

  const start = useCallback(() => {
    const resume = Number(helpPrefs?.tourStep || 0)
    setStep(resume < TOUR_STEPS.length ? resume : 0)
    patchHelpPrefs(p => ({ ...p, tourStarted: true }))
  }, [helpPrefs?.tourStep, patchHelpPrefs])

  const finish = useCallback(() => {
    patchHelpPrefs(p => ({ ...p, tourDone: true, tourStep: 0, tourStarted: true }))
    setStep(-1); setRect(null)
  }, [patchHelpPrefs])

  /* open on the custom event */
  useEffect(() => {
    const onTour = () => start()
    window.addEventListener('crm:tour', onTour)
    return () => window.removeEventListener('crm:tour', onTour)
  }, [start])

  /* auto-start once, after the shell has settled */
  useEffect(() => {
    if (!autoStart) return
    if (helpPrefs?.tourDone || helpPrefs?.tourStarted) return
    const t = setTimeout(start, 2200)
    return () => clearTimeout(t)
  }, [autoStart, helpPrefs?.tourDone, helpPrefs?.tourStarted, start])

  /* measure the current step's target; skip steps that are not on screen */
  useLayoutEffect(() => {
    if (!running) return
    let i = step
    let el = null
    while (i < TOUR_STEPS.length && !(el = resolve(TOUR_STEPS[i].sel))) i++
    if (i >= TOUR_STEPS.length) { finish(); return }
    if (i !== step) setStep(i)

    const measure = () => {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()

    const below = el.getBoundingClientRect().bottom + 190 < window.innerHeight
    setCard(c => ({ ...c, side: below ? 'bottom' : 'top' }))

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const onMove = () => measure()
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    const t = setTimeout(measure, 260)   // after the smooth scroll lands
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
      clearTimeout(t)
    }
  }, [running, step, finish])

  /* keyboard */
  useEffect(() => {
    if (!running) return
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); stop() }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        step + 1 >= TOUR_STEPS.length ? finish() : setStep(s => s + 1)
      } else if (e.key === 'ArrowLeft') { e.preventDefault(); setStep(s => Math.max(0, s - 1)) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [running, step, finish, stop])

  /* remember where we got to */
  useEffect(() => { if (running) patchHelpPrefs(p => ({ ...p, tourStep: step })) }, [running, step, patchHelpPrefs])

  if (!running || !rect) return null

  const s = TOUR_STEPS[step]
  const pad = 8
  const W = 320
  const left = Math.max(10, Math.min(rect.left + rect.width / 2 - W / 2, window.innerWidth - W - 10))
  const top = card.side === 'bottom'
    ? Math.min(rect.bottom + pad + 12, window.innerHeight - 210)
    : Math.max(10, rect.top - pad - 190)

  return createPortal(
    <>
      {/* dim everything */}
      <div className="fixed inset-0 z-[280]" style={{ background: 'rgba(4,6,10,.62)' }} onClick={() => stop()} />
      {/* spotlight ring */}
      <div className="fixed z-[281] pointer-events-none fadein"
        style={{
          top: rect.top - pad, left: rect.left - pad,
          width: rect.width + pad * 2, height: rect.height + pad * 2,
          borderRadius: 14,
          boxShadow: '0 0 0 9999px rgba(4,6,10,.62), 0 0 0 2px var(--i1) inset',
          transition: 'top .2s, left .2s, width .2s, height .2s',
        }} />
      {/* the card */}
      <div className="panel fixed z-[282] p-4 fadein"
        style={{ top, left, width: Math.min(W, window.innerWidth - 20), maxWidth: 'calc(100vw - 20px)', borderRadius: 16 }}>
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg grid place-items-center flex-none"
            style={{ background: 'rgba(129,140,248,.18)', color: 'var(--i2)' }}>
            <Compass size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-extrabold">{s.title}</div>
            <div className="text-[12px] mt-1 leading-snug" style={{ color: 'var(--muted)' }}>{s.body}</div>
          </div>
          <button className="icon-btn flex-none" onClick={() => stop()} aria-label="Close tour">
            <X size={13} />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-3.5">
          <div className="flex items-center gap-1 mr-auto">
            {TOUR_STEPS.map((_, i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full"
                style={{ background: i === step ? 'var(--i1)' : 'var(--border2)' }} />
            ))}
          </div>
          <span className="text-[11px] font-bold" style={{ color: 'var(--faint)' }}>{step + 1} / {TOUR_STEPS.length}</span>
          {step > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setStep(s => s - 1)}><ArrowLeft size={12} /></button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => (step + 1 >= TOUR_STEPS.length ? finish() : setStep(s => s + 1))}>
            {step + 1 >= TOUR_STEPS.length ? 'Done' : 'Next'} <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
