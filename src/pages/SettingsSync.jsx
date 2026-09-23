import { useState } from 'react'
import { RefreshCw, Plus, Trash2, ShieldCheck, Globe, Calendar, Play, RotateCcw, CheckCircle2, X, KeyRound, Users, HardDrive, CloudDownload, Upload, CloudUpload, Loader2, Lock, ShieldAlert, Copy, ClipboardCheck, ListChecks, ChevronDown, ExternalLink } from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Card, Modal, Field, Toggle, Pill, Empty } from '../components/ui'
import { tsRel } from '../lib'

const SOURCES = ['Google Contacts', 'Google Calendar', 'CardDAV (iCloud)', 'vCard file (.vcf)', 'Outlook (CSV)']
const DIRECTIONS = ['Import', 'Export', 'Two-way']
const FREQUENCIES = ['Every 15 min', 'Hourly', 'Daily', 'Weekly']
const DELIVERIES = ['Auto-apply changes', 'Review queue', 'Notify only']
const CONFLICTS = [
  { v: 'prefer-local', label: 'Prefer local — CRM wins' },
  { v: 'prefer-remote', label: 'Prefer remote — server wins' },
  { v: 'newest', label: 'Newest change wins' },
  { v: 'manual', label: 'Merge — manual review queue' },
]
const SOURCE_ICON = { 'Google Calendar': Calendar, 'CardDAV (iCloud)': Globe, 'Google Contacts': ShieldCheck }

const ACTOR_TONE = { user: '#38bdf8', system: '#94a3b8', rule: '#a78bfa' }

export default function SettingsSync() {
  return (
    <div className="max-w-[1100px] mx-auto">
      <SectionHead kicker="Roadmap #9" title="Settings & Sync"
        sub="Connections, sync rules with per-rule conflict strategy, and a full audit trail." />
      <IdentityCard />
      <GistSyncCard />
      <GoogleHub />
      <Connections />
      <RuleBuilder />
      <RulesTable />
      <AuditLog />
      <AppLockCard />
      <DangerZone />
    </div>
  )
}

/* ── Connections ── */
function Connections() {
  const { carddav, gcal, saveCarddav, testConnection, toast } = useCrm()
  const [f, setF] = useState({ server: '', username: '', password: '' })
  const [testing, setTesting] = useState(false)
  const configured = !!carddav

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: '#22d3ee1c', color: '#22d3ee' }}><Globe size={18} /></div>
            <div className="flex-1">
              <div className="font-bold text-[14.5px]">CardDAV server</div>
              <div className="text-[11.5px]" style={{ color: 'var(--faint)' }}>{configured ? `Configured · ${carddav.username}` : 'iCloud, Nextcloud, Fastmail…'}</div>
            </div>
            {configured && <Pill color="#34d399">Saved</Pill>}
          </div>
          <div className="flex flex-col gap-3">
            <Field label="Server URL"><input className="input" placeholder="https://contacts.icloud.com" value={f.server} onChange={e => setF(x => ({ ...x, server: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Username"><input className="input" placeholder="apple-id@…" value={f.username} onChange={e => setF(x => ({ ...x, username: e.target.value }))} /></Field>
              <Field label="App password"><input className="input" type="password" placeholder="••••••••" value={f.password} onChange={e => setF(x => ({ ...x, password: e.target.value }))} /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" disabled={testing || !f.server}
                onClick={async () => { setTesting(true); await testConnection(); setTesting(false) }}>
                {testing ? <RefreshCw size={13} className="spin" /> : <ShieldCheck size={13} />} Test connection
              </button>
              <button className="btn btn-primary btn-sm" disabled={!f.server || !f.username}
                onClick={() => { saveCarddav({ server: f.server, username: f.username }); setF({ server: '', username: '', password: '' }); toast('CardDAV credentials saved') }}>
                Save
              </button>
            </div>
          </div>
        </Card>

        <Card className="p-5 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: '#34d3991c', color: '#34d399' }}><Users size={18} /></div>
            <div className="flex-1">
              <div className="font-bold text-[14.5px]">Google Workspace</div>
              <div className="text-[11.5px]" style={{ color: 'var(--faint)' }}>
                {gcal.connected ? `Calendar ${gcal.mode === 'live' ? 'LIVE' : 'connected'} · synced ${gcal.lastSync ? tsRel(gcal.lastSync) : 'never'}` : 'Calendar · People · Drive backup'}
              </div>
            </div>
            {gcal.connected ? <Pill color="#34d399">On</Pill> : <Pill color="#fbbf24">Off</Pill>}
          </div>
          <p className="text-[12.5px] mb-4" style={{ color: 'var(--muted)' }}>
            Calendar sync, People (contacts) import and Drive backups live in the Google Workspace hub above — with live OAuth when you add your own Client ID.
          </p>
          <div className="flex justify-end mt-auto">
            <button className="btn btn-ghost btn-sm" onClick={() => document.getElementById('google-hub')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Open Google hub ↑
            </button>
          </div>
        </Card>
      </div>

    </>
  )
}

/* ── Rule builder ── */
function RuleBuilder() {
  const { addRule, groups, tags, toast } = useCrm()
  const [f, setF] = useState({ name: '', source: SOURCES[0], direction: 'Import', frequency: 'Daily', scope: 'all', scopeGroups: [], scopeTags: [], delivery: 'Auto-apply changes', conflict: 'prefer-local' })
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const toggleIn = (k, id) => set(k, f[k].includes(id) ? f[k].filter(x => x !== id) : [...f[k], id])

  return (
    <Card className="p-5 mt-4">
      <h3 className="font-bold text-[14.5px] mb-4">Sync rule builder</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Rule name *"><input className="input" placeholder="e.g. Weekly lead sync" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="Source">
          <select className="input" value={f.source} onChange={e => set('source', e.target.value)}>{SOURCES.map(s => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="Direction">
          <select className="input" value={f.direction} onChange={e => set('direction', e.target.value)}>{DIRECTIONS.map(s => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="Frequency">
          <select className="input" value={f.frequency} onChange={e => set('frequency', e.target.value)}>{FREQUENCIES.map(s => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="Delivery">
          <select className="input" value={f.delivery} onChange={e => set('delivery', e.target.value)}>{DELIVERIES.map(s => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="Conflict strategy" hint="How clashes resolve when both sides changed">
          <select className="input" value={f.conflict} onChange={e => set('conflict', e.target.value)}>{CONFLICTS.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}</select>
        </Field>
        <div className="lg:col-span-2">
          <div className="label">Scope</div>
          <div className="flex gap-1.5 flex-wrap items-center">
            <button className={`chip chip-btn ${f.scope === 'all' ? 'on' : ''}`} onClick={() => set('scope', 'all')}>Everything</button>
            <button className={`chip chip-btn ${f.scope === 'selected' ? 'on' : ''}`} onClick={() => set('scope', 'selected')}>Only selected…</button>
            {f.scope === 'selected' && (
              <>
                {groups.map(g => (
                  <button key={g.id} className={`chip chip-btn ${f.scopeGroups.includes(g.id) ? 'on' : ''}`} onClick={() => toggleIn('scopeGroups', g.id)}>◦ {g.name}</button>
                ))}
                {tags.map(t => (
                  <button key={t.id} className={`chip chip-btn ${f.scopeTags.includes(t.id) ? 'on' : ''}`} onClick={() => toggleIn('scopeTags', t.id)}>{t.icon} {t.name}</button>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <button className="btn btn-primary" disabled={!f.name.trim()}
          onClick={() => { addRule(f); setF(x => ({ ...x, name: '', scopeGroups: [], scopeTags: [] })); toast('Sync rule created — it starts on the next cycle') }}>
          <Plus size={14} /> Add rule
        </button>
      </div>
    </Card>
  )
}

/* ── Rules table ── */
function RulesTable() {
  const { rules, groups, tags, toggleRule, updateRule, deleteRule, runRuleNow } = useCrm()
  const [running, setRunning] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const scopeText = r => {
    if (r.scope === 'all') return 'Everything'
    const bits = [
      ...r.scopeGroups.map(id => groups.find(g => g.id === id)?.name).filter(Boolean),
      ...r.scopeTags.map(id => { const t = tags.find(x => x.id === id); return t ? `${t.icon} ${t.name}` : null }).filter(Boolean),
    ]
    return bits.length ? bits.join(', ') : 'Nothing selected'
  }

  return (
    <Card className="p-5 mt-4">
      <h3 className="font-bold text-[14.5px] mb-2">Active rules</h3>
      {rules.length === 0 && <Empty icon={RefreshCw} title="No rules yet">Build one above.</Empty>}
      {rules.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table min-w-[820px]">
            <thead><tr><th></th><th>Rule</th><th>Direction</th><th>Scope</th><th>Conflict strategy</th><th>Last run</th><th></th></tr></thead>
            <tbody>
              {rules.map(r => {
                const Icon = SOURCE_ICON[r.source] || ShieldCheck
                return (
                  <tr key={r.id} style={{ opacity: r.enabled ? 1 : .55 }}>
                    <td><Toggle on={r.enabled} onChange={() => toggleRule(r.id)} /></td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Icon size={15} className="flex-none" style={{ color: 'var(--i2)' }} />
                        <div>
                          <div className="font-semibold text-[13px]">{r.name}</div>
                          <div className="text-[11px]" style={{ color: 'var(--faint)' }}>{r.source} · {r.frequency} · {r.delivery}</div>
                        </div>
                      </div>
                    </td>
                    <td><Pill color={r.direction === 'Two-way' ? '#a78bfa' : r.direction === 'Import' ? '#38bdf8' : '#fbbf24'}>{r.direction}</Pill></td>
                    <td><span className="text-[11.5px] block max-w-[180px] truncate" style={{ color: 'var(--muted)' }} title={scopeText(r)}>{scopeText(r)}</span></td>
                    <td>
                      <select className="input" style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }} value={r.conflict}
                        onChange={e => updateRule(r.id, { conflict: e.target.value })}>
                        {CONFLICTS.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
                      </select>
                    </td>
                    <td><span className="text-[11.5px] whitespace-nowrap" style={{ color: 'var(--faint)' }}>{r.lastRun ? tsRel(r.lastRun) : 'never'}</span></td>
                    <td>
                      <div className="flex gap-1.5 justify-end">
                        <button className="icon-btn" style={{ width: 28, height: 28 }} title="Run now"
                          onClick={async () => { setRunning(r.id); await new Promise(res => setTimeout(res, 900)); runRuleNow(r.id); setRunning(null) }}>
                          {running === r.id ? <RefreshCw size={13} className="spin" /> : <Play size={13} />}
                        </button>
                        {confirmDel === r.id
                          ? <button className="btn btn-danger btn-sm" onClick={() => { deleteRule(r.id); setConfirmDel(null) }}>Sure?</button>
                          : <button className="icon-btn" style={{ width: 28, height: 28 }} title="Delete rule" onClick={() => { setConfirmDel(r.id); setTimeout(() => setConfirmDel(c => c === r.id ? null : c), 2500) }}><Trash2 size={13} /></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/* ── Audit log ── */
function AuditLog() {
  const { audit } = useCrm()
  const [filter, setFilter] = useState('all')
  const list = audit.filter(a => filter === 'all' || a.actor === filter).slice(0, 30)
  return (
    <Card className="p-5 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-bold text-[14.5px]">Audit log</h3>
        <div className="flex gap-1.5">
          {['all', 'user', 'system', 'rule'].map(a => (
            <button key={a} className={`chip chip-btn ${filter === a ? 'on' : ''}`} onClick={() => setFilter(a)}>
              {a === 'all' ? 'All' : a.charAt(0).toUpperCase() + a.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col">
        {list.map(a => (
          <div key={a.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-[12.5px]" style={{ borderColor: 'rgba(255,255,255,.05)' }}>
            <span className="chip flex-none" style={{ background: ACTOR_TONE[a.actor] + '16', color: ACTOR_TONE[a.actor], borderColor: ACTOR_TONE[a.actor] + '35' }}>{a.actor}</span>
            <span className="font-semibold flex-none">{a.action}</span>
            <span className="truncate" style={{ color: a.status === 'warn' ? '#fbbf24' : 'var(--muted)' }}>
              {a.entity}{a.detail ? ` — ${a.detail}` : ''}
            </span>
            <span className="ml-auto flex-none text-[11px]" style={{ color: 'var(--faint)' }}>{tsRel(a.ts)}</span>
          </div>
        ))}
      </div>
      <div className="text-[11px] mt-2" style={{ color: 'var(--faint)' }}>Showing latest {list.length} of {audit.length} entries · everything you do in the app lands here</div>
    </Card>
  )
}

function DangerZone() {
  const { resetAll } = useCrm()
  return (
    <Card className="p-5 mt-4 mb-2 flex items-center justify-between flex-wrap gap-3">
      <div>
        <div className="font-bold text-[13.5px]">Reset to sample dataset</div>
        <div className="text-[12px]" style={{ color: 'var(--muted)' }}>Restore all contacts, tasks, events and settings to the original sample set.</div>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm('Reset everything to the sample dataset?')) resetAll() }}>
        <RotateCcw size={13} /> Reset
      </button>
    </Card>
  )
}


/* ── Google Workspace hub (live OAuth with your own Client ID) ── */
function GoogleHub() {
  const {
    gcal, googleClientId, googleMode, saveGoogleClientId, connectGoogleLive, disconnectGoogle, syncing, syncState, syncReport, syncNow, setSyncEnabled, gist, saveGistToken, syncProvider,
    syncGoogleCalendar, syncGoogleContacts, driveState, driveBackupNow, driveRestoreNow, restoreAll, toast,
  } = useCrm()
  const [cid, setCid] = useState(googleClientId || '')
  const [busy, setBusy] = useState('')
  const fileRef = { current: null }
  const live = googleMode === 'live'
  const run = (key, fn) => async () => { setBusy(key); try { await fn() } finally { setBusy('') } }

  const Service = ({ icon: Icon, color, title, status, children }) => (
    <div className="card p-4 flex flex-col gap-3" style={{ borderRadius: 16 }}>
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl grid place-items-center flex-none" style={{ background: color + '1c', color }}><Icon size={17} /></div>
        <div className="min-w-0">
          <div className="font-bold text-[13.5px] truncate">{title}</div>
          <div className="text-[11px] truncate" style={{ color: 'var(--faint)' }}>{status}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-auto">{children}</div>
    </div>
  )
  const Btn = ({ k, className = 'btn btn-ghost btn-sm', onClick, children, disabled }) => (
    <button className={className} disabled={disabled || !!busy} onClick={onClick}>
      {busy === k ? <Loader2 size={13} className="animate-spin" /> : children}
    </button>
  )

  return (
    <Card className="p-5 mb-4" id="google-hub">
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: 'linear-gradient(120deg,#818cf822,#38bdf822)', color: 'var(--i2)' }}>
          <CloudDownload size={19} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px]">Google Workspace</div>
          <div className="text-[11.5px]" style={{ color: 'var(--faint)' }}>Calendar sync · People import · Drive backup — one OAuth connection, in-browser only</div>
        </div>
        <Pill color={live ? '#34d399' : '#94a3b8'}>{live ? 'LIVE MODE' : 'SETUP NEEDED'}</Pill>
      </div>

      {/* client id config */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-5">
        <div className="flex-1">
          <Field label="Google OAuth Client ID" hint={live ? 'Live mode enabled — tokens are requested in-browser and never stored.' : 'Optional — create a Web OAuth client at console.cloud.google.com and add this origin'}>
            <div className="flex gap-2">
              <input className="input" style={{ fontFamily: 'monospace', fontSize: 12 }} placeholder="xxxxx.apps.googleusercontent.com"
                value={cid} onChange={e => setCid(e.target.value)} />
            </div>
          </Field>
        </div>
        <div className="flex gap-2 pb-0.5">
          <button className="btn btn-primary btn-sm" disabled={cid.trim() === googleClientId} onClick={() => saveGoogleClientId(cid)}>
            <KeyRound size={13} /> {live ? 'Update ID' : 'Enable live mode'}
          </button>
          {live && <button className="btn btn-ghost btn-sm" onClick={() => { setCid(''); saveGoogleClientId(''); disconnectGoogle() }}>Clear</button>}
        </div>
      </div>

      {!live && <GoogleSetupGuide toast={toast} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Service icon={Calendar} color="#38bdf8" title="Google Calendar"
          status={gcal.connected ? `connected (${gcal.mode || 'live'}) · ${gcal.lastSync ? 'synced ' + tsRel(gcal.lastSync) : 'never synced'}` : 'import events ±30/60 days'}>
          {live && <Btn k="cal" className="btn btn-primary btn-sm" onClick={run('cal', connectGoogleLive)}>Connect</Btn>}
          <Btn k="calsync" className="btn btn-primary btn-sm" onClick={run('calsync', syncGoogleCalendar)}><RefreshCw size={13} /> Sync events</Btn>
          {gcal.connected && <Btn k="caldisc" onClick={run('caldisc', disconnectGoogle)}><X size={13} /> Disconnect</Btn>}
        </Service>

        <Service icon={Users} color="#a78bfa" title="Google Contacts (People)"
          status={driveState.lastContactsSync ? `last sync ${tsRel(driveState.lastContactsSync)}` : 'import dedupes & diffs via the pipeline'}>
          <Btn k="people" className="btn btn-primary btn-sm" onClick={run('people', syncGoogleContacts)}><RefreshCw size={13} /> Sync contacts</Btn>
        </Service>

        <Service icon={HardDrive} color="#34d399" title="Drive backup"
          status={driveState.lastBackup ? `backed up ${tsRel(driveState.lastBackup)}` : 'personal-crm-backup.json · drive.file scope only'}>
          <Btn k="backup" className="btn btn-primary btn-sm" onClick={run('backup', driveBackupNow)}><Upload size={13} /> Back up now</Btn>
          {live
            ? <Btn k="restore" onClick={run('restore', driveRestoreNow)}><CloudDownload size={13} /> Restore from Drive</Btn>
            : <>
                <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                  <CloudDownload size={13} /> Restore from file
                  <input type="file" accept=".json,application/json" className="hidden" onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return
                    const r = new FileReader()
                    r.onload = () => { try { restoreAll(JSON.parse(r.result)) } catch { toast('Could not parse that backup file', 'warn') } }
                    r.readAsText(f); e.target.value = ''
                  }} />
                </label>
              </>}
        </Service>

        <Service icon={CloudUpload} color="#f472b6" title="Multi-device sync"
          status={syncState.enabled
            ? (syncState.lastSyncAt ? `rev ${syncState.lastRev} · synced ${tsRel(syncState.lastSyncAt)} · via ${syncProvider()}` : 'on — press Sync now')
            : 'off'}>
          <Toggle on={syncState.enabled} onChange={setSyncEnabled} disabled={!live} />
          <Btn k="syncdev" className="btn btn-primary btn-sm" disabled={syncProvider() === 'none' || !syncState.enabled}
            onClick={run('syncdev', () => syncNow({ manual: true }))}>
            {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sync now
          </Btn>
          {syncReport?.conflicts > 0 && (
            <span className="chip" style={{ color: '#fbbf24', borderColor: '#fbbf2444', background: '#fbbf2414' }}
              title="Same record was edited on two devices since the last sync — newest device copy won">
              {syncReport.conflicts} conflict{syncReport.conflicts > 1 ? 's' : ''} auto-resolved
            </span>
          )}
        </Service>
      </div>

      <p className="text-[11px] mt-3" style={{ color: 'var(--faint)' }}>
        Multi-device sync keeps <b style={{ color: 'var(--text)' }}>contacts · tasks · events · notes · tags · groups · rules · emails</b> aligned
        between this app on every device (phone APK, installed PWA, browser tab) through one <b style={{ color: 'var(--text)' }}>personal-crm-sync.json</b> in your Drive —
        three-way merged, so edits and deletes never clobber each other. Auto-syncs every minute and whenever the app regains focus.
        Manual <b style={{ color: 'var(--text)' }}>Drive backup</b> above stays a separate, full archive.
      </p>

      <p className="text-[11px] mt-4 flex items-center gap-1.5" style={{ color: 'var(--faint)' }}>
        <ShieldCheck size={12} /> In-browser OAuth (Google Identity Services). Tokens live only in memory for the session; the Drive scope can only touch files this app created.
      </p>
    </Card>
  )
}

/* ── guided live-mode setup (no account on our side — Google requires YOUR project) ── */
function GoogleSetupGuide({ toast }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const [open, setOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const copyOrigin = async () => {
    try { await navigator.clipboard.writeText(origin); setCopied(true); setTimeout(() => setCopied(false), 1600) }
    catch { toast('Select and copy the URL manually', 'warn') }
  }
  const Step = ({ n, children }) => (
    <div className="flex gap-3 items-start">
      <span className="w-5 h-5 rounded-full grid place-items-center flex-none text-[10.5px] font-extrabold mt-[1px]"
        style={{ background: 'var(--i2)22', color: 'var(--i2)' }}>{n}</span>
      <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>{children}</div>
    </div>
  )
  const L = ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold underline underline-offset-2" style={{ color: 'var(--i2)' }}>
      {children}<ExternalLink size={11} />
    </a>
  )
  return (
    <div className="card mb-5 overflow-hidden" style={{ borderRadius: 16, borderStyle: 'dashed' }}>
      <button className="w-full flex items-center gap-2.5 p-4 text-left" onClick={() => setOpen(o => !o)}>
        <ListChecks size={16} style={{ color: 'var(--i2)' }} />
        <span className="font-bold text-[13.5px]">Go live in ~5 minutes — step-by-step guide</span>
        <span className="ml-auto text-[11px] font-semibold" style={{ color: 'var(--faint)' }}>{open ? 'hide' : 'show'}</span>
        <ChevronDown size={14} style={{ color: 'var(--faint)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t pt-4 fadein" style={{ borderColor: 'rgba(255,255,255,.06)' }}>
          <Step n={1}>Open <L href="https://console.cloud.google.com/projectcreate">Google Cloud Console</L> and create a new project (any name, e.g. "Personal CRM").</Step>
          <Step n={2}>Go to <L href="https://console.cloud.google.com/apis/library">APIs & Services → Library</L> and enable all four:<br />
            <b style={{ color: 'var(--text)' }}>Google Calendar API · People API · Google Drive API · Gmail API</b></Step>
          <Step n={3}>Open the <L href="https://console.cloud.google.com/apis/credentials/consent">OAuth consent screen</L> → <b style={{ color: 'var(--text)' }}>External</b> → fill app name + your email → Save. Keep it in <b style={{ color: 'var(--text)' }}>Testing</b> status. Then under <b style={{ color: 'var(--text)' }}>Test users</b>, add your own Gmail address (required by Google, otherwise sign-in is refused).</Step>
          <Step n={4}>Go to <L href="https://console.cloud.google.com/apis/credentials">Credentials → Create Credentials → OAuth client ID</L> → type <b style={{ color: 'var(--text)' }}>Web application</b>. Under <b style={{ color: 'var(--text)' }}>Authorized JavaScript origins</b>, add exactly this URL:
            <div className="flex items-center gap-2 mt-2 p-2 rounded-lg" style={{ background: 'var(--cardbg2)', fontFamily: 'monospace', fontSize: 12 }}>
              <span className="truncate flex-1" style={{ color: 'var(--text)' }}>{origin}</span>
              <button className="btn btn-ghost btn-sm flex-none" onClick={copyOrigin}>
                {copied ? <ClipboardCheck size={13} style={{ color: '#34d399' }} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </Step>
          <Step n={5}>Copy the resulting <b style={{ color: 'var(--text)' }}>xxxxx.apps.googleusercontent.com</b> ID, paste it in the field above, press <b style={{ color: 'var(--text)' }}>Enable live mode</b> → Connect. Google will show an “app isn't verified” screen — that's normal for Testing apps: click <b style={{ color: 'var(--text)' }}>Advanced → Continue to Personal CRM</b>.</Step>
          <p className="text-[11px] pl-8" style={{ color: 'var(--faint)' }}>
            Why so many steps? Google only issues credentials from a project <i>you</i> own — there is no legitimate way for an app to ship with its own. You do this once; every sign-in afterwards takes seconds.
          </p>
        </div>
      )}
    </div>
  )
}

/* ── GitHub Gist sync: the no-Google way (same engine, one PAT with gist scope) ── */
function GistSyncCard() {
  const { gist, saveGistToken, syncNow, syncState, syncProvider, syncing, toast } = useCrm()
  const [tok, setTok] = useState(gist.token || '')
  const [testing, setTesting] = useState(false)
  const active = syncProvider() === 'gist'
  return (
    <Card className="p-5 mb-4">
      <div className="flex items-center gap-3 flex-wrap mb-1">
        <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: '#f472b61c', color: '#f472b6' }}>
          <CloudUpload size={19} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px]">Multi-device sync via GitHub Gist <span className="text-[10.5px] font-bold uppercase tracking-wide ml-1" style={{ color: '#f472b6' }}>no Google needed</span></div>
          <div className="text-[11.5px]" style={{ color: 'var(--faint)' }}>
            The simplest way: one token keeps your phone app, installed PWA and browser tabs in sync through a PRIVATE secret gist on your own GitHub account.
          </div>
        </div>
        <Pill color={active ? '#34d399' : '#94a3b8'}>{active ? 'ACTIVE BACKEND' : gist.token ? 'SAVED — inactive' : 'NOT SET UP'}</Pill>
      </div>

      <ol className="text-[12.5px] leading-relaxed list-decimal pl-5 mb-3 mt-2" style={{ color: 'var(--muted)' }}>
        <li className="text-[12.5px] leading-relaxed">Open <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2" style={{ color: 'var(--i2)' }}>github.com → Settings → Developer settings → Tokens (classic) → Generate new token</a></li>
        <li className="text-[12.5px] leading-relaxed">Note: <b style={{ color: 'var(--text)' }}>personal-crm-sync</b> · any expiration · tick ONLY the <b style={{ color: 'var(--text)' }}>gist</b> scope</li>
        <li className="text-[12.5px] leading-relaxed">Generate, copy the <code className="px-1 rounded" style={{ background: 'var(--cardbg2)', color: 'var(--text)' }}>ghp_…</code> token, paste below — done.</li>
      </ol>

      <div className="flex flex-col sm:flex-row gap-2">
        <input className="input flex-1" type="password" autoComplete="off" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          style={{ fontFamily: 'monospace', fontSize: 12 }} value={tok}
          onChange={e => setTok(e.target.value)} />
        <button className="btn btn-primary btn-sm" disabled={testing || (!tok.trim() && !gist.token) || tok.trim() === (gist.token || '')}
          onClick={async () => { setTesting(true); await saveGistToken(tok); setTesting(false) }}>
          {testing ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} {gist.token ? 'Update token' : 'Save & connect'}
        </button>
        {gist.token && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setTok(''); saveGistToken('') }}>
            <X size={13} /> Clear
          </button>
        )}
        {active && (
          <button className="btn btn-ghost btn-sm" disabled={syncing} onClick={() => syncNow({ manual: true })}>
            {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sync now
          </button>
        )}
      </div>

      {active && syncState.lastSyncAt && (
        <div className="text-[11.5px] mt-2" style={{ color: 'var(--faint)' }}>
          Synced {tsRel(syncState.lastSyncAt)} · revision {syncState.lastRev} · gist {String(gist.gistId || '…').slice(0, 8)}
        </div>
      )}

      <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: 'var(--faint)' }}>
        <ShieldCheck size={12} className="mt-[1px] flex-none" />
        <span>The token sits only in this browser's localStorage (like everything else in this app) and it can see ONLY gists, nothing else.
        Revoke it any time at github.com/settings/tokens. Use the SAME token on every device you want to sync.
        ⚠️ Pick ONE sync backend on all devices — Gist here, or Drive in the Google hub below.</span>
      </p>
    </Card>
  )
}

import IdentityCard from './settings/IdentityCard'

/* ── App lock (pincode) + local download/restore + PIN-confirmed blank reset ── */
function AppLockCard() {
  const { lock, setupPin, changePin, removePin, factoryReset, buildBackup, restoreAll, toast, lockNow } = useCrm()
  const [modal, setModal] = useState('')      // 'set' | 'change' | 'remove' | 'wipe'
  const [a, setA] = useState('')              // first/new pin
  const [b, setB] = useState('')              // confirm new pin
  const [oldPin, setOldPin] = useState('')    // current pin
  const [busy, setBusy] = useState(false)
  const fileRef = { current: null }
  const close = () => { setModal(''); setA(''); setB(''); setOldPin('') }
  const hasPin = !!lock?.hash
  const valid = a.length >= 4 && b.length >= 4

  const download = () => {
    const json = buildBackup()
    const el = document.createElement('a')
    el.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    el.download = `personal-crm-data-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(el); el.click(); el.remove()
    toast('⬇️ Full data downloaded as JSON — keep it somewhere safe')
  }

  const restoreFile = f => {
    const r = new FileReader()
    r.onload = () => { try { restoreAll(JSON.parse(r.result)) } catch { toast('Could not parse that backup file', 'warn') } }
    r.readAsText(f)
  }

  const okSet = async () => {
    if (a !== b) return toast('The two pincodes do not match', 'warn')
    setBusy(true); await setupPin(a); setBusy(false); close()
  }
  const okChange = async () => {
    if (a !== b) return toast('The two pincodes do not match', 'warn')
    setBusy(true)
    const okPin = await changePin(oldPin, a)
    setBusy(false)
    if (!okPin) return toast('Current pincode is wrong', 'warn')
    close()
  }
  const okRemove = async () => {
    setBusy(true)
    const okPin = await removePin(oldPin)
    setBusy(false)
    if (!okPin) return toast('Pincode is wrong', 'warn')
    close()
  }
  const okWipe = async () => {
    setBusy(true)
    const okPin = await factoryReset(oldPin)   // reloads the app on success
    setBusy(false)
    if (!okPin) toast('Pincode is wrong', 'warn')
  }

  const PinRow = ({ v, set, ph }) => (
    <input className="input" type="password" inputMode="numeric" maxLength={6} autoComplete="off"
      style={{ letterSpacing: 6, fontFamily: 'monospace' }} placeholder={ph || '••••'}
      value={v} onChange={e => set(e.target.value.replace(/\D/g, ''))} />
  )

  return (
    <Card className="p-5 mt-4">
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: hasPin ? '#34d3991c' : '#94a3b81c', color: hasPin ? '#34d399' : '#94a3b8' }}>
          <Lock size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px]">App lock (pincode)</div>
          <div className="text-[11.5px]" style={{ color: 'var(--faint)' }}>
            {hasPin ? 'On — pincode required at every start and after 15 min in the background. Sessions exist only in memory.' : 'Off — your app opens straight away.'}
          </div>
        </div>
        <Pill color={hasPin ? '#34d399' : '#94a3b8'}>{hasPin ? 'LOCKED ON START' : 'NOT SET'}</Pill>
      </div>

      <div className="flex flex-wrap gap-2">
        {hasPin ? (
          <>
            <button className="btn btn-primary btn-sm" onClick={() => setModal('change')}><KeyRound size={13} /> Change pincode</button>
            <button className="btn btn-ghost btn-sm" onClick={lockNow}><Lock size={13} /> Lock now</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setModal('remove')}><X size={13} /> Remove lock</button>
          </>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={() => setModal('set')}><ShieldCheck size={13} /> Set pincode</button>
        )}
      </div>

      <div className="mt-4 pt-4 flex flex-wrap items-center gap-2" style={{ borderTop: '1px dashed var(--border)' }}>
        <div className="text-[12.5px] font-extrabold w-full mb-1">Local data (no account needed)</div>
        <button className="btn btn-primary btn-sm" onClick={download}><CloudDownload size={13} /> Download all data (.json)</button>
        <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
          <Upload size={13} /> Restore from a data file…
          <input ref={el => { fileRef.current = el }} type="file" accept=".json,application/json" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) restoreFile(f); e.target.value = '' }} />
        </label>
        <span className="text-[10.5px]" style={{ color: 'var(--faint)' }}>Same format as Drive backup. Works fully offline.</span>
      </div>

      <div className="mt-4 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2"
        style={{ background: '#f8717110', border: '1px solid #f8717130' }}>
        <div>
          <div className="text-[13px] font-extrabold flex items-center gap-1.5" style={{ color: '#f87171' }}>
            <ShieldAlert size={14} /> Reset everything to blank
          </div>
          <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
            Erases ALL data, settings, sync tokens and the pincode itself from this app.{hasPin ? ' Requires your pincode.' : ''} Download a copy first.
          </div>
        </div>
        <button className="btn btn-danger btn-sm" onClick={() => setModal('wipe')}>Wipe everything…</button>
      </div>

      {/* modals */}
      <Modal open={modal === 'set' || modal === 'change'} onClose={close} title={modal === 'set' ? 'Set a pincode' : 'Change pincode'}>
        <div className="flex flex-col gap-3">
          {modal === 'change' && (
            <div>
              <div className="text-[11.5px] font-semibold mb-1" style={{ color: 'var(--faint)' }}>Current pincode</div>
              <PinRow v={oldPin} set={setOldPin} />
            </div>
          )}
          <div>
            <div className="text-[11.5px] font-semibold mb-1" style={{ color: 'var(--faint)' }}>{modal === 'set' ? 'Choose pincode' : 'New pincode'}</div>
            <PinRow v={a} set={setA} />
          </div>
          <div>
            <div className="text-[11.5px] font-semibold mb-1" style={{ color: 'var(--faint)' }}>Repeat pincode</div>
            <PinRow v={b} set={setB} />
          </div>
          <div className="flex justify-end gap-2 mt-1">
            <button className="btn btn-ghost btn-sm" onClick={close}>Cancel</button>
            <button className="btn btn-primary btn-sm" disabled={!valid || busy || (modal === 'change' && !oldPin)} onClick={modal === 'set' ? okSet : okChange}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Confirm
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'remove'} onClose={close} title="Remove app lock">
        <div className="flex flex-col gap-3">
          <div className="text-[12.5px]" style={{ color: 'var(--muted)' }}>The app will open without a pincode. Enter the current pincode to confirm.</div>
          <PinRow v={oldPin} set={setOldPin} />
          <div className="flex justify-end gap-2 mt-1">
            <button className="btn btn-ghost btn-sm" onClick={close}>Cancel</button>
            <button className="btn btn-primary btn-sm" disabled={!oldPin || busy} onClick={okRemove}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : 'Remove lock'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'wipe'} onClose={close} title="Reset everything to blank">
        <div className="flex flex-col gap-3">
          <div className="text-[12.5px] leading-relaxed" style={{ color: '#f87171' }}>
            <b>This deletes everything</b> — all contacts, tasks, notes, events, tags, groups, sync tokens (GitHub/Google), and the pincode.
            The app restarts to first-launch with an empty CRM. There is no undo.
          </div>
          {hasPin && (
            <div>
              <div className="text-[11.5px] font-semibold mb-1" style={{ color: 'var(--faint)' }}>Confirm with your pincode</div>
              <PinRow v={oldPin} set={setOldPin} />
            </div>
          )}
          <div className="flex justify-end gap-2 mt-1">
            <button className="btn btn-ghost btn-sm" onClick={close}>Cancel</button>
            <button className="btn btn-danger btn-sm" disabled={(hasPin && !oldPin) || busy} onClick={okWipe}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Wipe everything
            </button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
