/* ── Product & publisher identity ─────────────────────────────────────────
 * Single source of truth for the app name, version and the publisher credit
 * shown in the app, the store listing and the legal pages.
 * Keep these in sync with: package.json · android/app/build.gradle · README. */

export const BRAND = {
  app: 'Personal CRM',
  publisher: 'BITSCOL',
  website: 'https://www.bitscol.com',
  websiteLabel: 'www.bitscol.com',
  email: 'sales@bitscol.com',
  mobile: '+8801711853769',
  mobileLabel: '+880 1711-853769',
  year: 2026,
  version: '2.0.0',
}

export const COPYRIGHT = `© ${BRAND.year} ${BRAND.publisher}. All rights reserved.`

/* Public URLs — hosted on GitHub Pages next to the app build. */
export const LEGAL_URLS = {
  privacy: 'https://deshiklab.github.io/Personal.CRM/privacy.html',
  terms: 'https://deshiklab.github.io/Personal.CRM/terms.html',
}

/* Third-party licences we ship (runtime + bundled build tooling). */
export const THIRD_PARTY = [
  { name: 'React',        license: 'MIT',        url: 'https://github.com/facebook/react' },
  { name: 'React DOM',    license: 'MIT',        url: 'https://github.com/facebook/react' },
  { name: 'React Router', license: 'MIT',        url: 'https://github.com/remix-run/react-router' },
  { name: 'Lucide Icons', license: 'ISC',        url: 'https://github.com/lucide-icons/lucide' },
  { name: 'Tailwind CSS', license: 'MIT',        url: 'https://github.com/tailwindlabs/tailwindcss' },
  { name: 'Capacitor',    license: 'MIT',        url: 'https://github.com/ionic-team/capacitor' },
  { name: 'Tesseract.js',  license: 'Apache-2.0', url: 'https://github.com/naptha/tesseract.js' },
  { name: 'Vite',         license: 'MIT',        url: 'https://github.com/vitejs/vite' },
]
