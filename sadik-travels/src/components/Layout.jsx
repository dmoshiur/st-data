import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/index.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { Icon } from './Icons.jsx'

const NAV = [
  { id: 'dashboard', icon: 'dashboard' },
  { id: 'funders', icon: 'funders' },
  { id: 'donations', icon: 'donations' },
  { id: 'admins', icon: 'admins' },
]

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

function ThemeToggle() {
  const { setMode, resolved } = useTheme()
  const { t } = useI18n()
  // Toggle from the *resolved* theme, not from "auto" — otherwise the first
  // click looks dead when auto already resolves to light.
  const next = () => setMode(resolved === 'dark' ? 'light' : 'dark')
  const label = resolved === 'dark' ? t('themeDark') : t('themeLight')
  const other = resolved === 'dark' ? t('themeLight') : t('themeDark')
  return (
    <button
      type="button"
      className="icon-action"
      onClick={next}
      title={`${t('theme')}: ${label} — ${other}`}
      aria-label={`${t('theme')}: ${label}`}
    >
      <Icon name={resolved === 'dark' ? 'moon' : 'sun'} size={17} />
    </button>
  )
}

function LanguageToggle() {
  const { lang, setLang, languages, t } = useI18n()
  return (
    <div className="lang-toggle" role="group" aria-label={t('language')}>
      {languages.map((l) => (
        <button
          key={l.code}
          type="button"
          className={`lang-btn ${lang === l.code ? 'active' : ''}`}
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          title={l.label}
        >
          {l.native}
        </button>
      ))}
    </div>
  )
}

function ConnectionPill() {
  const { configured, diagnostics } = useAuth()
  const online = useOnline()
  const { t } = useI18n()

  if (!configured) {
    return (
      <span className="pill-status demo" title={t('demoBannerBody')}>
        <span className="status-dot" />
        {t('demoMode')}
      </span>
    )
  }
  if (!online) {
    return (
      <span className="pill-status offline" title={t('offline')}>
        <Icon name="cloudOff" size={14} />
        {t('offline')}
      </span>
    )
  }
  return (
    <span className="pill-status live" title={`${t('online')} · ${diagnostics.source}`}>
      <span className="status-dot pulse" />
      {t('online')}
    </span>
  )
}

export default function Layout({ page, setPage, children }) {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    setNavOpen(false)
  }, [page])

  useEffect(() => {
    if (!navOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  const initials = (user?.displayName || user?.email || 'A')
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')

  return (
    <div className={`app ${navOpen ? 'nav-open' : ''}`}>
      <a className="skip-link" href="#main-content">
        {t('skipToContent')}
      </a>

      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      <aside className="sidebar" aria-label={t('appName')}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="40" height="40">
              <defs>
                <linearGradient id="stg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#e7c46a" />
                  <stop offset="100%" stopColor="#b8892a" />
                </linearGradient>
              </defs>
              <path
                d="M24 3.5 6 10.5v13.9c0 10.3 7.3 18.6 18 22.1 10.7-3.5 18-11.8 18-22.1V10.5L24 3.5Z"
                fill="none"
                stroke="url(#stg)"
                strokeWidth="2.2"
              />
              <path
                d="M15 30.5c3.2 1.9 6.1 2.4 9 .6 3.4-2.1 3.6-6 .6-7.6-2.6-1.4-5 .1-4.4 2.2"
                fill="none"
                stroke="url(#stg)"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path d="M24 12.5v6" stroke="url(#stg)" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </span>
          <div className="brand-text">
            <div className="brand-name">{t('appName')}</div>
            <div className="brand-sub">{t('appTagline')}</div>
          </div>
          <button
            type="button"
            className="icon-action nav-close"
            onClick={() => setNavOpen(false)}
            aria-label={t('close')}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <nav className="nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`nav-item ${page === n.id ? 'active' : ''}`}
              onClick={() => setPage(n.id)}
              aria-current={page === n.id ? 'page' : undefined}
            >
              <Icon name={n.icon} size={18} />
              <span>{t(`nav_${n.id}`)}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="admin-chip">
            <span className="avatar">{initials}</span>
            <span className="admin-info">
              <span className="admin-email" title={user?.email}>
                {user?.displayName || user?.email}
              </span>
              <span className="admin-role">{user?.email}</span>
            </span>
          </div>
          <button type="button" className="btn ghost block signout" onClick={logout}>
            <Icon name="logout" size={16} />
            {t('signOut')}
          </button>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <button
            type="button"
            className="icon-action nav-open"
            onClick={() => setNavOpen(true)}
            aria-label={t('nav_toggle')}
          >
            <Icon name="menu" size={20} />
          </button>

          <h1 className="page-title">{t(`nav_${page}`)}</h1>

          <div className="topbar-actions">
            <ConnectionPill />
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>

        <main className="content" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}
