import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeTotals,
  monthKey,
  monthLabel,
  parseMonthKey,
  round2,
  shiftMonthKey,
  toMillis,
  toNumber,
} from '../src/store/totals.js'

const NOW = new Date('2026-09-15T10:00:00Z')

test('monthKey pads the month', () => {
  assert.equal(monthKey(2026, 1), '2026-01')
  assert.equal(monthKey(2026, 12), '2026-12')
  assert.equal(monthKey(2026, 9), '2026-09')
})

test('parseMonthKey round-trips and rejects garbage', () => {
  assert.deepEqual(parseMonthKey('2026-09'), { year: 2026, month: 9 })
  assert.equal(parseMonthKey('nonsense'), null)
  assert.equal(parseMonthKey('2026-13'), null)
  assert.equal(parseMonthKey(''), null)
})

test('shiftMonthKey wraps across year boundaries', () => {
  assert.equal(shiftMonthKey('2026-09', -1), '2026-08')
  assert.equal(shiftMonthKey('2026-01', -1), '2025-12')
  assert.equal(shiftMonthKey('2026-12', 1), '2027-01')
  assert.equal(shiftMonthKey('2026-09', 0), '2026-09')
  assert.equal(shiftMonthKey('2026-09', -13), '2025-08')
})

test('monthLabel renders a readable month', () => {
  assert.equal(monthLabel('2026-09'), 'September 2026')
  assert.equal(monthLabel('2026-01'), 'January 2026')
  assert.equal(monthLabel('bogus'), 'bogus')
})

test('toNumber tolerates strings, nulls and junk', () => {
  assert.equal(toNumber(1200), 1200)
  assert.equal(toNumber('1200.50'), 1200.5)
  assert.equal(toNumber(''), 0)
  assert.equal(toNumber(null), 0)
  assert.equal(toNumber(undefined), 0)
  assert.equal(toNumber(NaN), 0)
  assert.equal(toNumber('abc'), 0)
})

test('toMillis handles ms, ISO strings and Firestore Timestamps', () => {
  assert.equal(toMillis(1700000000000), 1700000000000)
  assert.equal(toMillis('2026-09-15T00:00:00.000Z'), Date.parse('2026-09-15T00:00:00.000Z'))
  assert.equal(toMillis({ toMillis: () => 42 }), 42)
  assert.equal(toMillis({ seconds: 2 }), 2000)
  assert.equal(toMillis(null), 0)
  assert.equal(toMillis('not a date'), 0)
})

test('round2 avoids float noise', () => {
  assert.equal(round2(0.1 + 0.2), 0.3)
  assert.equal(round2(1234.567), 1234.57)
  assert.equal(round2('10.005'), 10.01)
})

test('computeTotals sums RTDB-shaped months (full entries)', () => {
  const totals = computeTotals(
    [
      {
        key: '2026-09',
        entries: [
          { funderId: 'a', name: 'Ali', amount: 1000, savedAt: 1757900000000 },
          { funderId: 'b', name: 'Rahim', amount: '2500', savedAt: 1757900001000 },
        ],
      },
      {
        key: '2026-02',
        entries: [{ funderId: 'a', name: 'Ali', amount: 500, savedAt: 1739000000000 }],
      },
    ],
    { now: NOW },
  )

  assert.equal(totals.total, 4000)
  assert.equal(totals.totalThisMonth, 3500, 'September 2026 is the current month')
  assert.equal(totals.totalThisYear, 500, 'February is this year but not this month')
  assert.equal(totals.monthsWithData, 2)
  assert.equal(totals.entryCount, 3)
  assert.equal(totals.recent[0].name, 'Rahim', 'most recent save first')
  assert.equal(totals.byMonth.length, 2)
  assert.deepEqual(
    totals.byMonth.map((m) => m.key),
    ['2026-02', '2026-09'],
    'oldest first for charting',
  )
})

test('computeTotals uses pre-aggregated Firestore month docs', () => {
  const totals = computeTotals(
    [
      {
        key: '2026-09',
        total: 4200,
        count: 7,
        recent: [{ funderId: 'a', name: 'Ali', amount: 4200, savedAt: 1757900000000 }],
      },
      { key: '2025-11', total: 900, count: 2, recent: [] },
    ],
    { now: NOW },
  )
  assert.equal(totals.total, 5100)
  assert.equal(totals.totalThisMonth, 4200)
  assert.equal(totals.totalThisYear, 0, '2025-11 belongs to last year')
  assert.equal(totals.monthsWithData, 2)
  assert.equal(totals.entryCount, 9)
  assert.equal(totals.recent.length, 1)
})

test('computeTotals ignores last year when reporting this year', () => {
  const totals = computeTotals(
    [
      { key: '2025-12', entries: [{ funderId: 'a', amount: 100 }] },
      { key: '2026-08', entries: [{ funderId: 'a', amount: 200 }] },
      { key: '2026-09', entries: [{ funderId: 'a', amount: 300 }] },
    ],
    { now: NOW },
  )
  assert.equal(totals.total, 600)
  assert.equal(totals.totalThisYear, 200)
  assert.equal(totals.totalThisMonth, 300)
})

test('computeTotals on empty or malformed input is safe', () => {
  for (const input of [undefined, null, [], [null], [{ key: 'bad' }]]) {
    const totals = computeTotals(input, { now: NOW })
    assert.equal(totals.total, 0)
    assert.deepEqual(totals.recent, [])
    assert.deepEqual(totals.byMonth, [])
  }
})

test('recent list is capped', () => {
  const entries = Array.from({ length: 20 }, (_, i) => ({
    funderId: `f${i}`,
    name: `Funder ${i}`,
    amount: 10,
    savedAt: 1757900000000 + i,
  }))
  const totals = computeTotals([{ key: '2026-09', entries }], { now: NOW, limit: 5 })
  assert.equal(totals.recent.length, 5)
  assert.equal(totals.recent[0].name, 'Funder 19')
})
