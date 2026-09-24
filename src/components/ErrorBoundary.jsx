import { Component } from 'react'
import { AlertOctagon, RefreshCw, Copy, Mail, History } from 'lucide-react'
import { useCrm } from '../store'
import { BRAND, COPYRIGHT } from '../brand'

/* ═════════════════════════════════════════════════════════════════════════════
 * Error boundary — the difference between "white screen" and "here is what
 * happened, here is your data back".
 *
 * A local-first app has no server to catch crashes, so the crash screen has to
 * do the job: explain, offer a way back (reload / roll back to a snapshot), and
 * offer a way to tell us (a pre-filled mail to BITSCOL — nothing is uploaded).
 * ═════════════════════════════════════════════════════════════════════════════ */

const ERR_KEY = 'pcrm-last-error'

export default class ErrorBoundary extends Component {
  state = { err: null, stack: null }

  static getDerivedStateFromError(err) {
    return { err, stack: err?.stack || null }
  }

  componentDidCatch(err, info) {
    const record = {
      message: String(err?.message || err),
      stack: String(err?.stack || '').slice(0, 2000),
      component: String(info?.componentStack || '').slice(0, 1000),
      at: new Date().toISOString(),
    }
    console.error('[Personal CRM] unhandled error', record)
    try { localStorage.setItem(ERR_KEY, JSON.stringify(record)) } catch {}
  }

  reset = () => this.setState({ err: null, stack: null })

  render() {
    if (!this.state.err) return this.props.children
    return <CrashScreen error={this.state.err} stack={this.state.stack} onRetry={this.reset} />
  }
}

function CrashScreen({ error, stack, onRetry }) {
  const crm = useCrm()
  const snaps = crm?.snapshots || []
  const newest = snaps[0]

  const details = [
    `App: ${BRAND.app} v${BRAND.version}`,
    `When: ${new Date().toISOString()}`,
    `Screen: ${location.hash || '/'}`,
    `Device: ${navigator.userAgent}`,
    '',
    `Error: ${String(error?.message || error)}`,
    '',
    '--- stack ---',
    String(stack || '').slice(0, 1500),
  ].join('\n')

  const mailto = `mailto:${BRAND.email}?subject=${encodeURIComponent(
    `[Personal CRM ${BRAND.version}] Crash report`)}&body=${encodeURIComponent(
    'What were you doing when this happened?\n\n\n--- diagnostics (safe to keep) ---\n' + details)}`

  const copy = async () => {
    try { await navigator.clipboard.writeText(details) } catch {}
  }

  return (
    <div className="min-h-screen grid place-items-center p-5" style={{ background: 'var(--bg)' }}>
      <div className="card w-full max-w-[560px] p-5 sm:p-6" style={{ borderRadius: 20 }}>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl grid place-items-center flex-none"
            style={{ background: 'rgba(251,113,133,.14)', color: 'var(--t-rose)' }}>
            <AlertOctagon size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[18px] font-extrabold">Something broke — your data is safe</h1>
            <p className="text-[13px] mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
              The screen hit an error it could not recover from. Nothing was sent anywhere and nothing was
              deleted. Reload usually fixes it; if it keeps happening, roll back to a snapshot below.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl p-3 font-mono text-[11.5px] whitespace-pre-wrap break-any"
          style={{ background: 'var(--cardbg2)', border: '1px solid var(--border)', maxHeight: 140, overflow: 'auto' }}>
          {String(error?.message || error)}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button className="btn btn-primary w-full sm:w-auto" onClick={() => location.reload()}>
            <RefreshCw size={14} /> Reload the app
          </button>
          <button className="btn btn-ghost w-full sm:w-auto" onClick={onRetry}>Try this screen again</button>
          <button className="btn btn-ghost w-full sm:w-auto" onClick={copy}><Copy size={13} /> Copy details</button>
          <a className="btn btn-ghost w-full sm:w-auto" href={mailto}><Mail size={13} /> Email support</a>
        </div>

        {newest && (
          <div className="mt-4 rounded-xl p-3.5" style={{ background: 'rgba(52,211,153,.08)', border: '1px solid rgba(52,211,153,.28)' }}>
            <div className="flex items-center gap-2 text-[13px] font-bold">
              <History size={14} style={{ color: 'var(--t-green)' }} /> Roll back to {new Date(newest.at).toLocaleString()}
            </div>
            <div className="text-[11.5px] mt-1" style={{ color: 'var(--muted)' }}>
              {snaps.length} local snapshot{snaps.length === 1 ? '' : 's'} kept · this restores the app to how it
              was at that moment.
            </div>
            <button
              className="btn btn-ghost btn-sm mt-2.5 w-full sm:w-auto"
              onClick={() => { if (confirm('Restore the snapshot from ' + new Date(newest.at).toLocaleString() + '? Current data will be replaced.')) crm.restoreSnapshotById(newest.id) }}>
              <History size={13} /> Restore this snapshot
            </button>
          </div>
        )}

        <details className="mt-4 text-[11.5px]" style={{ color: 'var(--faint)' }}>
          <summary className="cursor-pointer font-semibold">Technical details</summary>
          <pre className="mt-2 whitespace-pre-wrap break-any" style={{ fontSize: 10.5 }}>{details}</pre>
        </details>

        <div className="text-[11px] mt-5 text-center" style={{ color: 'var(--faint)' }}>
          {BRAND.publisher} · {BRAND.websiteLabel} · {BRAND.email} · {BRAND.mobileLabel}
          <div className="mt-0.5">{COPYRIGHT}</div>
        </div>
      </div>
    </div>
  )
}
