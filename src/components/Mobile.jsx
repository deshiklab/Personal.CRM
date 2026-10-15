import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, CheckSquare, StickyNote, Menu, X,
} from 'lucide-react'
import { cn } from '../lib'
import { t as tr, useLang } from '../lib/i18n'

/* ── viewport hook ─────────────────────────────────────────── */
/* true while the viewport is narrower than `max` (default: below lg).
 * SSR/jsdom safe — falls back to desktop. */
export function useIsMobile(max = 1023) {
  const [mobile, setMobile] = useState(() => {
    try { return typeof matchMedia === 'function' && matchMedia(`(max-width: ${max}px)`).matches } catch { return false }
  })
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia(`(max-width: ${max}px)`)
    const on = e => setMobile(e.matches)
    mq.addEventListener?.('change', on)
    mq.addListener?.(on)
    setMobile(mq.matches)
    return () => { mq.removeEventListener?.('change', on); mq.removeListener?.(on) }
  }, [max])
  return mobile
}

/* ── bottom tab bar (< lg) ─────────────────────────────────── */
/* Home · Contacts · Tasks · Notes · More — More opens the sidebar as a
 * slide-over sheet. Desktop keeps the full sidebar; this bar is lg:hidden. */
const TABS = [
  { to: '/', label: tr('tabs.home'), icon: LayoutDashboard, end: true },
  { to: '/contacts', label: tr('tabs.contacts'), icon: Users },
  { to: '/tasks', label: tr('tabs.tasks'), icon: CheckSquare },
  { to: '/notes', label: tr('tabs.notes'), icon: StickyNote },
]
export function BottomTabBar({ onMore, moreOpen }) {
  useLang()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <nav className="bottom-tabs lg:hidden" data-testid="bottom-tabs">
      {TABS.map(item => {
        const active = item.end ? pathname === item.to : pathname.startsWith(item.to)
        return (
          <button key={item.to} data-testid={`tab-${item.to.replace(/\//g, '') || 'home'}`}
            className={cn('flex flex-col items-center justify-center gap-0.5 flex-1 py-2 min-h-[52px]', active && 'text-[var(--text)]')}
            style={{ color: active ? 'var(--text)' : 'var(--faint)' }}
            onClick={() => navigate(item.to)}>
            <item.icon size={19} />
            <span className="text-[9.5px] font-bold">{item.label}</span>
          </button>
        )
      })}
      <button data-testid="tab-more" className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 min-h-[52px]"
        style={{ color: moreOpen ? 'var(--text)' : 'var(--faint)' }}
        onClick={onMore}>
        {moreOpen ? <X size={19} /> : <Menu size={19} />}
        <span className="text-[9.5px] font-bold">{tr('tabs.more')}</span>
      </button>
    </nav>
  )
}

/* ── Sheet: bottom-sheet on phones, centered panel on desktop ── */
export function Sheet({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return
    const fn = e => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[92] flex items-end md:items-center justify-center" data-testid="sheet"
      style={{ background: 'rgba(6,8,12,.55)', backdropFilter: 'blur(3px)' }} onClick={onClose}>
      <div className={cn('sheet-panel fadein w-full', wide ? 'md:max-w-2xl' : 'md:max-w-md')}
        role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle md:hidden" />
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b flex-none" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-bold text-[15px] flex-1 truncate">{title}</h3>
          <button className="icon-btn" title="Close" data-testid="sheet-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
      </div>
    </div>
  )
}

/* ── ToolbarRow: chip/button rows that scroll sideways on phones ── */
export function ToolbarRow({ children, className = '', ...rest }) {
  return (
    <div className={cn('toolbar-row flex items-center gap-1.5', className)} {...rest}>
      {children}
    </div>
  )
}
