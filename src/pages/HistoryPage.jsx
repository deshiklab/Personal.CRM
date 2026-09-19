import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileUp, RotateCcw, ChevronDown, CheckCircle2, AlertTriangle, MinusCircle, RefreshCw, ShieldAlert, ArrowRight } from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Card, Stat, Avatar, Pill, Seg, Modal, Empty, CsvButton } from '../components/ui'
import { tsRel } from '../lib'

const FIELD_LABEL = { phone: 'Phone', email: 'Email', company: 'Company', birthday: 'Birthday', record: 'Record' }

const STATUS = {
  added:   { pill: <Pill color="#34d399"><CheckCircle2 size={11} /> Added</Pill> },
  updated: { pill: <Pill color="#fbbf24"><AlertTriangle size={11} /> Updated</Pill> },
  skipped: { pill: <Pill color="#6b7382"><MinusCircle size={11} /> Skip</Pill> },
}

export default function HistoryPage() {
  const { imports, audit } = useCrm()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') === 'sync' ? 'sync' : 'imports')
  const [openBatch, setOpenBatch] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const touched = imports.reduce((s, b) => s + b.added + b.updated, 0)
  const rolled = imports.filter(b => b.rolledBack).length
  const openConflicts = audit.filter(a => a.status === 'warn').length

  return (
    <div className="max-w-[1050px] mx-auto">
      <SectionHead kicker="Beyond the core · 5" title="Import & Sync History"
        sub="Every import is captured with a before/after diff — and can be rolled back with one click."
        right={<CsvButton filename="import-history.csv" rows={imports} headers={[
          { label: 'Source', get: r => r.source }, { label: 'When', get: r => r.ts },
          { label: 'Added', get: r => r.added }, { label: 'Updated', get: r => r.updated },
          { label: 'Skipped', get: r => r.skipped },
          { label: 'Rolled back', get: r => r.rolledBack ? 'yes' : 'no' },
        ]} />} />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Stat icon={FileUp} label="Import batches" value={imports.length} tone="#818cf8" />
        <Stat icon={CheckCircle2} label="Records touched" value={touched} tone="#34d399" />
        <Stat icon={RotateCcw} label="Rolled back" value={rolled} tone="#fbbf24" />
        <Stat icon={ShieldAlert} label="Open conflicts" value={openConflicts} tone="#fb7185" />
      </div>

      <div className="mb-4">
        <Seg value={tab} onChange={setTab} options={[{ value: 'imports', label: 'Import batches' }, { value: 'sync', label: 'Sync runs & conflicts' }]} />
      </div>

      {tab === 'imports' && (
        <div className="flex flex-col gap-3">
          {imports.length === 0 && <Card><Empty icon={FileUp} title="No imports yet">Run one from the Import page.</Empty></Card>}
          {imports.map(b => (
            <BatchCard key={b.id} batch={b} open={openBatch === b.id}
              onToggle={() => setOpenBatch(o => o === b.id ? null : b.id)}
              onRollback={() => setConfirm(b)} />
          ))}
        </div>
      )}

      {tab === 'sync' && <SyncRuns />}

      <RollbackModal batch={confirm} onClose={() => setConfirm(null)} />
    </div>
  )
}

function BatchCard({ batch: b, open, onToggle, onRollback }) {
  const { contactById } = useCrm()
  return (
    <Card className="overflow-hidden">
      <div role="button" tabIndex={0}
        className="w-full flex items-center gap-3 p-4 text-left flex-wrap hover:bg-white/[.02] transition-colors cursor-pointer select-none"
        onClick={onToggle} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}>
        <span className="w-9 h-9 rounded-xl grid place-items-center flex-none" style={{ background: '#818cf81c', color: '#818cf8' }}><FileUp size={16} /></span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[14px] truncate">{b.source}</div>
          <div className="text-[11.5px]" style={{ color: 'var(--faint)' }}>{tsRel(b.ts)}{b.details ? ` · ${b.details.length} records` : ' · legacy batch'}</div>
        </div>
        <div className="flex gap-1.5">
          <Pill color="#34d399">+{b.added}</Pill>
          <Pill color="#fbbf24">~{b.updated}</Pill>
          {b.skipped > 0 && <Pill color="#6b7382">={b.skipped}</Pill>}
        </div>
        {b.rolledBack
          ? <Pill color="#fbbf24"><RotateCcw size={11} /> Rolled back</Pill>
          : b.details && <button className="btn btn-ghost btn-sm flex-none" onClick={e => { e.stopPropagation(); onRollback() }}><RotateCcw size={12} /> Rollback</button>}
        <ChevronDown size={15} className="flex-none transition-transform" style={{ color: 'var(--faint)', transform: open ? 'rotate(180deg)' : 'none' }} />
      </div>

      {open && (
        <div className="border-t fadein" style={{ borderColor: 'rgba(255,255,255,.06)' }}>
          {!b.details && (
            <div className="p-4 text-[12.5px]" style={{ color: 'var(--muted)' }}>
              This batch predates the diff recorder — counts are known, but per-field diffs and rollback aren't available.
            </div>
          )}
          {b.details && b.details.map((d, i) => {
            const contact = contactById[d.contactId]
            return (
              <div key={i} className="flex items-start gap-3 px-4 py-3 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,.05)', opacity: b.rolledBack ? .5 : 1 }}>
                {contact ? <Avatar name={d.name} size={30} /> : <span className="w-[30px] h-[30px] rounded-full grid place-items-center flex-none text-[11px] font-bold" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--faint)' }}>?</span>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[13px]">{d.name}</span>
                    {STATUS[d.status].pill}
                    {!contact && d.status !== 'skipped' && <span className="text-[10.5px]" style={{ color: 'var(--faint)' }}>(not in contacts{ b.rolledBack ? ' anymore' : '' })</span>}
                  </div>
                  {d.changes.length > 0 && (
                    <div className="flex flex-col gap-1 mt-1.5">
                      {d.changes.map((ch, j) => (
                        <div key={j} className="flex items-center gap-2 text-[12px] flex-wrap font-mono">
                          <span className="chip flex-none" style={{ fontSize: 10 }}>{FIELD_LABEL[ch.field] || ch.field}</span>
                          {ch.field !== 'record' && (
                            <>
                              <span style={{ color: ch.from ? '#fb7185' : 'var(--faint)', textDecoration: ch.from ? 'line-through' : 'none' }}>{ch.from || 'empty'}</span>
                              <ArrowRight size={11} style={{ color: 'var(--faint)' }} />
                              <span style={{ color: '#34d399' }}>{ch.to}</span>
                            </>
                          )}
                          {ch.field === 'record' && <span style={{ color: '#34d399' }}>created as new contact</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {d.status === 'skipped' && <div className="text-[12px] mt-0.5" style={{ color: 'var(--faint)' }}>No changes — record matched existing data.</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function RollbackModal({ batch, onClose }) {
  const { rollbackImport } = useCrm()
  if (!batch) return null
  const dels = (batch.details || []).filter(d => d.status === 'added').length
  const reverts = (batch.details || []).filter(d => d.status === 'updated').length
  return (
    <Modal open onClose={onClose} title={`Rollback “${batch.source}”?`}>
      <p className="text-[13.5px] mb-2" style={{ color: 'var(--muted)' }}>This batch is reversed field-by-field:</p>
      <ul className="text-[13px] flex flex-col gap-1.5 mb-4" style={{ color: 'var(--muted)' }}>
        <li>• <strong style={{ color: '#fb7185' }}>{dels} contact(s)</strong> created by this import will be removed</li>
        <li>• <strong style={{ color: '#fbbf24' }}>{reverts} contact(s)</strong> will be restored to their pre-import values</li>
        <li>• Skipped records are untouched · the batch is marked rolled back</li>
      </ul>
      <p className="text-[12px] mb-5" style={{ color: 'var(--faint)' }}>Heads up: rollback overwrites any edits made to those fields after the import, and tasks/events linked to removed contacts become unlinked.</p>
      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={() => { rollbackImport(batch.id); onClose() }}><RotateCcw size={14} /> Rollback import</button>
      </div>
    </Modal>
  )
}

function SyncRuns() {
  const { audit, resolveAuditConflict } = useCrm()
  const runs = useMemo(() =>
    audit.filter(a => a.actor === 'rule' || a.action.toLowerCase().includes('conflict')),
    [audit])
  return (
    <Card className="p-4">
      {runs.length === 0 && <Empty icon={RefreshCw} title="No sync runs yet">Trigger one from Settings or the Dashboard sync center.</Empty>}
      {runs.map(a => (
        <div key={a.id} className="flex items-center gap-3 py-3 border-b last:border-0 flex-wrap" style={{ borderColor: 'rgba(255,255,255,.05)' }}>
          <span className="w-8 h-8 rounded-lg grid place-items-center flex-none"
            style={{ background: a.status === 'warn' ? '#fbbf241c' : '#34d3991c', color: a.status === 'warn' ? '#fbbf24' : '#34d399' }}>
            {a.status === 'warn' ? <AlertTriangle size={15} /> : <RefreshCw size={15} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[13px]">{a.action}</div>
            <div className="text-[12px] truncate" style={{ color: a.status === 'warn' ? '#fbbf24' : 'var(--muted)' }}>{a.entity}{a.detail ? ` — ${a.detail}` : ''}</div>
          </div>
          {a.status === 'warn' ? (
            <div className="flex gap-1.5 flex-none">
              <button className="btn btn-ghost btn-sm" onClick={() => resolveAuditConflict(a.id, 'local')}>Keep local</button>
              <button className="btn btn-ghost btn-sm" onClick={() => resolveAuditConflict(a.id, 'remote')}>Keep remote</button>
            </div>
          ) : <Pill color="#34d399">ok</Pill>}
          <span className="text-[11px] flex-none w-20 text-right" style={{ color: 'var(--faint)' }}>{tsRel(a.ts)}</span>
        </div>
      ))}
      <div className="text-[11px] mt-3" style={{ color: 'var(--faint)' }}>
        Conflicts surface whenever both sides of a two-way sync changed the same field — resolve them per your rule's conflict strategy, or override manually here.
      </div>
    </Card>
  )
}
