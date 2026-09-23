/* Multi-device sync backend #2: a private (secret) GitHub Gist.
 *
 * Why this exists: Google Cloud OAuth setup is genuinely fiddly. A GitHub
 * Personal Access Token (classic) with ONLY the `gist` scope does the same
 * sync job in one step: api.github.com is CORS-open, and a secret gist is
 * invisible to everyone but the token owner.
 *
 * The sync engine (revision counter + 3-way merge) lives in drivesync.js and
 * is reused unchanged — only the I/O differs.
 */

const API = 'https://api.github.com'
const GIST_DESC = 'personal-crm-sync (private)'
const FILE_NAME = 'personal-crm-sync.json'

const hdr = token => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
})

export const testToken = async token => {
  const r = await fetch(`${API}/gists?per_page=1`, { headers: hdr(token) })
  if (r.status === 401) throw new Error('Token rejected by GitHub (401) — generate a CLASSIC token with the gist scope')
  if (!r.ok) throw new Error(`GitHub API error (${r.status})`)
  const scope = r.headers.get('x-oauth-scopes') || ''
  if (!scope.split(',').map(s => s.trim()).includes('gist'))
    throw new Error(`Token needs the "gist" scope (it has: ${scope || 'none'})`)
  return true
}

export const findSyncGist = async token => {
  const r = await fetch(`${API}/gists?per_page=100`, { headers: hdr(token) })
  if (!r.ok) throw new Error(`GitHub gists list failed (${r.status})`)
  const gists = await r.json()
  const hit = gists.find(g =>
    g.description === GIST_DESC && g.files && Object.keys(g.files).includes(FILE_NAME))
  return hit ? { id: hit.id, description: hit.description } : null
}

export const readSync = async (token, gistId) => {
  const r = await fetch(`${API}/gists/${gistId}`, { headers: hdr(token), cache: 'no-store' })
  if (r.status === 404) return null          // deleted on GitHub → treat as no remote
  if (!r.ok) throw new Error(`Gist read failed (${r.status})`)
  const g = await r.json()
  const content = g.files?.[FILE_NAME]?.content
  if (!content) return null
  const parsed = JSON.parse(content)
  return parsed?.__pcrmSync ? parsed : null
}

export const writeSync = async (token, payload, gistId) => {
  const body = JSON.stringify({ files: { [FILE_NAME]: { content: JSON.stringify(payload) } } })
  if (gistId) {
    const r = await fetch(`${API}/gists/${gistId}`, { method: 'PATCH', headers: hdr(token), body })
    if (r.status === 404) throw Object.assign(new Error('sync gist vanished (404)'), { gistGone: true })
    if (!r.ok) throw new Error(`Gist update failed (${r.status})`)
    const g = await r.json()
    return { id: g.id }
  }
  const r = await fetch(`${API}/gists`, {
    method: 'POST',
    headers: hdr(token),
    body: JSON.stringify({ description: GIST_DESC, public: false, files: { [FILE_NAME]: { content: JSON.stringify(payload) } } }),
  })
  if (!r.ok) throw new Error(`Gist create failed (${r.status})`)
  const g = await r.json()
  return { id: g.id }
}
