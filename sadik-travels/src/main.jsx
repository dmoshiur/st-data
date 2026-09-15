import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ensurePersistence, firebaseEnv } from './lib/firebase.js'

// Make a misconfigured deploy say so in the console too, not just in the UI.
if (!firebaseEnv.ok) {
  // eslint-disable-next-line no-console
  console.warn(
    `[st-data] Firebase is not configured (missing: ${firebaseEnv.missing.join(', ') || 'none'}). ` +
      'Running in demo mode. Set VITE_FIREBASE_* env vars at BUILD time and redeploy.',
  )
}
void ensurePersistence()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
