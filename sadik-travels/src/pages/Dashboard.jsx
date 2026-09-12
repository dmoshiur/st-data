import { useMemo } from 'react'
import { useFunders, useTotals } from '../store/database'
import { formatCurrency, formatDateTime, MONTHS } from '../utils'

export default function Dashboard() {
  const { data: funders = [], error: fe, loading: fl } = useFunders()
  const { data: totals, error: te, loading: tl } = useTotals()

  const error = fe || te
  const loading = fl || tl || !totals

  const cards = totals
    ? [
        { label: 'Total Funders', value: funders.length, hint: 'Active names in your list' },
        { label: 'This Month', value: `৳${formatCurrency(totals.totalThisMonth)}`, hint: 'Donations received' },
        { label: 'This Year', value: `৳${formatCurrency(totals.totalThisYear)}`, hint: 'Donations received' },
        { label: 'All Time', value: `৳${formatCurrency(totals.total)}`, hint: `${totals.monthsWithData} month(s) with donations` },
      ]
    : []

  const recent = useMemo(() => {
    if (!totals) return []
    return (totals.recent || []).map((r) => {
      const [y, m] = (r.month || '').split('-')
      const label = y && m ? `${MONTHS[Number(m) - 1]} ${y}` : r.month
      return { ...r, label }
    })
  }, [totals])

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
            {recent.length === 0 ? (
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
                    {recent.map((r, i) => (
                      <tr key={`${r.month}-${r.funderId}-${i}`}>
                        <td className="strong">{r.name || '—'}</td>
                        <td>{r.label}</td>
                        <td className="num strong">৳{formatCurrency(r.amount)}</td>
                        <td className="muted">{formatDateTime(r.savedAt)}</td>
                      </tr>
                    ))}
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
