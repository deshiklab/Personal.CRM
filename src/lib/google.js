/* Google Identity Services (client-side OAuth, no backend secret needed).
 * Works when the user supplies their own Google Cloud OAuth "Web" Client ID.
 * Scopes used:
 *   calendar.readonly  — import upcoming/past events
 *   contacts.readonly  — import people via People API
 *   drive.file         — create/read only files this app created (safe scope)
 */

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ')

/* ── platform helpers & native Google Sign-In (Android APK) ──
 * IMPORTANT: do NOT statically import @capacitor/core here. This module is
 * flattened by vite-plugin-singlefile, and a static import from a namespace
 * that the store also * -imports resolves empty (prod bug: isNative became
 * (void 0)). Capacitor core exposes itself on window — read it lazily. */
export const isNative = () => {
  try { const C = window.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform()) } catch { return false }
}
export const platform = () => {
  try { const C = window.Capacitor; return (C && C.getPlatform ? C.getPlatform() : 'web') } catch { return 'web' }
}

const NATIVE_SCOPES = ['profile', 'email', ...SCOPES.split(' ')]

export const requestNativeToken = async webClientId => {
  if (!webClientId) throw new Error('Paste the Web OAuth Client ID in Settings → Google hub first')
  const { SocialLogin } = await import('@capgo/capacitor-social-login')
  try { await SocialLogin.initialize({ google: { webClientId, mode: 'online' } }) } catch { /* already initialized */ }
  const res = await SocialLogin.login({ provider: 'google', options: { scopes: NATIVE_SCOPES } })
  const t = res?.result?.accessToken?.token
  if (!t) throw new Error('Google sign-in returned no access token — check the Android OAuth client (SHA-1 + package id) in the setup guide')
  return { t, exp: Date.now() + 3300e3, email: res?.result?.profile?.email || 'Google account' }
}

export const nativeSignOut = async () => {
  if (!isNative()) return
  try {
    const { SocialLogin } = await import('@capgo/capacitor-social-login')
    await SocialLogin.logout({ provider: 'google' })
  } catch { /* best effort */ }
}

let gsiPromise = null
export const ensureGsi = () => {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gsiPromise) return gsiPromise
  gsiPromise = new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload = res
    s.onerror = () => { gsiPromise = null; rej(new Error('Google Identity Services failed to load — check your network')) }
    document.head.appendChild(s)
  })
  return gsiPromise
}

export const requestToken = (clientId, scope = SCOPES) => new Promise((res, rej) => {
  ensureGsi().then(() => {
    const tc = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      callback: r => r.error ? rej(new Error(r.error_description || r.error)) : res(r.access_token),
      error_callback: e => rej(new Error(e?.type === 'popup_closed' ? 'Sign-in window closed' : 'Authorization failed')),
    })
    tc.requestAccessToken({ prompt: '' })
  }).catch(rej)
})

export const gapi = async (token, url, opts = {}) => {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`Google API ${r.status}: ${body.slice(0, 140)}`)
  }
  return r.status === 204 ? null : r.json()
}

/* ── API shapes ───────────────────────────────────────────── */
export const fetchCalendarEvents = async (token) => {
  const timeMin = new Date(Date.now() - 30 * 864e5).toISOString()
  const timeMax = new Date(Date.now() + 60 * 864e5).toISOString()
  const data = await gapi(token,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=100`)
  return (data.items || []).map(e => ({
    title: e.summary || '(no title)',
    date: (e.start?.dateTime || e.start?.date || '').slice(0, 10),
    time: e.start?.dateTime ? e.start.dateTime.slice(11, 16) : '09:00',
    endTime: e.end?.dateTime ? e.end.dateTime.slice(11, 16) : null,
    location: e.location || '',
    gcalId: e.id,
  })).filter(e => e.date)
}

export const fetchPeople = async (token) => {
  const data = await gapi(token,
    'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations&pageSize=200&sortOrder=LAST_MODIFIED_DESCENDING')
  return (data.connections || []).map(p => ({
    name: p.names?.[0]?.displayName || '',
    phone: p.phoneNumbers?.[0]?.value || '',
    email: p.emailAddresses?.[0]?.value || '',
    org: p.organizations?.[0]?.name || '',
  })).filter(p => p.name)
}

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files'
export const findBackupFile = token =>
  gapi(token, `${DRIVE_FILES}?q=${encodeURIComponent("name='personal-crm-backup.json' and trashed=false")}&fields=files(id,name,modifiedTime,size)`)
    .then(d => d.files?.[0] || null)

export const uploadBackup = async (token, json, fileId) => {
  if (fileId) {
    return gapi(token, `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,modifiedTime,size`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: json })
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify({ name: 'personal-crm-backup.json', mimeType: 'application/json' })], { type: 'application/json' }))
  form.append('file', new Blob([json], { type: 'application/json' }))
  const r = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime,size`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
  if (!r.ok) throw new Error(`Drive upload failed (${r.status})`)
  return r.json()
}

export const downloadBackup = (token, fileId) =>
  gapi(token, `${DRIVE_FILES}/${fileId}?alt=media`)

/* ── Gmail: pull recent messages matched to CRM contacts ── */
const headerVal = (headers, name) => (headers || []).find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''

export const fetchGmailMessages = async (token, max = 20) => {
  const list = await gapi(token,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent('newer_than:21d')}&maxResults=${max}&labelIds=INBOX`)
  const msgs = list.messages || []
  const out = []
  for (const m of msgs.slice(0, max)) {
    const d = await gapi(token,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`)
    const fromRaw = headerVal(d.payload?.headers, 'From')
    const toRaw = headerVal(d.payload?.headers, 'To')
    const em = (fromRaw.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || toRaw.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [''])[0]
    out.push({
      id: m.id,
      dir: fromRaw.toLowerCase().includes('me') ? 'out' : 'in',
      name: (fromRaw.replace(/<[^>]+>/, '').replace(/"/g, '').trim()) || em,
      email: em,
      subject: headerVal(d.payload?.headers, 'Subject') || '(no subject)',
      snippet: (d.snippet || '').slice(0, 140),
      ts: new Date(Number(d.internalDate || Date.now())).toISOString(),
    })
  }
  return out
}

export const fetchGmailProfile = token =>
  gapi(token, 'https://gmail.googleapis.com/gmail/v1/users/me/profile')

/* GIS error → actionable fix (shown in toasts) */
export const friendlyGoogleError = e => {
  const m = String(e?.message || e || '')
  if (/origin_mismatch/i.test(m)) return 'Origin not allowed — add this site URL to "Authorized JavaScript origins" of your OAuth client (see the setup guide ↑)'
  if (/access_denied/i.test(m)) return 'Access denied — add your Gmail as a Test user in the OAuth consent screen (Testing mode)'
  if (/invalid_client/i.test(m) || /client_id/i.test(m)) return 'Client ID looks wrong — check it ends with ".apps.googleusercontent.com"'
  if (/popup_closed|Sign-in window closed/i.test(m)) return 'Sign-in window closed before finishing'
  if (/popup_blocked/i.test(m)) return 'Popup was blocked by the browser — allow popups for this site and retry'
  if (/scope/i.test(m)) return 'Scope issue — make sure Calendar, People, Drive AND Gmail APIs are all enabled in the project'
  return m
}
