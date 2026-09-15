/**
 * Browser-only demo backend.
 *
 * Used ONLY when no Firebase config is present, so the UI is still reviewable
 * on a fresh clone or a preview deployment. Data lives in localStorage and is
 * scoped to this browser — it is never a substitute for Firebase.
 *
 * It implements exactly the same surface as `firebaseBackend`, so the pages do
 * not care which one is active.
 */
import { computeTotals } from './totals.js'

const DATA_KEY = 'sadik-travels.demo.v3'
const USER_KEY = 'sadik-travels.demo.user.v3'

function blank() {
  return {
    funders: [],
    donations: {}, // "YYYY-MM" -> { funderId: { name, phone, amount, savedAt } }
    admins: [],
    nextFunderId: 1,
  }
}

function load() {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...blank(), ...parsed }
    }
  } catch (_e) {
    /* ignore */
  }
  return blank()
}

let state = typeof localStorage === 'undefined' ? blank() : load()

const channels = { funders: new Set(), months: new Map(), totals: new Set(), admins: new Set() }

function persist() {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(state))
  } catch (_e) {
    /* private mode / quota — keep going in memory */
  }
}

function tick(ms = 90) {
  return new Promise((r) => setTimeout(r, ms))
}

function emitFunders() {
  const rows = state.funders.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  channels.funders.forEach((cb) => cb(rows))
}
function emitMonth(month) {
  const rows = Object.entries(state.donations[month] || {}).map(([funderId, v]) => ({
    funderId,
    ...v,
  }))
  const set = channels.months.get(month)
  if (set) set.forEach((cb) => cb(rows))
}
function emitTotals() {
  const months = Object.entries(state.donations).map(([key, entries]) => ({
    key,
    entries: Object.entries(entries).map(([funderId, v]) => ({ funderId, ...v })),
  }))
  const totals = computeTotals(months)
  channels.totals.forEach((cb) => cb(totals))
}
function emitAdmins() {
  const rows = state.admins.slice().sort((a, b) => (a.email || '').localeCompare(b.email || ''))
  channels.admins.forEach((cb) => cb(rows))
}
function emitAll() {
  emitFunders()
  channels.months.forEach((_set, month) => emitMonth(month))
  emitTotals()
  emitAdmins()
}

/* ------------------------------- auth ------------------------------- */

function readSession() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (_e) {
    return null
  }
}
let session = typeof localStorage === 'undefined' ? null : readSession()

export async function isAdminsEmpty() {
  await tick(40)
  return state.admins.length === 0
}

async function createAdminRecord(email, password, displayName, role) {
  const clean = String(email).trim().toLowerCase()
  if (state.admins.some((a) => a.email === clean)) {
    throw new Error('That email already has an account.')
  }
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.')
  const id = `demo-${Date.now().toString(36)}`
  state.admins.push({
    id,
    email: clean,
    password,
    displayName: displayName || '',
    role: role || 'admin',
    createdAt: Date.now(),
    lastLoginAt: null,
  })
  persist()
  emitAdmins()
  return state.admins[state.admins.length - 1]
}

export async function createFirstAdmin(email, password, displayName) {
  const record = await createAdminRecord(email, password, displayName, 'owner')
  return signIn(email, password, record)
}

export async function signIn(email, password, preloaded) {
  await tick()
  const clean = String(email || '').trim().toLowerCase()
  const admin = preloaded || state.admins.find((a) => a.email === clean)
  if (!admin || admin.password !== password) {
    throw new Error('Incorrect email or password.')
  }
  admin.lastLoginAt = Date.now()
  session = {
    id: admin.id,
    email: admin.email,
    displayName: admin.displayName || '',
    role: admin.role,
  }
  persist()
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(session))
  } catch (_e) {
    /* ignore */
  }
  emitAdmins()
  return { user: { ...session } }
}

export async function signOut() {
  session = null
  try {
    localStorage.removeItem(USER_KEY)
  } catch (_e) {
    /* ignore */
  }
}

export function onAuthChange(cb) {
  cb(session ? { ...session } : null)
  return () => {}
}

/* ------------------------------ funders ----------------------------- */

export function subscribeFunders(emit) {
  const cb = (rows) => emit({ data: rows, loading: false })
  channels.funders.add(cb)
  setTimeout(() => emitFunders(), 0)
  return () => channels.funders.delete(cb)
}

export async function createFunder({ name, phone = '', note = '' }) {
  await tick()
  if (!String(name || '').trim()) throw new Error('Funder name is required.')
  const id = `f${state.nextFunderId++}`
  state.funders.push({
    id,
    name: String(name).trim(),
    phone: String(phone || '').trim(),
    note: String(note || '').trim(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  persist()
  emitFunders()
  return { id }
}

export async function updateFunder(id, { name, phone = '', note = '' }) {
  await tick()
  const f = state.funders.find((x) => x.id === id)
  if (!f) throw new Error('That funder no longer exists.')
  if (!String(name || '').trim()) throw new Error('Funder name is required.')
  Object.assign(f, {
    name: String(name).trim(),
    phone: String(phone || '').trim(),
    note: String(note || '').trim(),
    updatedAt: Date.now(),
  })
  persist()
  emitFunders()
}

export async function deleteFunder(id) {
  await tick()
  state.funders = state.funders.filter((f) => f.id !== id)
  for (const month of Object.keys(state.donations)) {
    if (state.donations[month] && state.donations[month][id]) {
      delete state.donations[month][id]
    }
  }
  persist()
  emitAll()
}

/* ---------------------------- donations ----------------------------- */

export function subscribeMonth(month, emit) {
  const cb = (rows) => emit({ data: rows, loading: false })
  if (!channels.months.has(month)) channels.months.set(month, new Set())
  channels.months.get(month).add(cb)
  setTimeout(() => emitMonth(month), 0)
  return () => {
    const set = channels.months.get(month)
    if (set) {
      set.delete(cb)
      if (set.size === 0) channels.months.delete(month)
    }
  }
}

export function subscribeTotals(emit) {
  const cb = (totals) => emit({ data: totals, loading: false })
  channels.totals.add(cb)
  setTimeout(() => emitTotals(), 0)
  return () => channels.totals.delete(cb)
}

export async function saveMonth(month, { updates = [], removes = [] }, funderById = {}) {
  await tick(140)
  const bucket = state.donations[month] || (state.donations[month] = {})
  for (const u of updates) {
    const f = funderById[u.funderId] || {}
    bucket[u.funderId] = {
      name: f.name || '',
      phone: f.phone || '',
      amount: Number(u.amount) || 0,
      savedAt: Date.now(),
    }
  }
  for (const id of removes) delete bucket[id]
  if (Object.keys(bucket).length === 0) delete state.donations[month]
  persist()
  emitMonth(month)
  emitTotals()
  return updates.length
}

export async function removeEntry(month, funderId) {
  return saveMonth(month, { updates: [], removes: [funderId] })
}

/* ------------------------------ admins ------------------------------ */

export function subscribeAdmins(emit) {
  const cb = (rows) => emit({ data: rows, loading: false })
  channels.admins.add(cb)
  setTimeout(() => emitAdmins(), 0)
  return () => channels.admins.delete(cb)
}

export async function createAdmin({ email, password, displayName = '' }) {
  const record = await createAdminRecord(email, password, displayName, 'admin')
  return { id: record.id }
}

export async function updateAdmin(id, { displayName = '', email = '', password = '' }) {
  await tick()
  const a = state.admins.find((x) => x.id === id)
  if (!a) throw new Error('That admin no longer exists.')
  const clean = String(email || '').trim().toLowerCase()
  if (clean && clean !== a.email && state.admins.some((x) => x.email === clean)) {
    throw new Error('Another admin already uses that email.')
  }
  a.displayName = String(displayName || '').trim()
  if (clean) a.email = clean
  if (password) {
    if (password.length < 6) throw new Error('Password must be at least 6 characters.')
    a.password = password
  }
  persist()
  emitAdmins()
}

export async function deleteAdmin(id) {
  await tick()
  if (state.admins.filter((a) => a.id !== id).length === 0) {
    throw new Error('Keep at least one administrator.')
  }
  state.admins = state.admins.filter((a) => a.id !== id)
  persist()
  emitAdmins()
}

export async function changeMyPassword(currentUser, currentPassword, newPassword) {
  await tick()
  const a = state.admins.find((x) => x.id === currentUser.id)
  if (!a) throw new Error('Account not found.')
  if (a.password !== currentPassword) throw new Error('Your current password is incorrect.')
  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.')
  }
  a.password = newPassword
  persist()
}

export async function sendPasswordReset() {
  await tick()
  throw new Error('Password reset emails are only available once Firebase is connected.')
}

export const demoBackend = {
  kind: 'demo',
  isAdminsEmpty,
  createFirstAdmin,
  signIn,
  signOut,
  onAuthChange,
  subscribeFunders,
  createFunder,
  updateFunder,
  deleteFunder,
  subscribeMonth,
  subscribeTotals,
  saveMonth,
  removeEntry,
  subscribeAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  changeMyPassword,
  sendPasswordReset,
}
