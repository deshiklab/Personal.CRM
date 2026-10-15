import { useRef, useState } from 'react'
import { Image as ImageIcon, X, RotateCcw, Palette, Sparkles } from 'lucide-react'
import { useCrm } from '../store'
import {
  QR_STYLE_DEFAULTS, QR_PRESETS, DOT_TYPES, CORNER_TYPES, qrStyleOf, shrinkLogo,
} from '../lib/qrstyle'

/* QR design studio controls — shared by the my-card QR and per-contact QRs.
 * Everything writes to store.qrStyle (persisted + backed up). */
export default function QrDesigner() {
  const { qrStyle, updateQrStyle, toast } = useCrm()
  const [busy, setBusy] = useState(false)
  const st = qrStyleOf(qrStyle)
  const logoRef = useRef(null)
  const set = (k, v) => updateQrStyle({ [k]: v })

  const onLogo = async f => {
    setBusy(true)
    try {
      const dataUrl = await shrinkLogo(f)
      set('logo', dataUrl)
      toast('🎨 Logo added to your QR design')
    } catch {
      toast('Could not read that image', 'warn')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5" data-testid="qr-designer">
      {/* presets */}
      <div>
        <div className="label inline-flex items-center gap-1.5"><Sparkles size={11} /> Design</div>
        <div className="flex gap-1.5 flex-wrap">
          {QR_PRESETS.map(p => {
            const active = st.fg === p.fg && st.bg === p.bg && st.dot === p.dot && st.corner === p.corner
            return (
              <button key={p.id} data-testid={`qr-preset-${p.id}`}
                className="chip chip-btn inline-flex items-center gap-1.5" title={p.label}
                style={active ? { borderColor: '#818cf8', color: '#818cf8' } : {}}
                onClick={() => updateQrStyle({ fg: p.fg, bg: p.bg, dot: p.dot, corner: p.corner })}>
                <span className="w-3 h-3 rounded-[4px] inline-block" style={{ background: p.bg, border: `2px solid ${p.fg}` }} />
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* colours */}
      <div>
        <div className="label inline-flex items-center gap-1.5"><Palette size={11} /> Colours</div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--muted)' }}>
            Pattern
            <input type="color" value={st.fg} data-testid="qr-fg" className="w-8 h-8 rounded-lg p-0 border-0 bg-transparent cursor-pointer"
              onChange={e => set('fg', e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--muted)' }}>
            Background
            <input type="color" value={st.bg} data-testid="qr-bg" className="w-8 h-8 rounded-lg p-0 border-0 bg-transparent cursor-pointer"
              onChange={e => set('bg', e.target.value)} />
          </label>
          <button className="btn btn-ghost btn-sm ml-auto" data-testid="qr-reset"
            onClick={() => updateQrStyle(QR_STYLE_DEFAULTS)}>
            <RotateCcw size={12} /> Reset
          </button>
        </div>
      </div>

      {/* patterns */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Dot pattern</span>
          <select className="input mt-1" value={st.dot} data-testid="qr-dot"
            onChange={e => set('dot', e.target.value)}>
            {DOT_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Corner style</span>
          <select className="input mt-1" value={st.corner} data-testid="qr-corner"
            onChange={e => set('corner', e.target.value)}>
            {CORNER_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </label>
      </div>

      {/* logo */}
      <div>
        <div className="label inline-flex items-center gap-1.5"><ImageIcon size={11} /> Logo</div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {st.logo
            ? (
              <>
                <img src={st.logo} alt="QR logo" className="w-11 h-11 rounded-xl object-cover" style={{ background: st.bg }} />
                <label className="flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--muted)' }}>
                  Size
                  <input type="range" min={15} max={45} value={Math.round(st.logoSize * 100)} data-testid="qr-logo-size"
                    onChange={e => set('logoSize', Number(e.target.value) / 100)} />
                </label>
                <button className="icon-btn" title="Remove logo" data-testid="qr-logo-remove"
                  onClick={() => set('logo', '')}><X size={14} /></button>
              </>
            ) : (
              <button className="btn btn-ghost btn-sm" data-testid="qr-logo-add" disabled={busy}
                onClick={() => logoRef.current?.click()}>
                <ImageIcon size={13} /> {busy ? 'Reading…' : 'Add a logo (centred)'}
              </button>
            )}
          <input ref={logoRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onLogo(f); e.target.value = '' }} />
          <span className="text-[10.5px]" style={{ color: 'var(--faint)' }}>
            Error correction turns to H — codes stay scannable around the logo.
          </span>
        </div>
      </div>
    </div>
  )
}
