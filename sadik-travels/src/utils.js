/**
 * Formatting + calendar helpers. Everything here is pure so it can be reused
 * in tests and in the print stylesheet.
 */
import { MONTH_NAMES, monthKey, monthLabel, parseMonthKey, shiftMonthKey } from './store/totals.js'

export const MONTHS = MONTH_NAMES

export { MONTH_NAMES, monthKey, monthLabel, parseMonthKey, shiftMonthKey }

/** 1234567 -> "1,234,567" */
export const formatNumber = (n) => (Number(n) || 0).toLocaleString('en-US')

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']

/** Swap ASCII digits for Bengali digits (used when the UI language is বাংলা). */
export function toBengaliDigits(value) {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)])
}

export const formatDate = (ts, locale = 'en-US') => {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
}

export const formatDateTime = (ts, locale = 'en-US') => {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Years around today, for the month picker. */
export const yearRange = (span = 6) => {
  const now = new Date().getFullYear()
  const years = []
  for (let y = now - span; y <= now + 2; y++) years.push(y)
  return years
}

/** Current month as "YYYY-MM". */
export const currentMonthKey = () => {
  const d = new Date()
  return monthKey(d.getFullYear(), d.getMonth() + 1)
}
