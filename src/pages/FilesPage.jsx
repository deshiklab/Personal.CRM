import { useMemo, useRef, useState } from 'react'
import {
  FolderOpen, Upload, Link2, Radio, Send, Download, Share2, Star, Trash2, Search,
  FileText, Image as ImageIcon, Film, Music, Archive, File as FileIcon, Smartphone, Pencil, CheckSquare, Square,
} from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Card, Empty, Pill, Modal, CsvButton } from '../components/ui'
import { saveBlob, readBlobAsBlob, fmtSize, storageBackend, fileLocationInfo, fileLocationKey } from '../lib/filestore'
import { sha256Hex } from '../lib/hash'
import { shareFile, fetchRemoteFile } from '../lib/share'
import NearbyTransfer from '../components/NearbyTransfer'
import { tsRel, cn } from '../lib'

const ICONS = {
  text: FileText, image: ImageIcon, video: Film, audio: Music, archive: Archive,
}
const iconFor = mime => ICONS[(mime || '').split('/')[0]] || (/\zip|rar|tar/.test(mime || '') ? Archive : FileIcon)
const kindFor = mime => (mime || '').split('/')[0] || 'file'

export default function FilesPage() {
  const crm = useCrm()
  const { files, devices } = crm
  const [q, setQ] = useState('')
  const [folderF, setFolderF] = useState(null)
  const [deviceF, setDeviceF] = useState(null)
  const [starredOnly, setStarredOnly] = useState(false)
  const [sel, setSel] = useState([])
  const [nearby, setNearby] = useState(null)      // 'send' | 'receive' | null
  const [urlModal, setUrlModal] = useState(false)
  const [urlVal, setUrlVal] = useState('')
  const [urlBusy, setUrlBusy] = useState(false)
  const [rename, setRename] = useState(null)      // file being renamed
  const [renameVal, setRenameVal] = useState('')
  const [busyFiles, setBusyFiles] = useState(0)
  const fileInput = useRef(null)

  const folders = useMemo(() => [...new Set(files.map(f => f.folder || 'Inbox'))], [files])
  const thisDeviceId = crm.syncState?.deviceId

  const list = useMemo(() => {
    let xs = [...files]
    if (folderF) xs = xs.filter(f => (f.folder || 'Inbox') === folderF)
    if (deviceF) xs = xs.filter(f => f.deviceId === deviceF)
    if (starredOnly) xs = xs.filter(f => f.starred)
    if (q) {
      const t = q.toLowerCase()
      xs = xs.filter(f => (f.name + ' ' + (f.folder || '') + ' ' + (f.deviceName || '')).toLowerCase().includes(t))
    }
    return xs.sort((a, b) => (b.starred === true) - (a.starred === true) || (b.storedAt || '').localeCompare(a.storedAt || ''))
  }, [files, q, folderF, deviceF, starredOnly])

  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0)
  const onThis = files.filter(f => f.deviceId === thisDeviceId)

  /* ── ingestion: browser File → sha256 + blob + index ── */
  const ingest = async (file, extra = {}) => {
    const buf = new Uint8Array(await file.arrayBuffer())
    const sha256 = await sha256Hex(buf)
    const meta = crm.addFileMeta({
      name: (file.name || 'file').slice(0, 120), mime: file.type || 'application/octet-stream',
      size: buf.length, sha256, ...extra,
    })
    await saveBlob(meta.id, buf)
    return meta
  }

  const onUpload = async e => {
    const picked = [...(e.target.files || [])]
    if (!picked.length) return
    setBusyFiles(picked.length)
    try {
      for (const f of picked) await ingest(f, { origin: 'import' })
      crm.toast(`📁 Added ${picked.length} file(s)`)
    } catch (err) {
      crm.toast(`Upload failed: ${err.message || err}`, 'warn')
    }
    setBusyFiles(0)
    e.target.value = ''
  }

  const addFromUrl = async () => {
    const url = urlVal.trim()
    if (!url) return
    setUrlBusy(true)
    const res = await fetchRemoteFile(url)
    setUrlBusy(false)
    if (!res.ok) {
      crm.toast(res.reason === 'network' ? 'Could not fetch that link (CORS or offline). Download the file and upload it instead.' : `Fetch failed (${res.reason})`, 'warn')
      return
    }
    await ingest(res.blob, { name: res.name, origin: 'import' })
    crm.toast(`📁 Saved ${res.name} from link`)
    setUrlModal(false); setUrlVal('')
  }

  const openFile = async f => {
    const blob = await readBlobAsBlob(f)
    if (!blob) {
      crm.toast(`This file's content lives on ${f.deviceName || 'another device'} — use Nearby transfer to request it`, 'warn')
      return
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = f.name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }

  const share = async f => {
    const blob = await readBlobAsBlob(f)
    if (!blob) return crm.toast(`Content lives on ${f.deviceName || 'another device'}`, 'warn')
    const how = await shareFile({ blob, name: f.name, title: f.name })
    if (how === 'downloaded') crm.toast('Share sheet unavailable — file downloaded instead')
  }

  const del = async f => {
    if (!window.confirm(`Delete "${f.name}"? The file content is removed from this device.`)) return
    await crm.deleteFile(f.id)
    crm.toast('File deleted')
    setSel(s => s.filter(id => id !== f.id))
  }

  const toggleSel = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  return (
    <div className="max-w-[1200px] mx-auto">
      <SectionHead kicker="Local-first storage" title="Files & Documents"
        sub="Every device keeps its own file shelf. The index syncs across your devices, content stays local — move it with Nearby transfer or the share sheet."
        right={<div className="flex items-center gap-2">
          <CsvButton filename="files-index.csv" rows={files} headers={[
            { label: 'Name', get: r => r.name }, { label: 'Size', get: r => r.size },
            { label: 'MIME', get: r => r.mime }, { label: 'Folder', get: r => r.folder },
            { label: 'Device', get: r => r.deviceName }, { label: 'SHA-256', get: r => r.sha256 },
            { label: 'Origin', get: r => r.origin }, { label: 'Stored', get: r => r.storedAt },
          ]} />
          <button className="btn btn-ghost btn-sm" onClick={() => setUrlModal(true)}><Link2 size={13} /> From link</button>
          <button className="btn btn-primary btn-sm" disabled={busyFiles > 0} onClick={() => fileInput.current?.click()}>
            <Upload size={13} /> {busyFiles ? `Adding ${busyFiles}…` : 'Upload'}
          </button>
          <input ref={fileInput} type="file" multiple className="hidden" onChange={onUpload} />
        </div>} />

      {/* stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        {[
          ['Files', files.length],
          ['Total size', fmtSize(totalSize)],
          ['On this device', onThis.length],
          ['Storage backend', storageBackend()],
        ['Storage location', `${fileLocationInfo().label} · ${fileLocationInfo().where}`],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <div className="text-[17px] font-extrabold tracking-tight">{value}</div>
            <div className="text-[10.5px] font-bold uppercase tracking-[.08em]" style={{ color: 'var(--faint)' }}>{label}</div>
          </Card>
        ))}
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <button className="btn btn-ghost btn-sm" disabled={!sel.length} onClick={() => setNearby('send')} title="Send the selected files to another device">
          <Send size={13} /> Nearby send {sel.length > 0 && `(${sel.length})`}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setNearby('receive')}>
          <Radio size={13} /> Nearby receive
        </button>
        <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />
        <button className={cn('chip chip-btn', !folderF && 'on')} onClick={() => setFolderF(null)}>All folders</button>
        {folders.map(f => (
          <button key={f} className={cn('chip chip-btn', folderF === f && 'on')} onClick={() => setFolderF(folderF === f ? null : f)}>
            <FolderOpen size={10} /> {f}
          </button>
        ))}
        <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />
        <button className={cn('chip chip-btn', deviceF === null && 'on')} onClick={() => setDeviceF(null)}>All devices</button>
        {devices.map(d => (
          <button key={d.id} className={cn('chip chip-btn', deviceF === d.id && 'on')} onClick={() => setDeviceF(deviceF === d.id ? null : d.id)}>
            <Smartphone size={10} /> {d.name}
          </button>
        ))}
        <button className={cn('chip chip-btn', starredOnly && 'on')} onClick={() => setStarredOnly(!starredOnly)}>
          <Star size={10} /> Starred
        </button>
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
          <input className="input pl-8" style={{ width: 210 }} placeholder="Search files…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      {/* list */}
      {list.length === 0 ? (
        <Card>
          <Empty icon={FolderOpen} title={q ? 'No files match' : 'No files yet'}>
            <button className="btn btn-primary btn-sm mt-3" onClick={() => fileInput.current?.click()}><Upload size={13} /> Upload your first file</button>
          </Empty>
        </Card>
      ) : (
        <Card className="p-1.5">
          {list.map(f => {
            const Icon = iconFor(f.mime)
            const here = f.deviceId === thisDeviceId
            return (
              <div key={f.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[.03] group">
                <button className="flex-none" onClick={() => toggleSel(f.id)} title="Select for Nearby send">
                  {sel.includes(f.id) ? <CheckSquare size={15} className="text-indigo-400" /> : <Square size={15} style={{ color: 'var(--faint)' }} />}
                </button>
                <Icon size={16} className="flex-none" style={{ color: f.starred ? '#fbbf24' : 'var(--muted)' }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold truncate">{f.name}</div>
                  <div className="text-[10.5px] flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--faint)' }}>
                    <span>{fmtSize(f.size)}</span>
                    <span>·</span><span>{f.folder || 'Inbox'}</span>
                    <span>·</span>
                    <span className={here ? 'text-emerald-400/90' : ''}>{here ? 'this device' : (f.deviceName || 'other device')}</span>
                    <span>·</span><span>{tsRel(f.storedAt)}</span>
                    {f.origin === 'transfer' && <Pill color="#34d399">nearby</Pill>}
                    {f.sha256 && <span className="font-mono opacity-60">{f.sha256.slice(0, 8)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button className="icon-btn !w-7 !h-7" title="Download / open" onClick={() => openFile(f)}><Download size={12} /></button>
                  <button className="icon-btn !w-7 !h-7" title="Share (WhatsApp, drive…)" onClick={() => share(f)}><Share2 size={12} /></button>
                  <button className="icon-btn !w-7 !h-7" title={f.starred ? 'Unstar' : 'Star'} onClick={() => crm.updateFileMeta(f.id, { starred: !f.starred })}>
                    <Star size={12} style={f.starred ? { color: '#fbbf24' } : undefined} fill={f.starred ? '#fbbf24' : 'none'} />
                  </button>
                  <button className="icon-btn !w-7 !h-7" title="Rename" onClick={() => { setRename(f); setRenameVal(f.name) }}><Pencil size={12} /></button>
                  <button className="icon-btn !w-7 !h-7" title="Delete" onClick={() => del(f)}><Trash2 size={12} /></button>
                </div>
              </div>
            )
          })}
        </Card>
      )}

      {/* devices */}
      {devices.length > 0 && (
        <Card className="p-4 mt-4">
          <h3 className="font-bold text-[13px] mb-2">Files stored per device</h3>
          <div className="flex flex-col gap-1.5">
            {devices.map(d => {
              const n = crm.filesOfDevice(d.id).length
              return (
                <div key={d.id} className="flex items-center gap-2.5 text-[12px] py-1">
                  <Smartphone size={14} style={{ color: d.id === thisDeviceId ? '#34d399' : 'var(--muted)' }} />
                  <span className="font-semibold">{d.name}</span>
                  {d.id === thisDeviceId && <Pill color="#34d399">this device</Pill>}
                  <span style={{ color: 'var(--faint)' }}>{n} file(s) · last seen {tsRel(d.lastSeen)}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* modals */}
      {nearby && (
        <NearbyTransfer open onClose={() => setNearby(null)} mode={nearby}
          files={nearby === 'send' ? files.filter(f => sel.includes(f.id)) : []} />
      )}

      <Modal open={urlModal} onClose={() => setUrlModal(false)} title="Add file from link">
        <div className="text-[12px] mb-2" style={{ color: 'var(--muted)' }}>
          Works with any link the browser can fetch (raw GitHub / Gist URLs work great). If a site blocks cross-origin fetch, download the file and upload it instead.
        </div>
        <input className="input" placeholder="https://…" value={urlVal} onChange={e => setUrlVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addFromUrl() }} />
        <div className="flex justify-end gap-2 mt-3">
          <button className="btn btn-ghost btn-sm" onClick={() => setUrlModal(false)}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={!urlVal.trim() || urlBusy} onClick={addFromUrl}>
            <Link2 size={13} /> {urlBusy ? 'Fetching…' : 'Fetch & save'}
          </button>
        </div>
      </Modal>

      <Modal open={!!rename} onClose={() => setRename(null)} title="Rename file">
        <input className="input" value={renameVal} onChange={e => setRenameVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && rename && renameVal.trim()) {
              crm.updateFileMeta(rename.id, { name: renameVal.trim().slice(0, 120) })
              crm.toast('Renamed'); setRename(null)
            }
          }} />
        <div className="flex justify-end gap-2 mt-3">
          <button className="btn btn-ghost btn-sm" onClick={() => setRename(null)}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={!renameVal.trim()}
            onClick={() => {
              if (rename && renameVal.trim()) {
                crm.updateFileMeta(rename.id, { name: renameVal.trim().slice(0, 120) })
                crm.toast('Renamed'); setRename(null)
              }
            }}>Save</button>
        </div>
      </Modal>
    </div>
  )
}
