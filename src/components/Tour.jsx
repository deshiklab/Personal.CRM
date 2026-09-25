import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowRight, ArrowLeft, Compass, Sparkles, Eraser, Loader2 } from 'lucide-react'
import { TOUR_STEPS } from '../lib/kb'
import { useCrm } from '../store'

/* ═════════════════════════════════════════════════════════════════════════════
 * Guided tour — spotlight one control at a time and explain it.
 *
 * Starts on the `crm:tour` event (knowledge base, shortcuts overlay) and once
 * automatically for new users. Progress is saved, so quitting mid-tour resumes
 * from the same step next time.
 *
 * After the FIRST completed tour (when sample data is still loaded) we ask
 * whether to keep exploring with demo people or wipe to a blank CRM.
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
  const { helpPrefs, patchHelpPrefs, clearDemoData, keepDemoData, contacts } = useCrm()
  const [step, setStep] = useState(-1)          // -1 = not running
  const [rect, setRect] = useState(null)
  const [card, setCard] = useState({ x: 0, y: 0, side: 'bottom' })
  const [demoAsk, setDemoAsk] = useState(false)
  const [busy, setBusy] = useState(false)
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

  const maybeAskDemo = useCallback(() => {
    /* Only for first-time explorers still sitting on seed data. Restored /
     * synced installs already set demoChoiceDone in restoreAll / boot. */
    const needs =
      !helpPrefs?.demoChoiceDone &&
      helpPrefs?.hasDemoData !== false &&
      Array.isArray(contacts) &&
      contacts.length > 0
    if (needs) setDemoAsk(true)
  }, [helpPrefs?.demoChoiceDone, helpPrefs?.hasDemoData, contacts])

  const finish = useCallback(() => {
    patchHelpPrefs(p => ({ ...p, tourDone: true, tourStep: 0, tourStarted: true }))
    setStep(-1); setRect(null)
    /* slight delay so the spotlight unmounts before the choice card */
    setTimeout(() => maybeAskDemo(), 180)
  }, [patchHelpPrefs, maybeAskDemo])

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

  /* If tour was finished earlier (or skipped) but demo choice never answered
   * — e.g. user closed mid-tour then later marked done somehow — surface it. */
  useEffect(() => {
    if (running || demoAsk) return
    if (!helpPrefs?.tourDone) return
    if (helpPrefs?.demoChoiceDone) return
    if (helpPrefs?.hasDemoData === false) return
    if (!Array.isArray(contacts) || contacts.length === 0) return
    const t = setTimeout(() => setDemoAsk(true), 600)
    return () => clearTimeout(t)
  }, [running, demoAsk, helpPrefs?.tourDone, helpPrefs?.demoChoiceDone, helpPrefs?.hasDemoData, contacts])

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

  const onKeepDemo = () => {
    keepDemoData()
    setDemoAsk(false)
  }
  const onWipeDemo = () => {
    setBusy(true)
    clearDemoData()
    setBusy(false)
    setDemoAsk(false)
  }

  return (
    <>
      {running && rect && createPortal(
        <>
          {/* dim everything */}
          <div className="fixed inset-0 z-[280]" style={{ background: 'rgba(4,6,10,.62)' }} onClick={() => stop()} />
          {/* spotlight ring */}
          <div className="fixed z-[281] pointer-events-none fadein"
            style={{
              top: rect.top - 8, left: rect.left - 8,
              width: rect.width + 16, height: rect.height + 16,
              borderRadius: 14,
              boxShadow: '0 0 0 9999px rgba(4,6,10,.62), 0 0 0 2px var(--i1) inset',
              transition: 'top .2s, left .2s, width .2s, height .2s',
            }} />
          {/* the card */}
          {(() => {
            const s = TOUR_STEPS[step]
            const pad = 8
            const W = 320
            const left = Math.max(10, Math.min(rect.left + rect.width / 2 - W / 2, window.innerWidth - W - 10))
            const top = card.side === 'bottom'
              ? Math.min(rect.bottom + pad + 12, window.innerHeight - 210)
              : Math.max(10, rect.top - pad - 190)
            return (
              <div className="panel fixed z-[282] p-4 fadein"
                style={{ top, left, width: Math.min(W, window.innerWidth - 20), maxWidth: 'calc(100vw - 20px)', borderRadius: 16 }}>
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg grid place-items-center flex-none"
                    style={{ background: 'rgba(129,140,248,.18)', color: 'var(--t-sky)' }}>
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
            )
          })()}
        </>,
        document.body,
      )}

      {demoAsk && createPortal(
        <div className="fixed inset-0 z-[290] grid place-items-center p-4 fadein"
          style={{ background: 'rgba(4,6,10,.72)' }} role="dialog" aria-modal="true" aria-labelledby="demo-choice-title">
          <div className="panel w-full max-w-[420px] p-5 sm:p-6" style={{ borderRadius: 18 }}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl grid place-items-center flex-none"
                style={{ background: 'rgba(167,139,250,.18)', color: '#a78bfa' }}>
                <Sparkles size={18} />
              </div>
              <div className="min-w-0">
                <h2 id="demo-choice-title" className="text-[16px] font-extrabold leading-snug">
                  Keep exploring, or start blank?
                </h2>
                <p className="text-[12.5px] mt-1.5 leading-snug" style={{ color: 'var(--muted)' }}>
                  The people, tasks and notes you just saw are <b style={{ color: 'var(--text)' }}>sample data</b> —
                  fictional names and numbers so the app feels alive on first open.
                  Your profile and pincode stay either way.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 mt-4">
              <button type="button" className="btn btn-primary w-full justify-center text-left"
                style={{ height: 'auto', padding: '12px 14px', gap: 12 }}
                disabled={busy} onClick={onKeepDemo}>
                <Sparkles size={16} className="flex-none" />
                <span className="flex-1 text-left">
                  <span className="block text-[13.5px] font-extrabold">Continue with demo data</span>
                  <span className="block text-[11.5px] font-medium opacity-80 mt-0.5">
                    Keep learning with the sample network. Wipe later in Settings anytime.
                  </span>
                </span>
              </button>

              <button type="button" className="btn btn-ghost w-full justify-center text-left"
                style={{ height: 'auto', padding: '12px 14px', gap: 12, border: '1px solid var(--border)' }}
                disabled={busy} onClick={onWipeDemo}>
                {busy ? <Loader2 size={16} className="animate-spin flex-none" /> : <Eraser size={16} className="flex-none" />}
                <span className="flex-1 text-left">
                  <span className="block text-[13.5px] font-extrabold">Reset — wipe demo data</span>
                  <span className="block text-[11.5px] font-medium mt-0.5" style={{ color: 'var(--muted)' }}>
                    Empty CRM. Ready for your real contacts, tasks and notes.
                  </span>
                </span>
              </button>
            </div>

            <p className="text-[10.5px] text-center mt-4 leading-snug" style={{ color: 'var(--faint)' }}>
              This choice only appears once after the guided tour on a fresh install.
            </p>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
