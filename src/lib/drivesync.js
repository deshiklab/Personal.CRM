/* Multi-device sync via ONE file in the user's own Google Drive.
 *
 *   personal-crm-sync.json  (visible only to this app — drive.file scope)
 *
 * Every device keeps a "baseline" = the snapshot state from its last
 * successful sync. A 3-way merge (baseline vs local vs remote) per record
 * means: edits/deletes on phone + edits on the PWA merge cleanly, and a
 * deleted record stays deleted on both sides.
 */

const SYNC_FILE = 'personal-crm-sync.json'
const FILES = 'https://www.googleapis.com/drive/v3/files'
const UP = 'https://www.googleapis.com/upload/drive/v3/files'
const auth = t => ({ Authorization: `Bearer ${t}` })

/* ── Drive I/O ── */
export const findSyncFile = token =>
  fetch(`${FILES}?q=${encodeURIComponent(`name='${SYNC_FILE}' and trashed=false`)}&fields=files(id,name,modifiedTime,size)`, { headers: auth(token) })
    .then(r => { if (!r.ok) throw new Error(`Drive search failed (${r.status})`); return r.json() })
    .then(d => d.files?.[0] || null)

export const readSync = async (token, fileId) => {
  const r = await fetch(`${FILES}/${fileId}?alt=media`, { headers: auth(token) })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`Drive read failed (${r.status})`)
  const txt = await r.text()
  if (!txt.trim()) return null
  const parsed = JSON.parse(txt)
  return parsed?.__pcrmSync ? parsed : null
}

export const writeSync = async (token, payload, fileId) => {
  const json = JSON.stringify(payload)
  if (fileId) {
    const r = await fetch(`${UP}/${fileId}?uploadType=media&fields=id,modifiedTime`,
      { method: 'PATCH', headers: { ...auth(token), 'Content-Type': 'application/json' }, body: json })
    if (!r.ok) throw new Error(`Drive update failed (${r.status})`)
    return r.json()
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify({ name: SYNC_FILE, mimeType: 'application/json' })], { type: 'application/json' }))
  form.append('file', new Blob([json], { type: 'application/json' }))
  const r = await fetch(`${UP}?uploadType=multipart&fields=id,modifiedTime`, { method: 'POST', headers: auth(token), body: form })
  if (!r.ok) throw new Error(`Drive create failed (${r.status})`)
  return r.json()
}

/* ── snapshot picking: what syncs across devices ── */
export const SYNCED_KEYS = ['contacts', 'tasks', 'events', 'notes', 'tags', 'groups', 'rules', 'relFreq', 'emails']

/* stable JSON (deep key-sorted) for content comparison */
export const stable = x => {
  if (x === null || typeof x !== 'object') return JSON.stringify(x)
  if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']'
  return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + stable(x[k])).join(',') + '}'
}
export const hashOf = snapshot => stable(snapshot)

/* three-way record merge: returns { value, conflict } */
const mergeRecord = (b, l, r) => {
  const sb = b === undefined ? undefined : stable(b)
  const sl = l === undefined ? undefined : stable(l)
  const sr = r === undefined ? undefined : stable(r)
  if (sl === sr) return { value: l, conflict: false }
  if (sl === sb) return { value: r, conflict: false }          // local untouched → remote wins
  if (sr === sb) return { value: l, conflict: false }          // remote untouched → local wins
  return { value: r, conflict: true }                          // both changed → remote wins, count it
}

const byId = arr => {
  const m = new Map()
  ;(arr || []).forEach(x => m.set(x.id, x))
  return m
}
const emailKey = e => `${e.provider}|${e.subject}|${e.ts}`
const byEmailKey = arr => {
  const m = new Map()
  ;(arr || []).forEach(x => m.set(emailKey(x), x))
  return m
}

/* merge one id-keyed collection against baseline */
const mergeCollection = (baseArr, localArr, remoteArr) => {
  const B = byId(baseArr), L = byId(localArr), R = byId(remoteArr)
  const out = []
  const seen = new Set()
  let conflicts = 0, fromRemote = 0
  const consider = (id, orderSrc) => {
    if (seen.has(id)) return
    seen.add(id)
    const b = B.get(id), l = L.get(id), r = R.get(id)
    if (b && l && !r) return                              // deleted remotely → stays deleted
    if (b && !l) return                                   // deleted locally (or both) → deleted
    if (!b && l && !r) return out.push(l)                 // locally new
    if (!b && !l && r) return () => {}                    // handled below to keep remote order
    const m = mergeRecord(b, l, r)
    if (m.conflict) conflicts++
    out.push(m.value)
  }
  ;(localArr || []).forEach(x => consider(x.id))
  const B2 = B, L2 = L
  ;(remoteArr || []).forEach(x => {
    if (seen.has(x.id)) return
    seen.add(x.id)
    if (B2.get(x.id) && !L2.get(x.id)) return             // deleted locally → not adopted
    out.push(x)
    fromRemote++
  })
  return { merged: out, conflicts, fromRemote }
}

/* relFreq is a plain {contactId: {freq, ...}} map */
const mergeMapObject = (baseObj, localObj, remoteObj) => {
  const keys = new Set([...Object.keys(baseObj || {}), ...Object.keys(localObj || {}), ...Object.keys(remoteObj || {})])
  const out = {}
  let conflicts = 0
  keys.forEach(k => {
    const b = (baseObj || {})[k], l = (localObj || {})[k], r = (remoteObj || {})[k]
    if (b && l && !r) return
    if (b && !l) return
    if (!b && l && !r) return out[k] = l
    if (!b && !l && r) return out[k] = r
    const m = mergeRecord(b, l, r)
    if (m.conflict) conflicts++
    out[k] = m.value
  })
  return { merged: out, conflicts }
}

export const mergeSnapshot = (base, local, remote) => {
  const stats = { conflicts: 0, fromRemote: 0 }
  const merged = {}
  for (const key of SYNCED_KEYS) {
    if (key === 'relFreq') {
      const m = mergeMapObject(base.relFreq, local.relFreq, remote.relFreq)
      merged.relFreq = m.merged; stats.conflicts += m.conflicts
    } else if (key === 'emails') {
      // emails have per-device random ids — dedupe on composite identity
      const B = byEmailKey(base.emails), L = byEmailKey(local.emails), R = byEmailKey(remote.emails)
      const out = [], seen = new Set()
      for (const e of local.emails || []) {
        const k = emailKey(e); seen.add(k)
        const b = B.get(k), r = R.get(k)
        if (b && !r) continue                              // deleted remotely
        const m = mergeRecord(b, e, r || e)
        if (m.conflict) stats.conflicts++
        out.push(m.value)
      }
      for (const e of remote.emails || []) {
        const k = emailKey(e)
        if (seen.has(k)) continue
        seen.add(k)
        if (B.get(k) && !L.get(k)) continue                // deleted locally
        out.push(e); stats.fromRemote++
      }
      merged.emails = out
    } else {
      const m = mergeCollection(base[key], local[key], remote[key])
      merged[key] = m.merged
      stats.conflicts += m.conflicts
      stats.fromRemote += m.fromRemote
    }
  }
  stats.pulled = SYNCED_KEYS.reduce((n, k) => n + (Array.isArray(merged[k]) ? merged[k].length : 0), 0)
  return { merged, stats }
}
