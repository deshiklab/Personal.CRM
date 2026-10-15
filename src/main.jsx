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

/* PWA: register the offline service worker everywhere (http(s) only).
 * The worker passes dev-server modules through untouched, so registering in
 * development is safe — and makes the app installable from the preview. */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
