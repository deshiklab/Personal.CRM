import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { CrmProvider } from './store'
import './index.css'

createRoot(document.getElementById('root')).render(
  <HashRouter>
    <CrmProvider>
      <App />
    </CrmProvider>
  </HashRouter>
)

/* PWA: register the offline service worker (production, http(s) only) */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
