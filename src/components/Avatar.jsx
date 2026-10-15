/**
 * Shared initials avatar — gradient derived from the name hash.
 * Used by ProfileSettings (Settings → User Profile) and MyQrCard (QR modal).
 */
import { User } from 'lucide-react'

const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

export const initialsOf = name => (name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
  .map(w => w[0].toUpperCase()).join('') || '?'

const hashOf = s => (s || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)

export default function Avatar({ name, size = 56, testid = 'profile-avatar' }) {
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
