import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

function friendlyError(message) {
  const m = String(message || '').toLowerCase()
  if (m.includes('incorrect') || m.includes('invalid') || m.includes('not found') || m.includes('credential')) {
    return 'Incorrect email or password.'
  }
  if (m.includes('network')) return 'Network error. Check your internet connection.'
  return message || 'Sign in failed. Please try again.'
}

export default function Login({ configured }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(friendlyError(err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login">
      <div className="login-panel">
        <div className="login-brand">
          <div className="brand-logo lg">ST</div>
          <h1>Sadiq Travels</h1>
          <p>Donor &amp; monthly donation management</p>
        </div>
      </div>

      <div className="login-form-side">
        <form className="login-card" onSubmit={handleSubmit}>
          <h2>Admin Sign In</h2>
          <p className="muted">
            {configured
              ? 'Sign in with your admin account. Administrators are managed from the "Admins" page once signed in.'
              : 'Demo mode — use any funder data that will reset if you clear your browser. Default demo credentials are filled in below.'}
          </p>

          {!configured && (
            <div className="toast" style={{ background: '#eef2ff', color: '#3730a3', border: '1px solid #c7d2fe' }}>
              <strong>Demo credentials:</strong> <code>demo@example.com</code> / <code>demo123</code>
            </div>
          )}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={configured ? 'admin@example.com' : 'demo@example.com'}
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={configured ? '••••••••' : 'demo123'}
              required
            />
          </label>

          {error && <div className="toast error">{error}</div>}

          <button type="submit" className="btn primary block" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
