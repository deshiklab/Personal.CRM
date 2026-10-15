/**
 * WS — User Profile settings (manage your profile)
 *
 * A dedicated Settings card to view, edit and manage the user's own profile
 * (`myCard`) — the identity that fills QR business cards, vCard exports and
 * shared cards everywhere in the app:
 *   • identity header — initials avatar + name + role · org
 *   • completeness meter (N of 9 fields)
 *   • full editor modal for every my-card field
 *   • actions — Share my card (QR), Copy vCard, two-step Clear
 */
import { useEffect, useMemo, useState } from 'react'
import { User, Pencil, Share2, Copy, Trash2, Save } from 'lucide-react'
import { useCrm } from '../store'
import { Card, Field, Modal } from './ui'
import { t as tr } from '../lib/i18n'
import { toVCF } from '../lib/vcard'
import { copyText } from '../lib/share'
import MyQrCard from './MyQrCard'

export const PROFILE_FIELDS = ['name', 'phone', 'email', 'org', 'role', 'url', 'address', 'birthday', 'note']
const EMPTY = Object.fromEntries(PROFILE_FIELDS.map(k => [k, '']))
const LABELS = {
  name: 'Full name', phone: 'Phone', email: 'Email', org: 'Company / organisation',
  role: 'Role / title', url: 'Website', address: 'Address', birthday: 'Birthday (YYYY-MM-DD)', note: 'Note',
}
const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

export const initialsOf = name => (name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
  .map(w => w[0].toUpperCase()).join('') || '?'
const hashOf = s => (s || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)

/* module-level (inline = remount = focus loss) */
export function Avatar({ name, size = 56, testid = 'profile-avatar' }) {
  const n = (name || '').trim()
  const h = hashOf(n)
  return (
    <div data-testid={testid} className="rounded-full grid place-items-center font-bold shrink-0 select-none"
      style={{
        width: size, height: size,
        background: n ? `linear-gradient(135deg, ${AVATAR_COLORS[h % 8]}, ${AVATAR_COLORS[(h + 3) % 8]})` : 'rgba(148,163,184,.14)',
        color: n ? '#fff' : 'var(--muted)',
        fontSize: Math.round(size * 0.36),
      }}>
      {n ? initialsOf(n) : <User size={Math.round(size * 0.45)} />}
    </div>
  )
}

function ProfileEditor({ open, onClose }) {
  const { myCard, updateMyCard, toast } = useCrm()
  const [draft, setDraft] = useState(EMPTY)
  useEffect(() => {
    if (open) setDraft({ ...EMPTY, ...(myCard || {}) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))
  const save = () => {
    updateMyCard(draft)
    toast(tr('profile.saved', 'Profile saved'))
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={tr('profile.editTitle', 'Edit your profile')}>
      <div className="flex flex-col gap-3">
        {PROFILE_FIELDS.map(k => (
          <Field key={k} label={tr('profile.f.' + k, LABELS[k])}>
            {k === 'note'
              ? <textarea className="input" rows={3} data-testid={`profile-f-${k}`} value={draft[k] || ''}
                  onChange={e => set(k, e.target.value)} placeholder="Anything partners should know" />
              : <input className="input" data-testid={`profile-f-${k}`} value={draft[k] || ''}
                  onChange={e => set(k, e.target.value)} />}
          </Field>
        ))}
        <div className="flex gap-2 justify-end">
          <button className="btn btn-ghost" data-testid="profile-cancel" onClick={onClose}>
            {tr('profile.cancel', 'Cancel')}
          </button>
          <button className="btn btn-primary" data-testid="profile-save" onClick={save}>
            <Save size={13} /> {tr('profile.save', 'Save profile')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function ProfileSettings() {
  const { myCard, updateMyCard, toast } = useCrm()
  const card = myCard || EMPTY
  const [editOpen, setEditOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const name = (card.name || '').trim()
  const filled = PROFILE_FIELDS.filter(k => (card[k] || '').trim()).length
  const vcf = useMemo(() => toVCF({
    name: card.name || 'Me', phone: card.phone || '', email: card.email || '',
    company: card.org || '', role: card.role || '', birthday: card.birthday || null,
    address: card.address || '', url: card.url || '', note: card.note || '',
    interests: [], introducedBy: null,
  }), [card.name, card.phone, card.email, card.org, card.role, card.birthday, card.address, card.url, card.note])

  const doCopy = async () => {
    const ok = await copyText(vcf)
    toast(ok ? tr('profile.copied', '📋 vCard copied') : tr('profile.copyFail', 'Copy failed'), ok ? 'ok' : 'warn')
  }
  const doClear = () => {
    updateMyCard({ ...EMPTY })
    setConfirmClear(false)
    toast(tr('profile.cleared', 'Profile cleared'))
  }
  const askClear = () => {
    setConfirmClear(true)
    setTimeout(() => setConfirmClear(false), 2500)
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3.5">
        <Avatar name={name} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px]">{tr('profile.title', 'User Profile')}</div>
          <div className="text-[11.5px]" style={{ color: 'var(--faint)' }}>
            {tr('profile.sub', 'Your identity on shared cards, QR codes and exports.')}
          </div>
          {name ? (
            <div className="mt-2">
              <div className="font-semibold text-[13.5px] truncate">{name}</div>
              {(card.role || card.org) && (
                <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
                  {[card.role, card.org].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2 text-[12px]" data-testid="profile-empty" style={{ color: 'var(--muted)' }}>
              {tr('profile.none', 'No profile yet — add your details so shared cards are yours.')}
            </div>
          )}
        </div>
      </div>

      {/* completeness meter */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(148,163,184,.18)' }}>
          <div className="h-full rounded-full" data-testid="profile-meter"
            style={{ width: `${Math.round((filled / PROFILE_FIELDS.length) * 100)}%`, background: 'var(--i2, #818cf8)', transition: 'width .3s' }} />
        </div>
        <div className="text-[11px] tabular-nums" data-testid="profile-complete" style={{ color: 'var(--faint)' }}>
          {filled} of {PROFILE_FIELDS.length} {tr('profile.fields', 'fields')}
        </div>
      </div>

      {/* details grid */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5">
        {PROFILE_FIELDS.map(k => (
          <div key={k} className="flex items-baseline justify-between gap-3 border-b pb-1" style={{ borderColor: 'var(--line, rgba(148,163,184,.1))' }}>
            <span className="text-[11px]" style={{ color: 'var(--faint)' }}>{tr('profile.f.' + k, LABELS[k])}</span>
            <span className="text-[12px] truncate max-w-[60%]" data-testid={`profile-detail-${k}`}
              style={{ color: (card[k] || '').trim() ? 'var(--text, inherit)' : 'var(--faint)' }}>
              {(card[k] || '').trim() || '—'}
            </span>
          </div>
        ))}
      </div>

      {/* actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn btn-primary btn-sm" data-testid="profile-edit" onClick={() => setEditOpen(true)}>
          <Pencil size={13} /> {name ? tr('profile.edit', 'Edit profile') : tr('profile.add', 'Add profile')}
        </button>
        <button className="btn btn-ghost btn-sm" data-testid="profile-share" onClick={() => setQrOpen(true)}>
          <Share2 size={13} /> {tr('profile.share', 'Share my card')}
        </button>
        <button className="btn btn-ghost btn-sm" data-testid="profile-copy" onClick={doCopy}>
          <Copy size={13} /> {tr('profile.copy', 'Copy vCard')}
        </button>
        {confirmClear ? (
          <button className="btn btn-sm" data-testid="profile-clear-yes" style={{ color: 'var(--red, #ef4444)', borderColor: 'rgba(239,68,68,.4)' }} onClick={doClear}>
            <Trash2 size={13} /> {tr('profile.clearYes', 'Really clear?')}
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" data-testid="profile-clear" onClick={askClear}>
            <Trash2 size={13} /> {tr('profile.clear', 'Clear')}
          </button>
        )}
      </div>

      <ProfileEditor open={editOpen} onClose={() => setEditOpen(false)} />
      <MyQrCard open={qrOpen} onClose={() => setQrOpen(false)} />
    </Card>
  )
}
