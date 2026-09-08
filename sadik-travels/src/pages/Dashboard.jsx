import { useEffect, useMemo, useState } from 'react'
import { db, collection, query, orderBy, onSnapshot } from '../store/firestore'
import { rtdb, ref, onValue } from '../store/database'
import { monthKey, formatCurrency, formatDateTime, MONTHS } from '../utils'

export default function Dashboard() {
  const [funders, setFunders] = useState([])
  const [donations, setDonations] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'funders'), orderBy('name'))
    const unsub = onSnapshot(
      q,
      (snap) => setFunders(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => setError(e.message),
    )
    return unsub
  }, [])

  useEffect(() => {
    const unsub = onValue(
      ref(rtdb, 'donations'),
      (snap) => {
        setDonations(snap.val() || {})
        setLoading(false)
      },
      (e) => {
        setError(e.message)
        setLoading(false)
      },
    )
    return unsub
  }, [])

  const stats = useMemo(() => {
    const now = new Date()
    const thisMonthKey = monthKey(now.getFullYear(), now.getMonth() + 1)
    const thisYearKey = String(now.getFullYear())

    let total = 0
    let totalThisMonth = 0
    let totalThisYear = 0
    let donorMonths = 0
    let monthsWithData = 0
    const recent = []

    Object.entries(donations).forEach(([m, entries]) => {
      const values = Object.values(entries || {})
      const monthTotal = values.reduce((s, e) => s + (Number(e.amount) || 0), 0)
      total += monthTotal
      donorMonths += values.length
      if (monthTotal > 0) monthsWithData += 1
      if (m === thisMonthKey) totalThisMonth += monthTotal
      if (m.startsWith(thisYearKey)) totalThisYear += monthTotal
      values.forEach((e) => recent.push({ ...e, month: m }))
    })

    recent.sort((a, b) => (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0))

    return {
      total,
      totalThisMonth,
      totalThisYear,
      donorMonths,
      monthsWithData,
      recent: recent.slice(0, 6),
    }
  }, [donations])

  const cards = [
    { label: 'Total Funders', value: funders.length, hint: 'Active names in your list' },
    { label: 'This Month', value: `৳${formatCurrency(stats.totalThisMonth)}`, hint: 'Donations received' },
    { label: 'This Year', value: `৳${formatCurrency(stats.totalThisYear)}`, hint: 'Donations received' },
    { label: 'All Time', value: `৳${formatCurrency(stats.total)}`, hint: `${stats.monthsWithData} month(s) with donations` },
  ]

  return (
    <div>
      {error && <div className="toast error">{error}</div>}

      {loading ? (
        <div className="card empty-card">Loading…</div>
      ) : (
        <>
          <div className="stat-grid">
            {cards.map((c) => (
              <div className="stat-card" key={c.label}>
                <div className="stat-value">{c.value}</div>
                <div className="stat-label">{c.label}</div>
                <div className="stat-hint">{c.hint}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Recent Donations</h3>
            </div>
            {stats.recent.length === 0 ? (
              <p className="muted">No donations recorded yet. Go to the Donations page to get started.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Funder</th>
                      <th>Month</th>
                      <th className="num">Amount</th>
                      <th>Saved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent.map((r, i) => {
                      const [y, m] = (r.month || '').split('-')
                      const label = y && m ? `${MONTHS[Number(m) - 1]} ${y}` : r.month
                      return (
                        <tr key={`${r.month}-${i}`}>
                          <td className="strong">{r.name || '—'}</td>
                          <td>{label}</td>
                          <td className="num strong">৳{formatCurrency(r.amount)}</td>
                          <td className="muted">{formatDateTime(r.savedAt)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
