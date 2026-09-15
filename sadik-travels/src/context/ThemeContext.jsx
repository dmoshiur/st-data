import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const KEY = 'sadik-travels.theme'
const ThemeContext = createContext(null)

function readInitial() {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored
  } catch (_e) {
    /* ignore */
  }
  return 'auto'
}

function systemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(typeof window === 'undefined' ? 'auto' : readInitial)
  const [system, setSystem] = useState(systemTheme)

  const setMode = useCallback((next) => {
    setModeState(next)
    try {
      localStorage.setItem(KEY, next)
    } catch (_e) {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const resolved = mode === 'auto' ? system : mode
    document.documentElement.dataset.theme = resolved
    document.documentElement.style.colorScheme = resolved
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0b1220' : '#f6f7f9')
  }, [mode, system])

  useEffect(() => {
    if (mode !== 'auto' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => setSystem(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  const value = useMemo(
    () => ({ mode, setMode, resolved: mode === 'auto' ? system : mode }),
    [mode, setMode, system],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
