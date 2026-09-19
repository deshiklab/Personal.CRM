export const uid = () => Math.random().toString(36).slice(2, 10)

export const pad = n => String(n).padStart(2, '0')
export const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => isoDate(new Date())
export const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d }
export const daysAgoISO = n => isoDate(addDays(new Date(), -n))
export const daysAheadISO = n => isoDate(addDays(new Date(), n))
export const parseISO = iso => { const [y, m, dd] = iso.split('-').map(Number); return new Date(y, m - 1, dd) }

const midnight = d => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const diffDays = (fromISO, toISO) => Math.round((midnight(parseISO(toISO)) - midnight(parseISO(fromISO))) / 86400000)
export const daysSince = iso => diffDays(iso, todayISO())
export const daysUntil = iso => diffDays(todayISO(), iso)

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
export const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export const WEEKDAYS_S = ['Su','Mo','Tu','We','Th','Fr','Sa']

export const fmtHuman = iso => { const d = parseISO(iso); return `${MONTHS_S[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` }

export function relDay(iso) {
  const n = daysUntil(iso)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  if (n > 1) return `in ${n}d`
  return `${-n}d ago`
}

export function tsRel(ts) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(ts).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`
  return fmtHuman(isoDate(new Date(ts)))
}
export const tsAgo = mins => new Date(Date.now() - mins * 60000).toISOString()

export function initials(name = '') {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

const AVATAR_COLORS = ['#f43f5e','#f97316','#fbbf24','#34d399','#38bdf8','#818cf8','#a78bfa','#f472b6','#22d3ee','#e879f9','#a3e635','#fb7185']
export function hashColor(str = '') {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function monthMatrix(year, month) {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  const weeks = []
  for (let w = 0; w < 6; w++) {
    const row = []
    for (let d = 0; d < 7; d++) { row.push(new Date(start)); start.setDate(start.getDate() + 1) }
    weeks.push(row)
  }
  return weeks
}

export const cn = (...xs) => xs.filter(Boolean).join(' ')
