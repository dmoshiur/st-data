import { useState } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { Icon } from './Icons.jsx'
import { useToast } from './Feedback.jsx'
import { CONFIG_KEYS } from '../lib/firebaseConfig.js'

const TEMPLATE = [
  'VITE_FIREBASE_API_KEY=AIzaSy...',
  'VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com',
  'VITE_FIREBASE_PROJECT_ID=your-app',
  'VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com',
  'VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890',
  'VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef',
  '# optional — only if you use the Realtime Database for donations',
  'VITE_FIREBASE_DATABASE_URL=https://your-app-default-rtdb.firebaseio.com',
  '# optional — auto-creates the first admin on an empty admins collection',
  'VITE_SEED_ADMIN_EMAIL=you@example.com',
  'VITE_SEED_ADMIN_PASSWORD=choose-a-strong-password',
].join('\n')

/**
 * Shown when Firebase is not reachable. It names the exact missing keys and
 * the exact env-var spelling, because the #1 cause of "works locally, dead on
 * Vercel" is an env var that is not prefixed with VITE_ (so Vite never inlines
 * it) or was added after the deploy was built.
 */
export default function ConfigBanner({ diagnostics }) {
  const { t } = useI18n()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const missing = diagnostics?.missing || []
  const present = Object.keys(CONFIG_KEYS).filter(
    (k) => diagnostics?.resolved?.[k] && !missing.includes(k),
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(TEMPLATE)
      toast.success(t('copied'))
    } catch (_e) {
      toast.error('Clipboard blocked by the browser — select the text below instead.')
    }
  }

  return (
    <div className="config-banner" role="alert">
      <div className="config-banner-head">
        <span className="config-banner-icon">
          <Icon name="alert" size={18} />
        </span>
        <div className="config-banner-text">
          <strong>{t('demoBannerTitle')}</strong>
          <span>{t('demoBannerBody')}</span>
        </div>
        <button type="button" className="btn small ghost" onClick={() => setOpen((v) => !v)}>
          {open ? t('close') : t('demoBannerHow')}
          <Icon name={open ? 'close' : 'info'} size={15} />
        </button>
      </div>

      {open && (
        <div className="config-banner-details">
          <div className="config-cols">
            <section>
              <h4>1 · Get the values</h4>
              <p>
                Firebase Console → <em>Project settings</em> → <em>Your apps</em> → Web app →{' '}
                <code>firebaseConfig</code>. Copy each value into the matching variable.
              </p>
              <h4>2 · Set them where you deploy</h4>
              <ul>
                <li>
                  <strong>Vercel:</strong> Project → Settings → Environment Variables → add each
                  key for <em>Production</em> + <em>Preview</em>, then <strong>Redeploy</strong>.
                  Vite reads them at build time, so a redeploy is mandatory.
                </li>
                <li>
                  <strong>Netlify:</strong> Site configuration → Environment variables → Redeploy.
                </li>
                <li>
                  <strong>Local:</strong> put them in <code>sadik-travels/.env</code> and restart{' '}
                  <code>npm run dev</code>.
                </li>
              </ul>
              <p className="warn">
                Every key <strong>must</strong> start with <code>VITE_</code>. Without the prefix
                Vite strips it from the client bundle and the app silently falls back to demo mode.
              </p>
            </section>

            <section>
              <h4>3 · Status on this page</h4>
              <ul className="config-status">
                {Object.keys(CONFIG_KEYS).map((key) => (
                  <li key={key} className={missing.includes(key) ? 'bad' : 'good'}>
                    <Icon name={missing.includes(key) ? 'close' : 'check'} size={14} />
                    <code>{CONFIG_KEYS[key][0]}</code>
                    {present.includes(key) && <span className="dim">set</span>}
                  </li>
                ))}
              </ul>
              <p className="dim">
                Source: <code>{diagnostics?.source || 'none'}</code>
                {diagnostics?.storageEngine === 'database'
                  ? ' · donations → Realtime Database'
                  : ' · donations → Firestore'}
              </p>

              <div className="config-actions">
                <button type="button" className="btn small ghost" onClick={copy}>
                  <Icon name="copy" size={15} />
                  {t('copyConfig')}
                </button>
              </div>
              <pre className="config-pre">{TEMPLATE}</pre>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
