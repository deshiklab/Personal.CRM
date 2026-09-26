import { useEffect, useMemo, useState } from 'react'
import { LayoutTemplate, Plus, Trash2, Check } from 'lucide-react'
import { useT } from '../lib/i18n'
import {
  STARTERS, loadUserTemplates, addUserTemplate, deleteUserTemplate, applyTemplate, templatesByKind,
} from '../lib/templates'

/**
 * Compact template chooser.
 * props:
 *   kind: 'note' | 'task' | 'message' | null (all)
 *   vars: { name } for {name} fill
 *   onApply: ({ title, body, kind }) => void
 *   compact: bool — icon chip only
 */
export default function TemplatePicker({ kind = null, vars = {}, onApply, compact = false, className = '' }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [mine, setMine] = useState(() => loadUserTemplates())
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({ name: '', title: '', body: '', kind: kind || 'note' })

  useEffect(() => {
    if (open) setMine(loadUserTemplates())
  }, [open])

  const list = useMemo(() => {
    const user = mine.filter(x => !kind || x.kind === kind)
    const starters = STARTERS.filter(x => !kind || x.kind === kind)
    return { user, starters }
  }, [mine, kind])

  const apply = tpl => {
    const filled = applyTemplate(tpl, vars)
    onApply?.(filled)
    setOpen(false)
  }

  const saveNew = () => {
    if (!draft.name.trim() && !draft.title.trim()) return
    const item = addUserTemplate(draft)
    setMine(loadUserTemplates())
    setSaving(false)
    setDraft({ name: '', title: '', body: '', kind: kind || 'note' })
    apply(item)
  }

  const remove = id => {
    deleteUserTemplate(id)
    setMine(loadUserTemplates())
  }

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        type="button"
        className={compact ? 'icon-btn' : 'btn btn-ghost btn-sm'}
        title={t('templates.title')}
        onClick={() => setOpen(o => !o)}
      >
        <LayoutTemplate size={compact ? 14 : 13} />
        {!compact && <span>{t('templates.apply')}</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className="absolute z-[61] mt-1 right-0 w-[min(340px,92vw)] rounded-xl shadow-xl overflow-hidden"
            style={{ background: 'var(--cardbg)', border: '1px solid var(--border)' }}
          >
            <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--hairline)' }}>
              <div className="text-[12.5px] font-semibold">{t('templates.title')}</div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSaving(s => !s)}>
                <Plus size={12} /> {t('templates.saveAs')}
              </button>
            </div>

            {saving && (
              <div className="p-3 flex flex-col gap-2" style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--cardbg2)' }}>
                <input className="input" placeholder={t('templates.name')} value={draft.name}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value, title: d.title || e.target.value }))} />
                <input className="input" placeholder="Title…" value={draft.title}
                  onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
                <textarea className="input" rows={3} placeholder={t('templates.body')} value={draft.body}
                  onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} />
                <div className="flex gap-1.5 flex-wrap">
                  {['note', 'task', 'message'].map(k => (
                    <button key={k} type="button" className="chip chip-btn"
                      style={draft.kind === k ? { background: 'var(--i1)', color: '#fff', borderColor: 'transparent' } : {}}
                      onClick={() => setDraft(d => ({ ...d, kind: k }))}>
                      {t(`templates.kind${k[0].toUpperCase()}${k.slice(1)}`)}
                    </button>
                  ))}
                  <button type="button" className="btn btn-primary btn-sm ml-auto" onClick={saveNew}>
                    <Check size={12} /> {t('common.save')}
                  </button>
                </div>
              </div>
            )}

            <div className="max-h-[280px] overflow-y-auto p-2">
              {list.user.length > 0 && (
                <div className="mb-2">
                  <div className="label px-1 mb-1">{t('templates.mine')}</div>
                  {list.user.map(tpl => (
                    <div key={tpl.id} className="flex items-stretch gap-1">
                      <button type="button" className="flex-1 text-left rounded-lg px-2.5 py-2 hover:opacity-90"
                        style={{ background: 'var(--cardbg2)' }}
                        onClick={() => apply(tpl)}>
                        <div className="text-[12.5px] font-semibold truncate">{tpl.name || tpl.title}</div>
                        {tpl.body && <div className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>{tpl.body}</div>}
                      </button>
                      <button type="button" className="icon-btn" title={t('templates.delete')}
                        style={{ color: 'var(--t-rose)' }} onClick={() => remove(tpl.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="label px-1 mb-1">{t('templates.starters')}</div>
              {list.starters.length === 0 && list.user.length === 0 && (
                <div className="text-[12px] px-2 py-3" style={{ color: 'var(--faint)' }}>{t('templates.empty')}</div>
              )}
              {list.starters.map(tpl => (
                <button key={tpl.id} type="button"
                  className="w-full text-left rounded-lg px-2.5 py-2 mb-1 hover:opacity-90"
                  style={{ background: 'var(--cardbg2)' }}
                  onClick={() => apply(tpl)}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--chipbg)', color: 'var(--muted)' }}>{tpl.kind}</span>
                    <span className="text-[12.5px] font-semibold truncate">{tpl.name}</span>
                  </div>
                  {tpl.body && <div className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--muted)' }}>{tpl.body}</div>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
