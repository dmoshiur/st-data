/**
 * Pure month/totals maths shared by the Firestore and Realtime-Database
 * donation backends. No Firebase imports, so it is covered by unit tests.
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "2026" + 9 -> "2026-09" */
export function monthKey(year, month /* 1..12 */) {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** "2026-09" -> { year: 2026, month: 9 } (month is 1-based) */
export function parseMonthKey(key) {
  const [y, m] = String(key || '').split('-')
  const year = Number(y)
  const month = Number(m)
  if (!year || !month || month < 1 || month > 12) return null
  return { year, month }
}

/** "2026-09" -> "September 2026" (falls back to the raw key) */
export function monthLabel(key) {
  const parsed = parseMonthKey(key)
  return parsed ? `${MONTH_NAMES[parsed.month - 1]} ${parsed.year}` : String(key || '—')
}

/** "2026-09" + -1 -> "2026-08" ; "2026-01" + -1 -> "2025-12" */
export function shiftMonthKey(key, delta) {
  const parsed = parseMonthKey(key)
  if (!parsed) return key
  let { year, month } = parsed
  month += delta
  while (month < 1) { month += 12; year -= 1 }
  while (month > 12) { month -= 12; year += 1 }
  return monthKey(year, month)
}

/** Coerce anything Firestore/RTDB hands back into a finite number. */
export function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return 0
}

/** Firestore serverTimestamp arrives as a Timestamp object; RTDB gives ms. */
export function toMillis(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) return n
    const t = Date.parse(value)
    return Number.isNaN(t) ? 0 : t
  }
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.seconds === 'number') return value.seconds * 1000
  return 0
}

/**
 * Accepts months in either shape:
 *   { key, entries: [...] }                     (Realtime Database: full data)
 *   { key, total, count, recent: [...] }        (Firestore: aggregate docs)
 *
 * @param {Array<object>} months
 * @param {{limit?: number, now?: Date}} [opts]
 * @returns {{total: number, totalThisYear: number, totalThisMonth: number,
 *            monthsWithData: number, entryCount: number, recent: Array<object>,
 *            byMonth: Array<{key: string, total: number, count: number}>}}
 */
export function computeTotals(months, { limit = 8, now = new Date() } = {}) {
  const list = Array.isArray(months) ? months : []
  const thisKey = monthKey(now.getFullYear(), now.getMonth() + 1)
  const yearPrefix = `${now.getFullYear()}-`

  let total = 0
  let totalThisYear = 0
  let totalThisMonth = 0
  let monthsWithData = 0
  let entryCount = 0
  const flat = []

  for (const m of list) {
    if (!m || typeof m.key !== 'string') continue
    const entries = Array.isArray(m.entries) ? m.entries : []
    const recent = Array.isArray(m.recent) && m.recent.length ? m.recent : entries
    const hasEntries = entries.length > 0 || recent.length > 0
    const monthTotal =
      typeof m.total === 'number' && Number.isFinite(m.total)
        ? m.total
        : entries.reduce((sum, e) => sum + toNumber(e && e.amount), 0)
    const count =
      typeof m.count === 'number' && Number.isFinite(m.count) && m.count > 0
        ? m.count
        : hasEntries
          ? entries.length || recent.length
          : 0

    if (monthTotal !== 0 || count > 0) monthsWithData += 1
    total += monthTotal
    entryCount += count
    if (m.key === thisKey) totalThisMonth += monthTotal
    else if (m.key.startsWith(yearPrefix)) totalThisYear += monthTotal

    for (const e of recent) {
      flat.push({
        month: m.key,
        funderId: (e && e.funderId) || '',
        name: (e && e.name) || '—',
        amount: toNumber(e && e.amount),
        savedAt: toMillis(e && e.savedAt),
      })
    }
  }

  const recent = flat
    .slice()
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, limit)

  // Per-month series, oldest first — used by the dashboard chart.
  const byMonth = list
    .filter((m) => m && typeof m.key === 'string' && /^\d{4}-\d{2}$/.test(m.key))
    .map((m) => {
      const entries = Array.isArray(m.entries) ? m.entries : []
      const total =
        typeof m.total === 'number' && Number.isFinite(m.total)
          ? m.total
          : entries.reduce((sum, e) => sum + toNumber(e && e.amount), 0)
      return { key: m.key, total, count: Array.isArray(m.recent) && m.recent.length ? m.recent.length : entries.length }
    })
    .sort((a, b) => a.key.localeCompare(b.key))

  return {
    total,
    // totalThisYear intentionally excludes the current month — the dashboard
    // shows it in its own card.
    totalThisYear,
    totalThisMonth,
    monthsWithData,
    entryCount,
    recent,
    byMonth,
  }
}

/** Round to 2 decimals without floating-point noise (0.1 + 0.2 === 0.30000000000000004). */
export function round2(n) {
  return Math.round((toNumber(n) + Number.EPSILON) * 100) / 100
}
