#!/usr/bin/env node
/* Run the Phase 0/1 probe suite against a local static build.
 *
 * Usage:
 *   node scripts/run-probes.mjs            # serve dist/ on :5173, run all
 *   node scripts/run-probes.mjs --ci       # same, exit non-zero on any fail
 *   node scripts/run-probes.mjs safety pin # run a subset by name
 *
 * Expects `dist/` to already exist (CI builds first). Spawns a tiny static
 * server if nothing is already listening on :5173.
 */
import { spawn } from 'child_process'
import { createServer } from 'http'
import { readFileSync, existsSync, statSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const DIST = join(ROOT, 'dist')
const PORT = 5173
const CI = process.argv.includes('--ci')

const ALL = [
  'probe-phase0.mjs',
  'probe-honest.mjs',
  'probe-registration.mjs',
  'probe-pin.mjs',
  'probe-safety.mjs',
  'probe-storage.mjs',
  'probe-contrast.mjs',
  'probe-kb.mjs',
  'probe-crud.mjs',
  'probe-legacy.mjs',
  'probe-responsive.mjs',
  'probe-mobileux.mjs',
]

const filter = process.argv.slice(2).filter(a => !a.startsWith('-'))
const list = filter.length
  ? ALL.filter(p => filter.some(f => p.includes(f)))
  : ALL

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html missing — run `npm run build` first')
  process.exit(2)
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
}

function startServer() {
  return new Promise((resolve, reject) => {
    const srv = createServer((req, res) => {
      let path = decodeURIComponent((req.url || '/').split('?')[0])
      if (path === '/') path = '/index.html'
      const file = join(DIST, path.replace(/^\//, ''))
      if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
        /* SPA fallback */
        const idx = readFileSync(join(DIST, 'index.html'))
        res.writeHead(200, { 'content-type': 'text/html' }); res.end(idx); return
      }
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
      res.end(readFileSync(file))
    })
    srv.on('error', err => {
      if (err.code === 'EADDRINUSE') resolve(null)   // something already serves :5173
      else reject(err)
    })
    srv.listen(PORT, '127.0.0.1', () => resolve(srv))
  })
}

const runOne = file => new Promise(resolve => {
  const child = spawn(process.execPath, [join(ROOT, file)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
  })
  let out = ''
  child.stdout.on('data', d => { out += d; process.stdout.write(d) })
  child.stderr.on('data', d => { out += d; process.stderr.write(d) })
  child.on('close', code => resolve({ file, code: code ?? 1, out }))
})

const srv = await startServer()
console.log(srv ? `serving dist/ on :${PORT}` : `reusing existing server on :${PORT}`)
console.log(`running ${list.length} probe(s)\n`)

const results = []
for (const f of list) {
  console.log(`\n══ ${f} ══`)
  results.push(await runOne(f))
}

if (srv) srv.close()

const failed = results.filter(r => r.code !== 0)
console.log('\n──────── summary ────────')
for (const r of results) {
  const tag = r.code === 0 ? 'PASS' : 'FAIL'
  const m = r.out.match(/ALL GREEN[^\n]*|FAILURES[^\n]*|NO OVERFLOW[^\n]*|LEGACY MIGRATION OK|errors: \d+/)
  console.log(`  ${tag.padEnd(4)}  ${r.file}${m ? '  · ' + m[0] : ''}`)
}
console.log(`\n${failed.length === 0 ? 'ALL SUITES GREEN' : failed.length + ' suite(s) failed'} — ${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length && CI ? 1 : failed.length ? 1 : 0)
