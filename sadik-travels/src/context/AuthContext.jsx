import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { backend, isDemoMode } from '../store/index.js'
import { isFirebaseConfigured, firebaseEnv } from '../lib/firebase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = still resolving the session, null = signed out, object = signed in
  const [user, setUser] = useState(undefined)
  const [authError, setAuthError] = useState('')
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    let alive = true
    const unsub = backend.onAuthChange((next, err) => {
      if (!alive) return
      setUser(next)
      setAuthError(err || '')
    })
    return () => {
      alive = false
      if (typeof unsub === 'function') unsub()
    }
  }, [])

  // No administrators yet? Offer first-run setup instead of a dead sign-in
  // form. Runs for both backends — a brand-new Firebase project and a fresh
  // browser in demo mode are the same situation from the user's point of view.
  useEffect(() => {
    let alive = true
    if (user !== null && user !== undefined) {
      setNeedsSetup(false)
      return
    }
    backend
      .isAdminsEmpty()
      .then((empty) => {
        if (alive) setNeedsSetup(!!empty)
      })
      .catch(() => {
        // Rules may block an unauthenticated read. Fall back to the sign-in
        // form; VITE_SEED_ADMIN_* still bootstraps the first account.
        if (alive) setNeedsSetup(false)
      })
    return () => {
      alive = false
    }
  }, [user])

  const login = useCallback(async (email, password) => {
    const result = await backend.signIn(email, password)
    setUser(result.user)
    setNeedsSetup(false)
    return result.user
  }, [])

  const createFirst = useCallback(async (email, password, displayName) => {
    const result = await backend.createFirstAdmin(email, password, displayName)
    setUser(result.user)
    setNeedsSetup(false)
    return result.user
  }, [])

  const logout = useCallback(async () => {
    await backend.signOut()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      authError,
      needsSetup,
      configured: isFirebaseConfigured,
      isDemoMode,
      diagnostics: firebaseEnv,
      backendKind: backend.kind,
      login,
      createFirst,
      logout,
      setUser,
    }),
    [user, authError, needsSetup, login, createFirst, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
