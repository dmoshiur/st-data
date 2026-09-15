import { useEffect, useMemo, useState } from 'react'
import { backend, useFunders, useMonthDonations } from '../store/index.js'
import { useI18n } from '../i18n/index.jsx'
import { useFormat } from '../i18n/format.js'
import { Icon } from '../components/Icons.jsx'
import { useToast, useConfirm } from '../components/Feedback.jsx'
import { Skeleton } from '../components/Loading.jsx'
import { MONTHS, currentMonthKey, monthKey, monthLabel, shiftMonthKey, yearRange } from '../utils.js'

export default function Donations() {
  const { t } = useI18n()
  const { money, number, dateTime } = useFormat()
  const toast = useToast()
  const confirm = useConfirm()

  const [month, setMonth] = useState(currentMonthKey)
  const { data: funders = [], error: funderError } = useFunders()
  const { data: entries = [], error: entryError, loading } = useMonthDonations(month)

  const [checked, setChecked] = useState({})
  const [amounts, setAmounts] = useState({})
  const [bulk, setBulk] = useState('')
  const [busy, setBusy] = useState(false)
  const [seededFor, setSeededFor] = useState('')

  const parsed = useMemo(() => {
    const [y, m] = month.split('-')
    return { year: Number(y), idx: Number(m) - 1 }
  }, [month])

  // Seed the form once per month when its saved rows arrive.
  useEffect(() => {
    if (loading || seededFor === month) return
    const chk = {}
    const amt = {}
    for (const e of entries || []) {
      chk[e.funderId] = true
      amt[e.funderId] = e.amount != null ? String(e.amount) : ''
    }
    setChecked(chk)
    setAmounts(amt)
    setBulk('')
    setSeededFor(month)
  }, [loading, entries, month, seededFor])

  const funderById = useMemo(() => {
    const map = {}
    for (const f of funders) map[f.id] = f
    return map
  }, [funders])

  const savedById = useMemo(() => {
    const map = {}
    for (const e of entries || []) map[e.funderId] = e
    return map
  }, [entries])

  const selectedIds = useMemo(
    () => Object.keys(checked).filter((id) => checked[id]),
    [checked],
  )
  const selectedTotal = useMemo(
    () => selectedIds.reduce((sum, id) => sum + (Number(amounts[id]) || 0), 0),
    [selectedIds, amounts],
  )
  const savedTotal = useMemo(
    () => (entries || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [entries],
  )
  const orphans = useMemo(
    () => (entries || []).filter((e) => !funderById[e.funderId]),
    [entries, funderById],
  )

  const toggle = (id) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  const selectAll = () => {
    const all = {}
    funders.forEach((f) => {
      all[f.id] = true
    })
    setChecked(all)
  }
  const clearAll = () => setChecked({})

  function applyBulk() {
    const value = Number(bulk)
    if (!value || value <= 0) return
    setAmounts((prev) => {
      const next = { ...prev }
      for (const id of selectedIds) next[id] = String(value)
      return next
    })
    toast.success(t('applyToSelected'))
  }

  async function save() {
    if (selectedIds.length === 0) {
      toast.error(t('selectAtLeastOne'))
      return
    }
    const invalid = selectedIds.some((id) => !(Number(amounts[id]) > 0))
    if (invalid) {
      toast.error(t('enterValidAmounts'))
      return
    }

    const savedIds = new Set(Object.keys(savedById))
    const removes = [...savedIds].filter((id) => !checked[id])
    if (removes.length > 0) {
      const ok = await confirm({
        title: t('save'),
        body: t('confirmRemoveSaved', { count: removes.length, month: monthLabel(month) }),
        confirmLabel: t('save'),
      })
      if (!ok) return
    }

    setBusy(true)
    try {
      const updates = selectedIds.map((id) => ({ funderId: id, amount: Number(amounts[id]) }))
      await backend.saveMonth(month, { updates, removes }, funderById)
      toast.success(t('savedDonors', { count: updates.length, month: monthLabel(month) }))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeEntry(funderId, name) {
    const ok = await confirm({
      title: t('donationsTitle'),
      body: t('confirmRemoveEntry', { name: name || '—', month: monthLabel(month) }),
      confirmLabel: t('donorRemoved'),
    })
    if (!ok) return
    try {
      await backend.removeEntry(month, funderId)
      toast.success(t('donorRemoved'))
    } catch (err) {
      toast.error(err.message)
    }
  }

  const error = funderError || entryError
  const years = yearRange(6)
  const allChecked = funders.length > 0 && selectedIds.length === funders.length

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h2>{t('donationsTitle')}</h2>
          <p>{t('donationsSub')}</p>
        </div>
        <button type="button" className="btn ghost" onClick={() => window.print()}>
          <Icon name="print" size={16} />
          {t('printSheet')}
        </button>
      </header>

      {error && (
        <div className="notice error" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      <section className="card month-bar">
        <div className="month-nav">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMonth(shiftMonthKey(month, -1))}
            aria-label={t('previousMonth')}
          >
            <Icon name="chevronLeft" size={18} />
          </button>
          <select
            value={parsed.idx}
            onChange={(e) => setMonth(monthKey(parsed.year, Number(e.target.value) + 1))}
            aria-label={t('month')}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
          <select value={parsed.year} onChange={(e) => setMonth(monthKey(Number(e.target.value), parsed.idx + 1))} aria-label="Year">
            {years.map((y) => (
              <option key={y} value={y}>
                {number(y)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMonth(shiftMonthKey(month, 1))}
            aria-label={t('nextMonth')}
          >
            <Icon name="chevronRight" size={18} />
          </button>
          <button type="button" className="btn ghost" onClick={() => setMonth(currentMonthKey())}>
            {t('goToThisMonth')}
          </button>
        </div>

        <div className="month-summary">
          <span className="muted">{t('savedThisMonth')}</span>
          <strong className="money">{money(savedTotal)}</strong>
        </div>
      </section>

      <section className="card">
        <div className="card-head wrap">
          <div>
            <h3>{monthLabel(month)}</h3>
            <span className="muted small">
              {t('selected', { count: number(selectedIds.length) })} · {money(selectedTotal)}
            </span>
          </div>
          <div className="head-actions">
            <button type="button" className="btn ghost sm" onClick={allChecked ? clearAll : selectAll}>
              {allChecked ? t('clearAll') : t('selectAll')}
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={save}
              disabled={busy || loading || funders.length === 0}
            >
              {busy ? (
                <>
                  <span className="spinner sm" />
                  {t('saving')}
                </>
              ) : (
                <>
                  <Icon name="check" size={16} />
                  {t('save')}
                </>
              )}
            </button>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="bulk-row">
            <label className="field grow">
              <span>{t('bulkAmount')}</span>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder="0"
              />
            </label>
            <button type="button" className="btn ghost" onClick={applyBulk} disabled={!Number(bulk)}>
              {t('applyToSelected')}
            </button>
          </div>
        )}

        {loading ? (
          <Skeleton rows={7} />
        ) : funders.length === 0 ? (
          <div className="empty">
            <Icon name="funders" size={26} />
            <p>{t('noFundersForMonth')}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="donation-table">
              <thead>
                <tr>
                  <th className="check-col">
                    <input
                      type="checkbox"
                      aria-label={t('selectAll')}
                      checked={allChecked}
                      onChange={(e) => (e.target.checked ? selectAll() : clearAll())}
                    />
                  </th>
                  <th>{t('funder')}</th>
                  <th>{t('phone')}</th>
                  <th className="num">{t('amountBdt')}</th>
                  <th>{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {funders.map((f) => {
                  const isChecked = !!checked[f.id]
                  const saved = savedById[f.id]
                  return (
                    <tr key={f.id} className={isChecked ? 'row-selected' : ''}>
                      <td className="check-col">
                        <input type="checkbox" checked={isChecked} onChange={() => toggle(f.id)} aria-label={f.name} />
                      </td>
                      <td className="strong">{f.name}</td>
                      <td className="muted">{f.phone || '—'}</td>
                      <td className="num">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          className="amount-input"
                          placeholder="0"
                          disabled={!isChecked}
                          value={amounts[f.id] ?? ''}
                          onChange={(e) => setAmounts((prev) => ({ ...prev, [f.id]: e.target.value }))}
                        />
                      </td>
                      <td>
                        {saved ? (
                          <span className="badge saved">{t('statusSaved')}</span>
                        ) : isChecked ? (
                          <span className="badge selected">{t('statusSelected')}</span>
                        ) : (
                          <span className="badge none">{t('statusUnpaid')}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {orphans.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h3>{t('orphansTitle')}</h3>
            <span className="pill">{number(orphans.length)}</span>
          </div>
          <p className="muted small">{t('orphansHint')}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('funder')}</th>
                  <th className="num">{t('amountBdt')}</th>
                  <th>{t('saved')}</th>
                  <th className="actions-col">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {orphans.map((e) => (
                  <tr key={e.funderId}>
                    <td className="strong">{e.name || '—'}</td>
                    <td className="num strong">{money(e.amount)}</td>
                    <td className="muted">{e.savedAt ? dateTime(e.savedAt) : '—'}</td>
                    <td className="actions-col">
                      <button
                        type="button"
                        className="btn small danger"
                        onClick={() => removeEntry(e.funderId, e.name)}
                      >
                        <Icon name="trash" size={14} />
                        {t('cancel')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
