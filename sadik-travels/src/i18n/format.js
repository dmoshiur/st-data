import { useMemo } from 'react'
import { useI18n } from './index.jsx'
import { formatNumber, toBengaliDigits } from '../utils.js'

const LOCALE = { en: 'en-US', bn: 'bn-BD' }

/**
 * Locale-aware formatting. Amounts stay in Western digits with a ৳ prefix in
 * English, and switch to Bengali digits in বাংলা — the same ledger, two
 * readings, no ambiguity about the value.
 */
export function useFormat() {
  const { lang } = useI18n()
  return useMemo(() => {
    const locale = LOCALE[lang] || LOCALE.en
    const number = (n) => (lang === 'bn' ? toBengaliDigits(formatNumber(n)) : formatNumber(n))
    const money = (n) => `৳${number(n)}`
    const date = (ts) => {
      if (!ts) return '—'
      const d = new Date(ts)
      if (Number.isNaN(d.getTime())) return '—'
      const out = d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
      return lang === 'bn' ? toBengaliDigits(out) : out
    }
    const dateTime = (ts) => {
      if (!ts) return '—'
      const d = new Date(ts)
      if (Number.isNaN(d.getTime())) return '—'
      const out = d.toLocaleString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      return lang === 'bn' ? toBengaliDigits(out) : out
    }
    return { lang, locale, number, money, date, dateTime }
  }, [lang])
}
