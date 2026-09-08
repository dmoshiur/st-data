import { useState } from 'react'
import { auth, signInWithEmailAndPassword, sendPasswordResetEmail } from '../store/auth'

function friendlyError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Incorrect email or password.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/user-disabled':
      return 'This account has been disabled.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection.'
    default:
      return 'Sign in failed. Please try again.'
  }
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  async function handleReset() {
    if (!email.trim()) {
      setError('Enter your email address first, then click "Forgot password?".')
      return
    }
    setError('')
    setResetBusy(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setResetSent(true)
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setResetBusy(false)
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
            Sign in with your admin account. Accounts are created in the
            Firebase Console (Authentication → Email/Password).
          </p>

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
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
              placeholder="••••••••"
              required
            />
          </label>

          {error && <div className="toast error">{error}</div>}
          {resetSent && (
            <div className="toast success">
              Password reset email sent. Check your inbox.
            </div>
          )}

          <button type="submit" className="btn primary block" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <button
            type="button"
            className="link-btn"
            onClick={handleReset}
            disabled={resetBusy}
          >
            {resetBusy ? 'Sending…' : 'Forgot password?'}
          </button>
        </form>
      </div>
    </div>
  )
}
