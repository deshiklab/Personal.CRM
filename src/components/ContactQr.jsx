import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Share2, Sliders, QrCode } from 'lucide-react'
import { useCrm } from '../store'
import { Modal } from './ui'
import QrDesigner from './QrDesigner'
import { toVCF, downloadVCF } from '../lib/vcard'
import { renderStyledQr, styledQrDataUrl, qrStyleOf } from '../lib/qrstyle'

/* Per-contact vCard QR — "scan to save this person". Shares the same design
 * studio as the my-card QR (store.qrStyle). */
export default function ContactQr({ contact, open, onClose }) {
  const { qrStyle, toast } = useCrm()
  const boxRef = useRef(null)
  const [mode, setMode] = useState(null)
  const [designOpen, setDesignOpen] = useState(false)
  const vcf = useMemo(() => (contact ? toVCF(contact) : ''), [contact])

  useEffect(() => {
    if (!open || !contact || !boxRef.current) return
    let dead = false
    renderStyledQr(boxRef.current, vcf, qrStyle).then(m => { if (!dead) setMode(m) })
    return () => { dead = true }
  }, [open, contact, vcf, qrStyle, designOpen])

  if (!contact) return null
  return (
    <Modal open={open} onClose={onClose} title={`QR — ${contact.name}`}>
      <div className="flex flex-col items-center gap-3">
        <div className="text-[12px] text-center" style={{ color: 'var(--muted)' }}>
          Anyone can scan this to save <b style={{ color: 'var(--text)' }}>{contact.name}</b> as a contact — phone camera, no app needed.
        </div>
        <div ref={boxRef} data-testid="contact-qr" className="rounded-2xl overflow-hidden"
          style={{ background: qrStyleOf(qrStyle).bg, minHeight: 260, minWidth: 260, display: 'grid', placeItems: 'center' }} />
        {mode === null && (
          <div className="text-[11px] text-center px-4" style={{ color: 'var(--faint)' }}>
            QR rendering needs a canvas-capable browser — the .vcf share still works.
          </div>
        )}
        <div className="flex gap-1.5 flex-wrap justify-center">
          <button className="btn btn-ghost btn-sm" data-testid="contact-qr-design"
            onClick={() => setDesignOpen(o => !o)}>
            <Sliders size={13} /> {designOpen ? 'Hide design' : 'Design'}
          </button>
          <button className="btn btn-ghost btn-sm" data-testid="contact-qr-download"
            onClick={async () => {
              const url = await styledQrDataUrl(vcf, qrStyle)
              if (!url) return toast('QR rendering unavailable here', 'warn')
              const a = document.createElement('a')
              a.href = url
              a.download = `${(contact.name || 'contact').replace(/\s+/g, '-')}-qr.png`
              document.body.appendChild(a); a.click(); a.remove()
              toast('🖼️ QR downloaded as PNG')
            }}>
            <Download size={13} /> PNG
          </button>
          <button className="btn btn-ghost btn-sm" data-testid="contact-qr-vcf"
            onClick={() => { downloadVCF([contact], `${contact.name.replace(/\s+/g, '-')}.vcf`); toast(`📇 ${contact.name} downloaded as .vcf`) }}>
            <Share2 size={13} /> .vcf
          </button>
        </div>
        {designOpen && (
          <div className="card p-4 w-full">
            <QrDesigner />
          </div>
        )}
      </div>
    </Modal>
  )
}
