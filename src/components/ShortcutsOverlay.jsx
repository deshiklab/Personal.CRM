import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, Keyboard, BookOpen, Compass, MessageSquare } from 'lucide-react'
import { SHORTCUTS } from '../lib/kb'
import { useCrm } from '../store'

/* Keyboard shortcut reference. Opens on "?" (when you are not typing) and on
 * the crm:shortcuts event. */

export default function ShortcutsOverlay() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { helpPrefs, patchHelpPrefs } = useCrm()

  useEffect(() => {
    const onCustom = () => setOpen(true)
    const onKey = e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) { e.preventDefault(); setOpen(o => !o) }
    }
    const onEsc = e => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('crm:shortcuts', onCustom)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('crm:shortcuts', onCustom)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keydown', onEsc)
    }
  }, [])

  if (!open) return null

  const go = path => { setOpen(false); navigate(path) }
  const groups = [...new Set(SHORTCUTS.map(s => s.group || 'General'))]

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-3 sm:p-6"
      role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"
      onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
      <div className="absolute inset-0" style={{ background: 'rgba(4,6,10,.7)', backdropFilter: 'blur(3px)' }} />

      <div className="panel relative w-full sm:max-w-2xl max-h-[88vh] overflow-y-auto p-5 sm:p-6 fadein"
        style={{ borderRadius: 20 }}>
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h2 className="text-[17px] font-extrabold flex items-center gap-2">
              <Keyboard size={17} style={{ color: 'var(--i2)' }} /> Keyboard shortcuts
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>
              Press <Kbd>?</Kbd> any time to bring this back.
            </p>
          </div>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close"><X size={15} /></button>
        </div>

        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
          {groups.map(g => (
            <div key={g}>
              <div className="label">{g}</div>
              <div className="flex flex-col gap-1.5 mt-1">
                {SHORTCUTS.filter(s => (s.group || 'General') === g).map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1 flex-none">
                      {s.keys.map((k, j) => (
                        <span key={j} className="flex items-center gap-0.5">
                          {j > 0 && <span className="text-[10px]" style={{ color: 'var(--faint)' }}>then</span>}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </div>
                    <div className="min-w-0 text-[12.5px]">
                      <span style={{ color: 'var(--text)' }}>{s.label}</span>
                      {s.hint && <span className="block text-[11px]" style={{ color: 'var(--faint)' }}>{s.hint}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 flex flex-wrap items-center gap-2" style={{ borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-primary btn-sm" onClick={() => go('/knowledge')}>
            <BookOpen size={13} /> Open the knowledge base
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('crm:tour')) }}>
            <Compass size={13} /> Replay the guided tour
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => patchHelpPrefs(p => ({ tips: !p.tips }))}>
            <MessageSquare size={13} /> {helpPrefs?.tips ? 'Turn tooltips off' : 'Turn tooltips on'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md text-[11px] font-bold"
      style={{ background: 'var(--hover)', border: '1px solid var(--border2)', color: 'var(--text)', boxShadow: '0 1px 0 rgba(0,0,0,.4)' }}>
      {children}
    </kbd>
  )
}
