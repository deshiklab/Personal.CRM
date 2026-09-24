import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { CrmProvider } from './store'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

createRoot(document.getElementById('root')).render(
  <HashRouter>
    {/* outside the provider so a failure while loading data is caught too —
        the crash screen tolerates a missing store and still offers support */}
    <ErrorBoundary>
      <CrmProvider>
        <App />
      </CrmProvider>
    </ErrorBoundary>
  </HashRouter>
)

/* PWA: register the offline service worker (production, http(s) only) */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
