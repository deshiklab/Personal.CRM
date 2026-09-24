import { useState } from 'react'
import { History, Camera, Download, Trash2, ShieldAlert, Info } from 'lucide-react'
import { useCrm } from '../../store'
import { Card, Pill } from '../../components/ui'
import { SNAPSHOT_LIMITS } from '../../lib/snapshots'
import { getBackend } from '../../lib/storage'
import { tsRel } from '../../lib'

/* ═════════════════════════════════════════════════════════════════════════════
 * Safety net — rolling snapshots of everything, kept on this device.
 *
 * Local-first means there is no server to roll back to, so the app keeps its
 * own history: an automatic copy after every burst of edits, one on start-up
 * when the newest is getting old, and a manual one whenever you want a marker
 * before doing something risky.
 * ═════════════════════════════════════════════════════════════════════════════ */

const kb = b => (b >= 1024 * 1024 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

export default function SafetyNetCard() {
  const {
    snapshots, takeSnapshotNow, restoreSnapshotById, deleteSnapshotById, downloadSnapshot,
    pinStatus, toast,
  } = useCrm()
  const [confirming, setConfirming] = useState(null)
  const pin = pinStatus ? pinStatus() : { fails: 0, locked: false }

  const total = snapshots.reduce((n, s) => n + (s.bytes || 0), 0)

  return (
    <Card className="p-5 mt-4">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl grid place-items-center flex-none"
          style={{ background: 'rgba(52,211,153,.12)', color: 'var(--t-green)' }}>
          <History size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px] flex items-center gap-2 flex-wrap">
            Safety net
            <Pill color="#34d399">{snapshots.length} snapshot{snapshots.length === 1 ? '' : 's'} · {kb(total)}</Pill>
            {pin.fails > 0 && <Pill color="#fb7185">{pin.fails} failed pin attempt{pin.fails === 1 ? '' : 's'}</Pill>}
          </div>
          <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--faint)' }}>
            Automatic local copies of everything — kept on this device, never uploaded. The app keeps the
            last {SNAPSHOT_LIMITS.MAX_COUNT} and drops the oldest when it runs out of room.
            {' '}Storage: <b style={{ color: 'var(--text)' }}>{getBackend() === 'native' ? 'Android Preferences (survives app updates)' : 'this browser’s local storage'}</b>.
          </div>
        </div>
        <button className="btn btn-primary btn-sm w-full sm:w-auto justify-center"
          onClick={() => { takeSnapshotNow('manual'); toast?.('Snapshot saved — you can roll back to it any time') }}>
          <Camera size={13} /> Take snapshot now
        </button>
      </div>

      {pin.locked && (
        <div className="mt-3 flex items-start gap-2 rounded-xl p-3"
          style={{ background: 'rgba(251,113,133,.10)', border: '1px solid rgba(251,113,133,.3)' }}>
          <ShieldAlert size={15} className="flex-none mt-0.5" style={{ color: 'var(--t-rose)' }} />
          <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
            The app lock is paused after too many wrong pincodes. It clears itself — waiting gets longer
            with each wrong guess.
          </div>
        </div>
      )}

      {snapshots.length === 0 ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl p-3"
          style={{ background: 'var(--cardbg2)', border: '1px solid var(--border)' }}>
          <Info size={14} className="flex-none mt-0.5" style={{ color: 'var(--faint)' }} />
          <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
            No snapshots yet — the first one appears shortly after you start editing.
          </div>
        </div>
      ) : (
        <div className="mt-4">
          {snapshots.map((s, i) => (
            <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-2.5 border-b last:border-0"
              style={{ borderColor: 'var(--hairline)' }}>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold flex items-center gap-2 flex-wrap">
                  {new Date(s.at).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  <Pill color="#818cf8">{s.label}</Pill>
                  {i === 0 && <Pill color="#34d399">newest</Pill>}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--faint)' }}>
                  {kb(s.bytes)} · {tsRel(s.at)}
                </div>
              </div>

              {confirming === s.id ? (
                <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto sm:flex-none">
                  <span className="text-[11.5px] font-semibold w-full sm:w-auto" style={{ color: 'var(--muted)' }}>Replace current data?</span>
                  <button className="btn btn-danger btn-sm flex-1 sm:flex-none" onClick={() => { restoreSnapshotById(s.id); setConfirming(null) }}>
                    Yes, restore
                  </button>
                  <button className="btn btn-ghost btn-sm flex-1 sm:flex-none" onClick={() => setConfirming(null)}>Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 justify-end sm:justify-start w-full sm:w-auto sm:flex-none">
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(s.id)} title="Roll back to this snapshot">
                    <History size={12} /> Restore
                  </button>
                  <button className="icon-btn" onClick={() => downloadSnapshot(s.id)} title="Download as JSON">
                    <Download size={14} />
                  </button>
                  <button className="icon-btn" onClick={() => deleteSnapshotById(s.id)} title="Delete this snapshot">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
