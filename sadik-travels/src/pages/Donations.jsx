import { useEffect, useMemo, useRef, useState } from 'react'
import { db, collection, query, orderBy, onSnapshot } from '../store/firestore'
import { rtdb, ref, onValue, update } from '../store/database'
import { MONTHS, monthKey, formatCurrency, formatDateTime, yearRange } from '../utils'

export default function Donations() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [monthIdx, setMonthIdx] = useState(now.getMonth()) // 0..11
  const month = monthKey(year, monthIdx + 1)

  const [funders, setFunders] = useState([])
  const [existing, setExisting] = useState({})
  const [existingLoaded, setExistingLoaded] = useState(false)

  // id -> boolean (checked) and id -> string (amount input)
  const [checked, setChecked] = useState({})
  const [amounts, setAmounts] = useState({})

  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // 1) Load funders from Firestore (single source of truth for names).
  useEffect(() => {
    const q = query(collection(db, 'funders'), orderBy('name'))
    const unsub = onSnapshot(
      q,
      (snap) => setFunders(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => setError(e.message),
    )
    return unsub
  }, [])

  // 2) Load existing donation entries for the selected month from Realtime DB.
  useEffect(() => {
    setExistingLoaded(false)
    setExisting({})
    setMessage('')
    setError('')
    const monthRef = ref(rtdb, `donations/${month}`)
    const unsub = onValue(
      monthRef,
      (snap) => {
        setExisting(snap.val() || {})
        setExistingLoaded(true)
      },
      (e) => {
        setError(e.message)
        setExistingLoaded(true)
      },
    )
    return unsub
  }, [month])

  // 3) Once the month's data arrives, seed the form (only once per month).
  const seededFor = useRef('')
  useEffect(() => {
    if (!existingLoaded) return
    if (seededFor.current === month) return
    seededFor.current = month

    const chk = {}
    const amt = {}
    Object.entries(existing).forEach(([id, entry]) => {
      chk[id] = true
      amt[id] = entry.amount != null ? String(entry.amount) : ''
    })
    setChecked(chk)
    setAmounts(amt)
  }, [existingLoaded, existing, month])

  const toggle = (id) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))

  const setAmount = (id, value) =>
    setAmounts((prev) => ({ ...prev, [id]: value }))

  const selectAll = () => {
    const all = {}
    funders.forEach((f) => {
      all[f.id] = true
    })
    setChecked(all)
  }

  const clearAll = () => {
    setChecked({})
  }

  const selectedIds = useMemo(
    () => Object.keys(checked).filter((id) => checked[id]),
    [checked],
  )

  const selectedTotal = useMemo(
    () => selectedIds.reduce((sum, id) => sum + (Number(amounts[id]) || 0), 0),
    [selectedIds, amounts],
  )

  const savedTotal = useMemo(
    () => Object.values(existing).reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [existing],
  )

  // Entries that were saved for this month but whose funder no longer exists.
  const orphanEntries = useMemo(() => {
    const ids = new Set(funders.map((f) => f.id))
    return Object.entries(existing)
      .filter(([id]) => !ids.has(id))
      .map(([id, entry]) => ({ id, ...entry }))
  }, [existing, funders])

  function shiftMonth(delta) {
    let idx = monthIdx + delta
    let y = year
    if (idx < 0) {
      idx = 11
      y -= 1
    } else if (idx > 11) {
      idx = 0
      y += 1
    }
    setMonthIdx(idx)
    setYear(y)
  }

  function goToThisMonth() {
    const d = new Date()
    setMonthIdx(d.getMonth())
    setYear(d.getFullYear())
  }

  async function save() {
    setMessage('')
    setError('')

    const ids = selectedIds
    if (ids.length === 0) {
      setError('Select at least one funder to save.')
      return
    }

    // Validate amounts.
    const invalid = ids.filter((id) => {
      const v = Number(amounts[id])
      return !v || v <= 0
    })
    if (invalid.length > 0) {
      setError('Please enter a valid amount (greater than 0) for every selected funder.')
      return
    }

    const toRemove = Object.keys(existing).filter((id) => !checked[id])
    if (toRemove.length > 0) {
      const ok = window.confirm(
        `Saving will remove ${toRemove.length} previously saved donor(s) from ${MONTHS[monthIdx]} ${year}.\n\nContinue?`,
      )
      if (!ok) return
    }

    setBusy(true)
    try {
      const funderMap = Object.fromEntries(funders.map((f) => [f.id, f]))
      const updates = {}

      ids.forEach((id) => {
        const f = funderMap[id]
        updates[`${id}/name`] = f?.name || existing[id]?.name || 'Funder'
        updates[`${id}/phone`] = f?.phone || existing[id]?.phone || ''
        updates[`${id}/amount`] = Number(amounts[id])
        updates[`${id}/savedAt`] = Date.now()
      })

      toRemove.forEach((id) => {
        updates[id] = null // null deletes the key in Realtime DB
      })

      await update(ref(rtdb, `donations/${month}`), updates)
      setMessage(
        `Saved ${ids.length} donor(s) for ${MONTHS[monthIdx]} ${year}.`,
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeEntry(id) {
    const ok = window.confirm(
      `Remove "${existing[id]?.name || 'this donor'}" from ${MONTHS[monthIdx]} ${year}?`,
    )
    if (!ok) return
    setMessage('')
    setError('')
    try {
      await update(ref(rtdb, `donations/${month}`), { [id]: null })
      setMessage('Donor removed.')
    } catch (err) {
      setError(err.message)
    }
  }

  const years = yearRange(6)

  return (
    <div>
      <div className="page-head">
        <h2>Monthly Donations</h2>
        <p>Select a month, tick the funders, enter each amount and save.</p>
      </div>

      {message && <div className="toast success">{message}</div>}
      {error && <div className="toast error">{error}</div>}

      <div className="card month-bar">
        <div className="month-nav">
          <button type="button" className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            ‹
          </button>

          <select value={monthIdx} onChange={(e) => setMonthIdx(Number(e.target.value))}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>

          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button type="button" className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
            ›
          </button>

          <button type="button" className="btn ghost" onClick={goToThisMonth}>
            This month
          </button>
        </div>

        <div className="month-summary">
          <span className="muted">Saved this month:</span>
          <strong>৳{formatCurrency(savedTotal)}</strong>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Funders — {MONTHS[monthIdx]} {year}</h3>
          <div className="head-actions">
            <span className="muted">{selectedIds.length} selected · ৳{formatCurrency(selectedTotal)}</span>
            <button type="button" className="btn ghost" onClick={selectAll}>Select all</button>
            <button type="button" className="btn ghost" onClick={clearAll}>Clear</button>
            <button
              type="button"
              className="btn primary"
              onClick={save}
              disabled={busy || !existingLoaded}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {funders.length === 0 ? (
          <p className="muted">No funders yet. Add funders on the “Funders” page first.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="check-col">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={funders.length > 0 && selectedIds.length === funders.length}
                      onChange={(e) => (e.target.checked ? selectAll() : clearAll())}
                    />
                  </th>
                  <th>Funder</th>
                  <th>Phone</th>
                  <th className="num">Amount (BDT)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {funders.map((f) => {
                  const isChecked = !!checked[f.id]
                  const isSaved = !!existing[f.id]
                  return (
                    <tr key={f.id} className={isChecked ? 'row-selected' : ''}>
                      <td className="check-col">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggle(f.id)}
                        />
                      </td>
                      <td className="strong">{f.name}</td>
                      <td>{f.phone || '—'}</td>
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
                          onChange={(e) => setAmount(f.id, e.target.value)}
                        />
                      </td>
                      <td>
                        {isSaved ? (
                          <span className="badge saved">Saved</span>
                        ) : (
                          <span className="badge pending">{isChecked ? 'Selected' : '—'}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {orphanEntries.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h3>Saved entries for removed funders</h3>
          </div>
          <p className="muted">
            These donors were saved for this month but no longer exist in your funders
            list. Remove them if they are no longer needed.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="num">Amount (BDT)</th>
                  <th>Saved</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orphanEntries.map((e) => (
                  <tr key={e.id}>
                    <td className="strong">{e.name || '—'}</td>
                    <td className="num strong">৳{formatCurrency(e.amount)}</td>
                    <td className="muted">{formatDateTime(e.savedAt)}</td>
                    <td className="actions-col">
                      <button className="btn small danger" onClick={() => removeEntry(e.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
