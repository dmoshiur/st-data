import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { backend } from '../store/index.js'
import { useI18n } from '../i18n/index.jsx'
import { Icon } from '../components/Icons.jsx'
import { useToast } from '../components/Feedback.jsx'

export default function Login() {
  const { login, createFirst, configured, needsSetup, authError, isDemoMode } = useAuth()
  const { t } = useI18n()
  const toast = useToast()

  // 'auto' follows whatever the backend reports (setup when no admin exists yet)
  const [mode, setMode] = useState('auto')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState(authError || '')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const setupMode = needsSetup && mode !== 'signin'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError(t('funderNameRequired'))
      return
    }
    setBusy(true)
    try {
      if (setupMode) await createFirst(email.trim(), password, name.trim())
      else await login(email.trim(), password)
    } catch (err) {
      setError(err?.message || t('signIn'))
    } finally {
      setBusy(false)
    }
  }

  async function sendReset() {
    if (!email.trim()) {
      setError(t('emailPlaceholder'))
      return
    }
    setBusy(true)
    try {
      await backend.sendPasswordReset(email.trim())
      toast.success(t('resetSent', { email: email.trim() }))
    } catch (err) {
      setError(err?.message || 'Could not send the reset email.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-stage">
        <div className="login-ornament" aria-hidden="true">
          <svg viewBox="0 0 200 200" width="200" height="200">
            <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="1" opacity=".35" />
            <circle cx="100" cy="100" r="76" fill="none" stroke="currentColor" strokeWidth="1" opacity=".22" />
            <path
              d="M100 22c30 22 44 46 44 78s-14 56-44 78c-30-22-44-46-44-78s14-56 44-78Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              opacity=".28"
            />
          </svg>
        </div>

        <div className="login-brand">
          <span className="brand-mark lg" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="64" height="64">
              <defs>
                <linearGradient id="stg-lg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f0d68f" />
                  <stop offset="100%" stopColor="#c08f2d" />
                </linearGradient>
              </defs>
              <path
                d="M24 3.5 6 10.5v13.9c0 10.3 7.3 18.6 18 22.1 10.7-3.5 18-11.8 18-22.1V10.5L24 3.5Z"
                fill="none"
                stroke="url(#stg-lg)"
                strokeWidth="1.8"
              />
              <path
                d="M15 30.5c3.2 1.9 6.1 2.4 9 .6 3.4-2.1 3.6-6 .6-7.6-2.6-1.4-5 .1-4.4 2.2"
                fill="none"
                stroke="url(#stg-lg)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path d="M24 12.5v6" stroke="url(#stg-lg)" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </span>
          <p className="invocation">{t('invocation')}</p>
          <h1>{t('appName')}</h1>
          <p className="login-tagline">{t('appTagline')}</p>
        </div>
      </div>

      <div className="login-form-side">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <h2>{setupMode ? t('createFirstAdmin') : t('adminSignIn')}</h2>
          <p className="muted">{setupMode ? t('createFirstAdminHint') : ''}</p>

          {!configured && (
            <div className="notice demo">
              <Icon name="info" size={16} />
              <span>{isDemoMode ? t('demoBannerBody') : t('demoBannerTitle')}</span>
            </div>
          )}

          {setupMode && (
            <label className="field">
              <span>{t('firstName')}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          )}

          <label className="field">
            <span>{t('email')}</span>
            <div className="input-affix">
              <Icon name="mail" size={16} />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                required
              />
            </div>
          </label>

          <label className="field">
            <span>{t('password')}</span>
            <div className="input-affix">
              <Icon name="key" size={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={setupMode ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordPlaceholder')}
                minLength={setupMode ? 6 : undefined}
                required
              />
              <button
                type="button"
                className="affix-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('close') : t('password')}
              >
                {showPassword ? <Icon name="close" size={15} /> : <Icon name="search" size={15} />}
              </button>
            </div>
          </label>

          {error && (
            <div className="notice error" role="alert">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn primary block lg" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner sm" />
                {setupMode ? t('creating') : t('signingIn')}
              </>
            ) : setupMode ? (
              t('createAccount')
            ) : (
              t('signIn')
            )}
          </button>

          <div className="login-foot">
            {needsSetup ? (
              <button
                type="button"
                className="link-btn"
                onClick={() => setMode(mode === 'signin' ? 'auto' : 'signin')}
              >
                {setupMode ? t('alreadyHaveAccount') : t('noAccountYet')}
              </button>
            ) : (
              <button type="button" className="link-btn" onClick={sendReset} disabled={busy}>
                {t('forgotPassword')}
              </button>
            )}
          </div>
        </form>

        <p className="login-legal">
          {configured ? `Firebase · ${t('online')}` : t('demoMode')}
        </p>
      </div>
    </div>
  )
}
