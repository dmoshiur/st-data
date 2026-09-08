export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** "2026" + "9" -> "2026-09" (used as the Realtime DB key for a month) */
export const monthKey = (year, month /* 1..12 */) =>
  `${year}-${String(month).padStart(2, '0')}`

/** 1234567 -> "1,234,567" */
export const formatNumber = (n) => (Number(n) || 0).toLocaleString('en-US')

/** Always render currency in English locale. */
export const formatCurrency = (n) => formatNumber(n)

export const formatDate = (ts) => {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export const formatDateTime = (ts) => {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Generate a list of years around the current year (for the month picker). */
export const yearRange = (span = 6) => {
  const now = new Date().getFullYear()
  const years = []
  for (let y = now - span; y <= now + 2; y++) years.push(y)
  return years
}
