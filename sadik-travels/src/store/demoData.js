// Browser-only demo store used when TURSO_DB_URL is not configured.
// Mirrors the subset of the /api the UI needs, backed by localStorage.
// Persists only in the current browser.

import { useEffect, useRef, useState } from 'react'

const LS_KEY = 'sadik-travels-demo-v2'
const USER_KEY = 'sadik-travels-demo-user-v2'

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_e) { /* ignore */ }
  return {
    funders: [],
    donations: {}, // month -> { [funderId]: { name, phone, amount, savedAt } }
    admins: [
      {
        id: 1,
        email: 'demo@example.com',
        displayName: 'Demo Admin',
        password: 'demo123',
        createdAt: Date.now(),
        lastLoginAt: null,
      },
    ],
    nextFunderId: 1,
    nextAdminId: 2,
  }
}

let state = load()

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch (_e) { /* ignore */ }
}

const listeners = new Set()
function emit() {
  persist()
  listeners.forEach((fn) => { try { fn() } catch (_e) { /* ignore */ } })
}
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function tick() { return new Promise((r) => setTimeout(r, 120)) }

// --------------- auth ---------------
export const demoAuth = {
  currentUser: (() => {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch (_e) { return null }
  })(),
  async login(email, password) {
    await tick()
    const e = String(email || '').trim().toLowerCase()
    const admin = state.admins.find((a) => a.email.toLowerCase() === e)
    if (!admin || admin.password !== password) {
      throw new Error('Incorrect email or password.')
    }
    admin.lastLoginAt = Date.now()
    const user = { id: admin.id, email: admin.email, displayName: admin.displayName || null }
    demoAuth.currentUser = user
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    emit()
    return { user }
  },
  async logout() {
    demoAuth.currentUser = null
    localStorage.removeItem(USER_KEY)
  },
}

// --------------- funders ---------------
export const demoFunders = {
  async list() {
    await tick()
    return [...state.funders].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  },
  async create({ name, phone, note }) {
    await tick()
    const f = {
      id: state.nextFunderId++,
      name: name.trim(),
      phone: (phone || '').trim(),
      note: (note || '').trim(),
      createdAt: Date.now(),
    }
    state.funders.push(f)
    emit()
    return f
  },
  async update(id, { name, phone, note }) {
    await tick()
    const f = state.funders.find((x) => x.id === Number(id))
    if (!f) throw new Error('Funder not found.')
    f.name = name.trim()
    f.phone = (phone || '').trim()
    f.note = (note || '').trim()
    emit()
    return { ok: true }
  },
  async remove(id) {
    await tick()
    state.funders = state.funders.filter((x) => x.id !== Number(id))
    // Remove orphan donation entries.
    for (const month of Object.keys(state.donations)) {
      delete state.donations[month][String(id)]
    }
    emit()
    return { ok: true }
  },
}

// --------------- donations ---------------
export const demoDonations = {
  async getMonth(month) {
    await tick()
    const entries = state.donations[month] || {}
    const funderIds = new Set(state.funders.map((f) => f.id))
    return Object.entries(entries).map(([fid, e]) => ({
      funderId: Number(fid),
      name: e.name,
      phone: e.phone || '',
      amount: Number(e.amount),
      savedAt: e.savedAt,
      orphan: !funderIds.has(Number(fid)),
    }))
  },
  async saveMonth(month, { updates, removes }) {
    await tick()
    if (!state.donations[month]) state.donations[month] = {}
    for (const u of updates) {
      const f = state.funders.find((x) => x.id === Number(u.funderId))
      if (!f) throw new Error(`Funder ${u.funderId} not found`)
      state.donations[month][String(u.funderId)] = {
        name: f.name,
        phone: f.phone || '',
        amount: Number(u.amount),
        savedAt: Date.now(),
      }
    }
    for (const id of removes || []) {
      delete state.donations[month][String(id)]
    }
    emit()
    return demoDonations.getMonth(month)
  },
  async getTotals() {
    await tick()
    const now = new Date()
    const yyyy = String(now.getFullYear())
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const thisMonth = `${yyyy}-${mm}`
    let total = 0, totalThisMonth = 0, totalThisYear = 0, donorMonths = 0
    const monthsSet = new Set()
    const recent = []
    for (const [month, entries] of Object.entries(state.donations)) {
      for (const e of Object.values(entries || {})) {
        const amt = Number(e.amount) || 0
        total += amt
        donorMonths += 1
        monthsSet.add(month)
        if (month === thisMonth) totalThisMonth += amt
        if (month.startsWith(yyyy)) totalThisYear += amt
        recent.push({ month, name: e.name, amount: amt, savedAt: e.savedAt })
      }
    }
    recent.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
    return {
      total, totalThisMonth, totalThisYear, donorMonths,
      monthsWithData: monthsSet.size,
      recent: recent.slice(0, 6),
    }
  },
}

// --------------- admins ---------------
export const demoAdmins = {
  async list() {
    await tick()
    return state.admins.map(({ password: _pw, ...rest }) => rest)
  },
  async create({ email, password, displayName }) {
    await tick()
    const e = String(email || '').trim().toLowerCase()
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('A valid email address is required.')
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.')
    if (state.admins.some((a) => a.email.toLowerCase() === e)) {
      throw new Error('An admin with that email already exists.')
    }
    const a = {
      id: state.nextAdminId++,
      email: e,
      displayName: (displayName || '').trim() || null,
      password,
      createdAt: Date.now(),
      lastLoginAt: null,
    }
    state.admins.push(a)
    emit()
    const { password: _pw, ...rest } = a
    return rest
  },
  async update(id, { email, displayName, password }) {
    await tick()
    const a = state.admins.find((x) => x.id === Number(id))
    if (!a) throw new Error('Admin not found.')
    if (email !== undefined) {
      const e = String(email).trim().toLowerCase()
      if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('A valid email address is required.')
      if (e !== a.email.toLowerCase() && state.admins.some((x) => x.id !== a.id && x.email.toLowerCase() === e)) {
        throw new Error('An admin with that email already exists.')
      }
      a.email = e
      if (demoAuth.currentUser && demoAuth.currentUser.id === a.id) {
        demoAuth.currentUser.email = e
        localStorage.setItem(USER_KEY, JSON.stringify(demoAuth.currentUser))
      }
    }
    if (displayName !== undefined) a.displayName = (displayName || '').trim() || null
    if (password) {
      if (String(password).length < 6) throw new Error('Password must be at least 6 characters.')
      a.password = String(password)
    }
    emit()
    return { ok: true }
  },
  async remove(id, currentId) {
    await tick()
    if (Number(id) === Number(currentId)) throw new Error('You cannot delete your own account while signed in.')
    if (state.admins.length <= 1) throw new Error('There must be at least one admin.')
    state.admins = state.admins.filter((x) => x.id !== Number(id))
    emit()
    return { ok: true }
  },
  async changePassword(id, currentPassword, newPassword) {
    await tick()
    const a = state.admins.find((x) => x.id === Number(id))
    if (!a) throw new Error('Admin not found.')
    if (a.password !== currentPassword) throw new Error('Current password is incorrect.')
    if (!newPassword || newPassword.length < 6) throw new Error('New password must be at least 6 characters.')
    a.password = newPassword
    emit()
    return { ok: true }
  },
}

// Simple demo-mode poller hook that re-runs on emit().
export function useDemo(fetcher, deps = []) {
  const [data, setData] = useState(undefined)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const v = await fetcherRef.current()
        if (!cancelled) { setData(v); setError(''); setLoading(false) }
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoading(false) }
      }
    }
    run()
    const unsub = subscribe(run)
    return () => { cancelled = true; unsub() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading }
}
