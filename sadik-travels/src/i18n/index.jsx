import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { LANGUAGES, dictionaries, interpolate } from './dictionary.js'

const STORAGE_KEY = 'sadik-travels.lang'
const DEFAULT_LANG = 'en'

const I18nContext = createContext(null)

function detectInitial() {
  if (typeof window === 'undefined') return DEFAULT_LANG
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && dictionaries[stored]) return stored
  } catch (_e) {
    /* ignore */
  }
  const nav = (typeof navigator !== 'undefined' && navigator.language) || ''
  return nav.toLowerCase().startsWith('bn') ? 'bn' : DEFAULT_LANG
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectInitial)

  const setLang = useCallback((next) => {
    const code = dictionaries[next] ? next : DEFAULT_LANG
    setLangState(code)
    try {
      window.localStorage.setItem(STORAGE_KEY, code)
    } catch (_e) {
      /* ignore */
    }
  }, [])

  // Keep <html lang> in sync so screen readers and font fallbacks behave.
  useEffect(() => {
    const meta = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0]
    document.documentElement.lang = meta.code
    document.documentElement.dir = meta.dir
    document.documentElement.dataset.lang = meta.code
  }, [lang])

  const t = useCallback(
    (key, vars) => {
      const dict = dictionaries[lang] || dictionaries.en
      const value = dict[key] ?? dictionaries.en[key] ?? key
      return interpolate(value, vars)
    },
    [lang],
  )

  const value = useMemo(
    () => ({ lang, setLang, t, languages: LANGUAGES, isBengali: lang === 'bn' }),
    [lang, setLang, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

/** Convenience: just the translate function. */
export function useT() {
  return useI18n().t
}
