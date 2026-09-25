#!/usr/bin/env node
/**
 * Launch readiness check — no secrets, no network required beyond local files.
 *
 *   node scripts/launch-check.mjs
 *   npm run launch:check
 *
 * Exit 0 = repo is ready for owner ops. Exit 1 = fix listed gaps first.
 */
import { existsSync, readFileSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const req = createRequire(join(ROOT, 'package.json'))
let pass = 0, fail = 0, warn = 0
const ok = (n, c, extra = '') => {
  if (c) { pass++; console.log('  ✓', n) }
  else { fail++; console.log('  ✗', n, extra) }
}
const soft = (n, c, extra = '') => {
  if (c) { pass++; console.log('  ✓', n) }
  else { warn++; console.log('  ⚠', n, extra) }
}

const read = rel => {
  const p = join(ROOT, rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}
const size = rel => {
  const p = join(ROOT, rel)
  return existsSync(p) ? statSync(p).size : 0
}

console.log('\nPersonal CRM · launch readiness\n')

/* ── versions aligned ── */
const pkg = JSON.parse(read('package.json') || '{}')
const brand = read('src/brand.js')
const gradle = read('android/app/build.gradle')
const ios = read('ios/App/App.xcodeproj/project.pbxproj')
const brandV = (brand.match(/version:\s*'([^']+)'/) || [])[1]
const vn = (gradle.match(/versionName\s+"([^"]+)"/) || [])[1]
const vc = (gradle.match(/versionCode\s+(\d+)/) || [])[1]
const iosM = [...ios.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map(m => m[1])
const iosC = [...ios.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map(m => m[1])
ok('package.json version 2.0.0', pkg.version === '2.0.0', pkg.version)
ok('brand.version matches package', brandV === pkg.version, brandV)
ok('Android versionName matches', vn === pkg.version, vn)
ok('Android versionCode ≥ 4', Number(vc) >= 4, vc)
ok('iOS MARKETING_VERSION matches', iosM.every(v => v === pkg.version), iosM.join(','))
ok('iOS CURRENT_PROJECT_VERSION set', iosC.length > 0 && iosC.every(v => Number(v) >= 1), iosC.join(','))

/* ── identity ── */
ok('appId com.bitscol.personalcrm', /com\.bitscol\.personalcrm/.test(read('capacitor.config.json')))
ok('Play product id in entitlements', /personal_crm_pro_lifetime/.test(read('src/lib/entitlements.js')))
ok('BITSCOL credit fields in brand', /sales@bitscol\.com/.test(brand) && /bitscol\.com/.test(brand) && /\+8801711853769/.test(brand))
ok('proWebUrl field exists (empty until MoR)', /proWebUrl:/.test(brand))
soft('proWebUrl still empty (set when MoR live)', /proWebUrl:\s*''/.test(brand) || /proWebUrl:\s*""/.test(brand), 'ok if MoR not live yet')

/* ── store assets ── */
const shots = [
  'feature-graphic.png', 'icon-512.png',
  'screenshot-01-dashboard.png', 'screenshot-02-contacts.png',
  'screenshot-03-contact-drawer.png', 'screenshot-04-followups.png',
  'screenshot-05-tasks.png', 'screenshot-06-inbox.png',
  'screenshot-07-pro.png', 'screenshot-08-about.png',
]
for (const f of shots) {
  const rel = `docs/store-assets/${f}`
  ok(`asset ${f}`, size(rel) > 1000, `${size(rel)} B`)
}

/* ── docs ── */
const docs = [
  'OPS-LAUNCH.md', 'CLOSED-TEST.md', 'TESTER-EMAILS.md', 'PLAY-BILLING.md',
  'WEB-KEYS-MOR.md', 'STORE-LISTING.md', 'IOS.md', 'PHASE3.md',
  'ENCRYPTED-BACKUP.md', 'LOCALE.md', 'WELCOME-ONBOARD.md',
]
for (const d of docs) ok(`docs/${d}`, existsSync(join(ROOT, 'docs', d)))

/* ── scripts ── */
ok('build-aab.sh', existsSync(join(ROOT, 'scripts/build-aab.sh')))
ok('make-release-keystore.sh', existsSync(join(ROOT, 'scripts/make-release-keystore.sh')))
ok('mint-keys.mjs', existsSync(join(ROOT, 'scripts/mint-keys.mjs')))
ok('capture-store-shots.mjs', existsSync(join(ROOT, 'scripts/capture-store-shots.mjs')))
ok('ios platform project', existsSync(join(ROOT, 'ios/App/App.xcodeproj/project.pbxproj')))
ok('android platform project', existsSync(join(ROOT, 'android/app/build.gradle')))

/* ── legal pages ── */
ok('public/privacy.html', size('public/privacy.html') > 500)
ok('public/terms.html', size('public/terms.html') > 500)

/* ── build present ── */
soft('dist/ built', existsSync(join(ROOT, 'dist/index.html')), 'run npm run build')
soft('no keystore in tree', !existsSync(join(ROOT, 'android/upload-keystore.jks')) && !existsSync(join(ROOT, 'android/release.keystore')), 'good — never commit')

/* ── mint smoke (does not write files) ── */
try {
  const { spawnSync } = await import('child_process')
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts/mint-keys.mjs'), '--count', '1'], {
    encoding: 'utf8', cwd: ROOT, timeout: 15000,
  })
  const out = (r.stdout || '') + (r.stderr || '')
  ok('mint-keys produces PCRM1 key', /PCRM1-[A-Za-z0-9_-]+/.test(out), out.slice(0, 120))
} catch (e) {
  ok('mint-keys produces PCRM1 key', false, String(e.message || e))
}

/* ── .gitignore guards ── */
const gi = read('.gitignore')
ok('.gitignore blocks keystores', /\*\.keystore|\*\.jks|upload-keystore/.test(gi))
ok('.gitignore blocks probe scratch', /probe-\*\.mjs/.test(gi))

console.log(`\n${pass} passed · ${fail} failed · ${warn} warnings\n`)
if (fail) {
  console.log('Fix failures before Play upload. Warnings are expected pre-MoR / pre-build.\n')
  console.log('Owner day-1: docs/OPS-LAUNCH.md · docs/LAUNCH-DAY1.md\n')
  process.exit(1)
}
console.log('Repo is launch-ready. Next is YOUR ops (keystore → Play → testers → MoR).')
console.log('See docs/LAUNCH-DAY1.md\n')
process.exit(0)
