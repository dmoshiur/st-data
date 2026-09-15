import { useMemo } from 'react'
import { useFunders, useTotals } from '../store/index.js'
import { useI18n } from '../i18n/index.jsx'
import { useFormat } from '../i18n/format.js'
import { Icon } from '../components/Icons.jsx'
import { Skeleton } from '../components/Loading.jsx'
import { MONTH_NAMES, monthLabel, parseMonthKey, shiftMonthKey, currentMonthKey } from '../utils.js'

/** Zero-dependency SVG bar chart of the last `count` months. */
function MonthChart({ byMonth }) {
  const { t } = useI18n()
  const { money } = useFormat()

  const series = useMemo(() => {
    const map = new Map((byMonth || []).map((m) => [m.key, m.total]))
    const out = []
    let cursor = currentMonthKey()
    // walk backwards so the newest month is on the right
    for (let i = 0; i < 12; i++) {
      out.unshift({ key: cursor, total: map.get(cursor) || 0 })
      cursor = shiftMonthKey(cursor, -1)
    }
    return out
  }, [byMonth])

  const max = Math.max(1, ...series.map((s) => s.total))
  const W = 640
  const H = 140
  const pad = 6
  const barW = (W - pad * 2) / series.length

  return (
    <div className="chart" role="img" aria-label={t('recentDonations')}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart-svg">
        <line x1="0" y1={H - 22} x2={W} y2={H - 22} className="chart-axis" />
        {series.map((s, i) => {
          const h = s.total > 0 ? Math.max(3, ((H - 30) * s.total) / max) : 2
          const x = pad + i * barW + barW * 0.22
          const w = barW * 0.56
          const y = H - 22 - h
          const parsed = parseMonthKey(s.key)
          return (
            <g key={s.key} className="chart-col">
              <title>{`${monthLabel(s.key)} · ${money(s.total)}`}</title>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx="3"
                className={`chart-bar ${s.total > 0 ? 'on' : 'off'}`}
              />
              <text
                x={x + w / 2}
                y={H - 8}
                textAnchor="middle"
                className="chart-label"
              >
                {parsed ? MONTH_NAMES[parsed.month - 1].slice(0, 3) : ''}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function Dashboard() {
  const { t } = useI18n()
  const { money, dateTime } = useFormat()
  const funders = useFunders()
  const totals = useTotals()

  const error = funders.error || totals.error
  const loading = funders.loading || totals.loading || !totals.data

  const cards = useMemo(() => {
    const data = totals.data
    if (!data) return []
    return [
      {
        key: 'funders',
        label: t('totalFunders'),
        value: String((funders.data || []).length),
        hint: t('totalFundersHint'),
        icon: 'funders',
        accent: 'teal',
      },
      {
        key: 'month',
        label: t('thisMonth'),
        value: money(data.totalThisMonth),
        hint: t('collected'),
        icon: 'donations',
        accent: 'gold',
      },
      {
        key: 'year',
        label: t('thisYear'),
        value: money(data.totalThisYear),
        hint: t('collected'),
        icon: 'dashboard',
        accent: 'indigo',
      },
      {
        key: 'all',
        label: t('allTime'),
        value: money(data.total),
        hint: t('monthsWithData', { count: data.monthsWithData }),
        icon: 'check',
        accent: 'emerald',
      },
    ]
  }, [totals.data, funders.data, money, t])

  return (
    <div className="page">
      {error && (
        <div className="notice error" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      <section className="stat-grid">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div className="stat-card" key={i}>
                <Skeleton rows={3} />
              </div>
            ))
          : cards.map((c) => (
              <article className={`stat-card accent-${c.accent}`} key={c.key}>
                <div className="stat-top">
                  <span className="stat-icon">
                    <Icon name={c.icon} size={17} />
                  </span>
                  <span className="stat-label">{c.label}</span>
                </div>
                <div className="stat-value">{c.value}</div>
                <div className="stat-hint">{c.hint}</div>
              </article>
            ))}
      </section>

      <section className="card">
        <div className="card-head">
          <h3>{t('monthlyTrend')}</h3>
          <span className="pill">{t('entries', { count: totals.data?.entryCount ?? 0 })}</span>
        </div>
        {loading ? (
          <Skeleton rows={5} />
        ) : (
          <MonthChart byMonth={totals.data.byMonth} />
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h3>{t('recentDonations')}</h3>
        </div>
        {loading ? (
          <Skeleton rows={6} />
        ) : (totals.data.recent || []).length === 0 ? (
          <div className="empty">
            <Icon name="donations" size={26} />
            <p>{t('noDonationsYet')}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('funder')}</th>
                  <th>{t('month')}</th>
                  <th className="num">{t('amount')}</th>
                  <th>{t('saved')}</th>
                </tr>
              </thead>
              <tbody>
                {totals.data.recent.map((r, i) => (
                  <tr key={`${r.month}-${r.funderId}-${i}`}>
                    <td className="strong">{r.name}</td>
                    <td>{monthLabel(r.month)}</td>
                    <td className="num strong">{money(r.amount)}</td>
                    <td className="muted">{r.savedAt ? dateTime(r.savedAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
