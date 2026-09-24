#!/usr/bin/env node
/**
 * Mint Personal CRM Pro licence keys for MoR stock / support.
 *
 * Usage:
 *   node scripts/mint-keys.mjs                 # one key, no email
 *   node scripts/mint-keys.mjs --count 20
 *   node scripts/mint-keys.mjs --email a@b.c
 *   node scripts/mint-keys.mjs --count 5 --csv keys.csv
 *   node scripts/mint-keys.mjs --days 30       # expiring trial key
 *
 * Keys verify offline in the app (PCRM1-…). Keep the output offline —
 * never commit a live pool. See docs/WEB-KEYS-MOR.md.
 */
import { writeFileSync } from 'fs'
import { webcrypto } from 'crypto'

const crypto = webcrypto

const BRAND_APP = 'Personal CRM'
const PRODUCT_ID_WEB = 'personal-crm-pro'
const PEPPER = `bitscol-personal-crm/${BRAND_APP}/v1/lifetime`

const args = process.argv.slice(2)
const flag = (name, def = null) => {
  const i = args.indexOf(`--${name}`)
  if (i < 0) return def
  return args[i + 1] ?? def
}
const has = name => args.includes(`--${name}`)

const count = Math.max(1, Math.min(500, parseInt(flag('count', '1'), 10) || 1))
const email = flag('email', '') || ''
const days = flag('days', null) ? parseInt(flag('days'), 10) : null
const csvPath = flag('csv', null)
const jsonOut = has('json')

const b64url = (bytes) => {
  let s
  if (typeof bytes === 'string') s = Buffer.from(bytes, 'utf8').toString('base64')
  else s = Buffer.from(bytes).toString('base64')
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function hmacSign(message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(PEPPER), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return b64url(new Uint8Array(sig)).slice(0, 22)
}

async function issueLicenseKey({ email = '', days = null } = {}) {
  const payload = {
    v: 1,
    pid: PRODUCT_ID_WEB,
    email: String(email || '').toLowerCase() || undefined,
    iat: Date.now(),
    exp: days ? Date.now() + days * 864e5 : undefined,
  }
  const payloadB64 = b64url(JSON.stringify(payload))
  const sig = await hmacSign(payloadB64)
  return { key: `PCRM1-${payloadB64}-${sig}`, payload }
}

const rows = []
for (let i = 0; i < count; i++) {
  const r = await issueLicenseKey({ email: email || undefined, days })
  rows.push({
    n: i + 1,
    key: r.key,
    email: r.payload.email || '',
    iat: new Date(r.payload.iat).toISOString(),
    exp: r.payload.exp ? new Date(r.payload.exp).toISOString() : '',
    status: 'unused',
    sold_to: '',
    order_id: '',
  })
}

if (jsonOut) {
  console.log(JSON.stringify(rows, null, 2))
} else {
  console.log(`# Personal CRM Pro keys · ${count} · ${new Date().toISOString()}`)
  console.log(`# Product ${PRODUCT_ID_WEB} · pepper v1 lifetime`)
  console.log('# Keep offline. Do not commit.')
  console.log('')
  rows.forEach(r => console.log(r.key))
}

if (csvPath) {
  const header = 'n,key,email,iat,exp,status,sold_to,order_id'
  const lines = rows.map(r =>
    [r.n, r.key, r.email, r.iat, r.exp, r.status, r.sold_to, r.order_id]
      .map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
  writeFileSync(csvPath, [header, ...lines].join('\n') + '\n', 'utf8')
  console.error(`Wrote ${csvPath}`)
}
