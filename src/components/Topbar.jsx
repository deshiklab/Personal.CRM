import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { UserPlus, CalendarPlus, PlusSquare, Search, Sun, Moon, Download, Cloud, Loader2, CloudOff, Menu, BookOpen } from 'lucide-react'
import { useCrm } from '../store'
import { MONTHS, tsRel } from '../lib'
import { useT, localeTag } from '../lib/i18n'

export default function Topbar({ onMenu = () => {} }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme, syncing, syncState, syncNow, googleMode, syncProvider } = useCrm()
  const { t, locale } = useT()
  const now = new Date()
  const dateStr = now.toLocaleDateString(localeTag(locale), { weekday: 'short', month: 'short', day: 'numeric' })
  const pageTitle = t(`titles.${pathname}`) || t('app.name')

  /* PWA install: capture the browser's install prompt */
  const [installEvt, setInstallEvt] = useState(null)
  useEffect(() => {
    const onPrompt = e => { e.preventDefault(); setInstallEvt(e) }
    const onDone = () => setInstallEvt(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onDone)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onDone) }
  }, [])
  const install = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice.catch(() => {}); setInstallEvt(null) }

  return (
    <header className="h-16 flex-none border-b flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 md:px-6 safe-top"
      style={{ borderColor: 'var(--border)', background: 'var(--topbg)', backdropFilter: 'blur(10px)' }}>
      <button className="icon-btn lg:hidden flex-none" onClick={onMenu} title={t('topbar.menu')} aria-label={t('topbar.menu')} data-tip="topbar.menu" data-tour="menu">
        <Menu size={18} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-[16px] font-bold tracking-tight truncate">{pageTitle}</h1>
        <div className="text-[11.5px] font-medium hidden sm:block" style={{ color: 'var(--faint)' }}>{dateStr}</div>
      </div>
      <div className="flex items-center gap-0.5 sm:gap-2 flex-none">
        {installEvt && (
          <button className="btn btn-ghost btn-sm" onClick={install} title={t('topbar.installTitle')} style={{ color: 'var(--t-sky)' }}>
            <Download size={14} /><span className="hidden md:inline">{t('topbar.install')}</span>
          </button>
        )}
        <button
          className="btn btn-ghost btn-sm"
          data-tip="topbar.sync"
          style={syncProvider() !== 'none' ? { color: 'var(--t-green)' } : { color: 'var(--faint)' }}
          title={
            syncProvider() === 'none' ? t('topbar.syncNoneTitle') :
            syncing ? t('topbar.syncing') :
            (syncState.lastSyncAt ? tsRel(syncState.lastSyncAt) : t('topbar.syncNow'))
          }
          onClick={() => {
            if (syncProvider() === 'none') return navigate('/settings')
            syncNow({ manual: true })
          }}>
          {syncing ? <Loader2 size={14} className="animate-spin" /> :
           syncProvider() !== 'none' ? <Cloud size={14} /> : <CloudOff size={14} />}
          <span className="hidden lg:inline">
            {syncProvider() === 'none' ? t('topbar.syncSetup') :
             syncing ? t('topbar.syncing') :
             syncState.lastSyncAt ? tsRel(syncState.lastSyncAt) : t('topbar.syncNow')}
          </span>
        </button>
        <button className="icon-btn" onClick={toggleTheme} data-tip="topbar.theme" title={theme === 'dark' ? t('topbar.themeDark') : theme === 'light' ? t('topbar.themeLight') : t('topbar.themeOcean')}>
          {theme === 'dark' ? <Sun size={15} /> : theme === 'ocean' ? <Moon size={15} /> : <Moon size={15} />}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => window.dispatchEvent(new Event('crm:search'))} title={t('topbar.search') + ' (⌘K)'} data-tip="topbar.search" data-tour="search">
          <Search size={14} /><span className="hidden md:inline">{t('topbar.search')}</span>
          <kbd className="chip hidden md:inline-flex" style={{ fontSize: 10, padding: '1px 7px' }}>⌘K</kbd>
        </button>
        <button className="btn btn-ghost btn-sm hidden sm:inline-flex" onClick={() => navigate('/contacts?new=1')} title={t('topbar.addContact')} data-tip="topbar.add-contact" data-tour="quickadd">
          <UserPlus size={14} /><span className="hidden sm:inline">{t('topbar.contact')}</span>
        </button>
        <button className="btn btn-ghost btn-sm hidden sm:inline-flex" onClick={() => navigate('/tasks?new=1')} title={t('topbar.newTask')} data-tip="topbar.add-task">
          <PlusSquare size={14} /><span className="hidden sm:inline">{t('topbar.task')}</span>
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/calendar?new=1')} title={t('topbar.newEvent')} data-tip="topbar.add-event">
          <CalendarPlus size={14} /><span className="hidden sm:inline">{t('topbar.event')}</span>
        </button>
        <button className="icon-btn" onClick={() => navigate('/knowledge')} title={t('topbar.knowledge')} aria-label={t('topbar.knowledge')}
          data-tip="nav.knowledge" data-tour="help">
          <BookOpen size={15} />
        </button>
      </div>
    </header>
  )
}
