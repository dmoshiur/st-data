import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../store/api'
import { demoAuth } from '../store/demoData'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = still checking, null = signed out, object = signed in
  const [user, setUser] = useState(undefined)
  const [configured, setConfigured] = useState(undefined)

  const refresh = useCallback(async () => {
    try {
      if (configured === false) {
        setUser(demoAuth.currentUser)
        return
      }
      const me = await api.me()
      setUser(me.user || null)
    } catch (_e) {
      setUser(null)
    }
  }, [configured])

  useEffect(() => {
    let mounted = true
    async function init() {
      let cfg = false
      try {
        const h = await api.health()
        cfg = !!(h && h.configured && !h.demo)
      } catch (_e) { cfg = false }
      if (!mounted) return
      setConfigured(cfg)
      if (cfg) {
        try {
          const me = await api.me()
          setUser(me.user || null)
        } catch (_e) { setUser(null) }
      } else {
        setUser(demoAuth.currentUser)
      }
    }
    init()
    return () => { mounted = false }
  }, [])

  async function login(email, password) {
    if (configured) {
      const r = await api.login(email, password)
      setUser(r.user)
      return r.user
    }
    const r = await demoAuth.login(email, password)
    setUser(r.user)
    return r.user
  }

  async function logout() {
    if (configured) {
      try { await api.logout() } catch (_e) { /* ignore */ }
    } else {
      await demoAuth.logout()
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, configured, login, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
