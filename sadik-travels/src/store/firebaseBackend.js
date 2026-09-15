/**
 * Firebase backend.
 *
 * Data layout
 * -----------
 *   Firestore  funders/{id}                      -> { name, phone, note, createdAt, updatedAt }
 *   Firestore  admins/{uid}                      -> { email, displayName, role, createdAt, lastLoginAt }
 *   Donations  Realtime DB  donations/{YYYY-MM}/{funderId}   (when VITE_FIREBASE_DATABASE_URL is set)
 *              Firestore    donations/{YYYY-MM}/entries/{funderId}  + months/{YYYY-MM} aggregate
 *
 * Every read is a live subscription (onSnapshot / onValue) so the UI updates
 * the instant anything changes — no polling, no stale screens.
 */
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import {
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import {
  app,
  auth,
  db,
  getRtdb,
  firebaseEnv,
  friendlyAuthError,
  friendlyDataError,
  withSecondaryApp,
} from '../lib/firebase.js'
import { computeTotals, toMillis, toNumber } from './totals.js'

const USE_RTDB = firebaseEnv.storageEngine === 'database'

let _fs = null
function fs() {
  if (_fs) return _fs
  // Persistent local cache => the app still renders (and queues writes) when
  // the network drops, which matters for an office on an unstable connection.
  try {
    _fs = initializeFirestore(app(), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch (_e) {
    // Already initialised (hot reload / StrictMode double-invoke) or IndexedDB
    // unavailable — plain in-memory Firestore still works fine.
    _fs = db()
  }
  return _fs
}

/**
 * Mirror the admin roster into the Realtime Database (`admins/<uid> = true`).
 *
 * Realtime Database rules cannot look at Firestore, so without this mirror
 * there is no way to authorise donation writes there. No-ops when the
 * Realtime Database is not configured.
 */
async function syncRtdbAdminFlag(uid, active) {
  if (!USE_RTDB) return
  try {
    const { database, ref, set, remove: rtdbRemove } = await rtdbModule()
    if (active) await set(ref(database, `admins/${uid}`), true)
    else await rtdbRemove(ref(database, `admins/${uid}`))
  } catch (_e) {
    /* Firestore remains the source of truth; RTDB is a best-effort mirror */
  }
}

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

function toUser(fbUser, profile) {
  return {
    id: fbUser.uid,
    email: fbUser.email || '',
    displayName: (profile && profile.displayName) || fbUser.displayName || '',
    role: (profile && profile.role) || 'admin',
    createdAt: toMillis(profile && profile.createdAt) || null,
    lastLoginAt: toMillis(profile && profile.lastLoginAt) || null,
  }
}

let lastTouch = 0
async function touchLastLogin(uid) {
  const now = Date.now()
  if (now - lastTouch < 60_000) return
  lastTouch = now
  try {
    await updateDoc(doc(fs(), 'admins', uid), { lastLoginAt: serverTimestamp() })
  } catch (_e) {
    /* cosmetic */
  }
}

export async function isAdminsEmpty() {
  try {
    const snap = await getDocs(query(collection(fs(), 'admins'), fsLimit(1)))
    return snap.empty
  } catch (_e) {
    return false
  }
}

export async function createFirstAdmin(email, password, displayName) {
  const user = await withSecondaryApp(async (secondaryAuth) => {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    await setDoc(doc(fs(), 'admins', cred.user.uid), {
      email: cred.user.email || email,
      displayName: displayName || '',
      role: 'owner',
      createdAt: serverTimestamp(),
      lastLoginAt: null,
    })
    await syncRtdbAdminFlag(cred.user.uid, true)
    return cred.user
  })
  const cred = await signInWithEmailAndPassword(auth(), email, password)
  return { user: toUser(cred.user, { displayName, role: 'owner' }) }
}

export async function signIn(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth(), email, password)
    const snap = await getDoc(doc(fs(), 'admins', cred.user.uid))
    const profile = snap.exists() ? snap.data() : null
    if (!snap.exists()) {
      await fbSignOut(auth())
      const err = new Error(
        'This account is no longer an administrator. Ask an owner to re-add you.',
      )
      err.code = 'st/deactivated'
      throw err
    }
    void touchLastLogin(cred.user.uid)
    return { user: toUser(cred.user, profile) }
  } catch (err) {
    if (err && err.code === 'st/deactivated') throw err
    // First-run bootstrap: empty admins table + matching seed credentials.
    const code = err && err.code
    const seedable =
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password'
    if (seedable && firebaseEnv.seed.email && firebaseEnv.seed.password) {
      const sameEmail =
        String(email).trim().toLowerCase() === String(firebaseEnv.seed.email).trim().toLowerCase()
      if (sameEmail && password === firebaseEnv.seed.password && (await isAdminsEmpty())) {
        return createFirstAdmin(email, password, firebaseEnv.seed.displayName || 'Owner')
      }
    }
    throw new Error(friendlyAuthError(err))
  }
}

export async function signOut() {
  if (!auth()) return
  try {
    await fbSignOut(auth())
  } catch (_e) {
    /* ignore */
  }
}

/** Live session. Emits null when signed out, or a user object when signed in. */
export function onAuthChange(cb) {
  if (!auth()) {
    cb(null)
    return () => {}
  }
  let disposed = false
  return onAuthStateChanged(
    auth(),
    async (fbUser) => {
      if (disposed) return
      if (!fbUser) {
        cb(null)
        return
      }
      try {
        const snap = await getDoc(doc(fs(), 'admins', fbUser.uid))
        if (disposed) return
        if (!snap.exists()) {
          // Admin was removed while a session was still open — drop it.
          await fbSignOut(auth())
          cb(null)
          return
        }
        void touchLastLogin(fbUser.uid)
        cb(toUser(fbUser, snap.data()))
      } catch (_e) {
        // Offline / rules problem: fall back to the raw auth profile so the
        // user is never locked out of their own screen by a network blip.
        if (!disposed) cb(toUser(fbUser, { displayName: fbUser.displayName }))
      }
    },
    (err) => {
      if (!disposed) cb(null, friendlyAuthError(err))
    },
  )
}

/* ------------------------------------------------------------------ *
 * Funders (Firestore)
 * ------------------------------------------------------------------ */

function funderFromDoc(snap) {
  const d = snap.data() || {}
  return {
    id: snap.id,
    name: d.name || '',
    phone: d.phone || '',
    note: d.note || '',
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  }
}

export function subscribeFunders(emit) {
  const q = query(collection(fs(), 'funders'), orderBy('name'))
  return onSnapshot(
    q,
    (snap) => emit({ data: snap.docs.map(funderFromDoc), loading: false }),
    (err) => emit({ error: friendlyDataError(err), loading: false }),
  )
}

export async function createFunder({ name, phone = '', note = '' }) {
  try {
    const d = doc(collection(fs(), 'funders'))
    await setDoc(d, {
      name: String(name).trim(),
      phone: String(phone || '').trim(),
      note: String(note || '').trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { id: d.id }
  } catch (err) {
    throw new Error(friendlyDataError(err))
  }
}

export async function updateFunder(id, { name, phone = '', note = '' }) {
  try {
    await updateDoc(doc(fs(), 'funders', id), {
      name: String(name).trim(),
      phone: String(phone || '').trim(),
      note: String(note || '').trim(),
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(friendlyDataError(err))
  }
}

export async function deleteFunder(id) {
  try {
    // Snapshot the name first so we can tell the user what was removed.
    const months = await getDocs(collection(fs(), 'months'))
    const batch = writeBatch(fs())
    batch.delete(doc(fs(), 'funders', id))
    months.forEach((m) => batch.delete(doc(fs(), 'donations', m.id, 'entries', id)))
    await batch.commit()
    // Keep month aggregates honest.
    for (const m of months.docs) await refreshMonthAggregate(m.id)
  } catch (err) {
    throw new Error(friendlyDataError(err))
  }
}

/* ------------------------------------------------------------------ *
 * Donations
 * ------------------------------------------------------------------ */

function monthPath(month) {
  return `donations/${month}`
}

/**
 * The Realtime Database SDK is imported lazily (see lib/firebase.js), so every
 * RTDB call goes through this. Subscription factories stay synchronous and
 * return a working unsubscribe immediately — if the module arrives after the
 * component unmounted, the pending listener is dropped instead.
 */
async function rtdbModule() {
  const database = await getRtdb()
  if (!database) {
    throw new Error(
      'VITE_FIREBASE_DATABASE_URL is not set, so the Realtime Database is unavailable.',
    )
  }
  const mod = await import('firebase/database')
  return { database, ...mod }
}

function subscribeMonthRtdb(month, emit) {
  let unsub = () => {}
  let cancelled = false
  rtdbModule()
    .then(({ database, onValue, ref }) => {
      if (cancelled) return
      unsub = onValue(
        ref(database, monthPath(month)),
        (snap) => {
          const raw = snap.val() || {}
          const rows = Object.entries(raw).map(([funderId, v]) => ({
            funderId,
            name: (v && v.name) || '',
            phone: (v && v.phone) || '',
            amount: toNumber(v && v.amount),
            savedAt: toMillis(v && v.savedAt),
          }))
          emit({ data: rows, loading: false })
        },
        (err) => emit({ error: friendlyDataError(err), loading: false }),
      )
    })
    .catch((err) => emit({ error: friendlyDataError(err), loading: false }))
  return () => {
    cancelled = true
    try {
      unsub()
    } catch (_e) {
      /* ignore */
    }
  }
}

function subscribeMonthFirestore(month, emit) {
  return onSnapshot(
    query(collection(fs(), 'donations', month, 'entries'), orderBy('name')),
    (snap) => {
      const rows = snap.docs.map((d) => {
        const v = d.data() || {}
        return {
          funderId: d.id,
          name: v.name || '',
          phone: v.phone || '',
          amount: toNumber(v.amount),
          savedAt: toMillis(v.savedAt),
        }
      })
      emit({ data: rows, loading: false })
    },
    (err) => emit({ error: friendlyDataError(err), loading: false }),
  )
}

export function subscribeMonth(month, emit) {
  if (!month) {
    emit({ data: [], loading: false })
    return () => {}
  }
  return USE_RTDB ? subscribeMonthRtdb(month, emit) : subscribeMonthFirestore(month, emit)
}

/** Recompute months/{key} so the dashboard totals stay cheap to read. */
async function refreshMonthAggregate(month) {
  if (USE_RTDB) return
  try {
    const entries = await getDocs(collection(fs(), 'donations', month, 'entries'))
    const rows = entries.docs.map((d) => {
      const v = d.data() || {}
      return {
        funderId: d.id,
        name: v.name || '',
        amount: toNumber(v.amount),
        savedAt: toMillis(v.savedAt),
      }
    })
    const total = rows.reduce((s, r) => s + r.amount, 0)
    const recent = rows
      .slice()
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, 8)
    await setDoc(doc(fs(), 'months', month), {
      total,
      count: rows.length,
      recent,
      updatedAt: serverTimestamp(),
    })
  } catch (_e) {
    /* totals are best-effort; the month view is always accurate */
  }
}

function subscribeTotalsRtdb(emit) {
  let unsub = () => {}
  let cancelled = false
  rtdbModule()
    .then(({ database, onValue, ref }) => {
      if (cancelled) return
      unsub = onValue(
        ref(database, 'donations'),
        (snap) => {
          const raw = snap.val() || {}
          const months = Object.entries(raw).map(([key, entries]) => ({
            key,
            entries: Object.entries(entries || {}).map(([funderId, v]) => ({
              funderId,
              name: (v && v.name) || '',
              amount: toNumber(v && v.amount),
              savedAt: toMillis(v && v.savedAt),
            })),
          }))
          emit({ data: computeTotals(months), loading: false })
        },
        (err) => emit({ error: friendlyDataError(err), loading: false }),
      )
    })
    .catch((err) => emit({ error: friendlyDataError(err), loading: false }))
  return () => {
    cancelled = true
    try {
      unsub()
    } catch (_e) {
      /* ignore */
    }
  }
}

function subscribeTotalsFirestore(emit) {
  return onSnapshot(
    collection(fs(), 'months'),
    (snap) => {
      const months = snap.docs.map((d) => {
        const v = d.data() || {}
        return {
          key: d.id,
          total: toNumber(v.total),
          count: toNumber(v.count),
          recent: Array.isArray(v.recent) ? v.recent : [],
        }
      })
      emit({ data: computeTotals(months), loading: false })
    },
    (err) => emit({ error: friendlyDataError(err), loading: false }),
  )
}

export function subscribeTotals(emit) {
  return USE_RTDB ? subscribeTotalsRtdb(emit) : subscribeTotalsFirestore(emit)
}

/**
 * Save one month. `updates` = [{funderId, amount}], `removes` = [funderId].
 * Returns the number of donors written.
 */
export async function saveMonth(month, { updates = [], removes = [] }, funderById = {}) {
  const savedAt = Date.now()
  try {
    if (USE_RTDB) {
      const { database, ref, update: rtdbUpdate } = await rtdbModule()
      const payload = {}
      for (const u of updates) {
        const f = funderById[u.funderId] || {}
        payload[u.funderId] = {
          name: f.name || '',
          phone: f.phone || '',
          amount: toNumber(u.amount),
          savedAt,
        }
      }
      for (const id of removes) payload[id] = null
      await rtdbUpdate(ref(database, monthPath(month)), payload)
      return updates.length
    }

    const batch = writeBatch(fs())
    for (const u of updates) {
      const f = funderById[u.funderId] || {}
      batch.set(doc(fs(), 'donations', month, 'entries', u.funderId), {
        name: f.name || '',
        phone: f.phone || '',
        amount: toNumber(u.amount),
        savedAt,
      })
    }
    for (const id of removes) batch.delete(doc(fs(), 'donations', month, 'entries', id))
    await batch.commit()
    await refreshMonthAggregate(month)
    return updates.length
  } catch (err) {
    throw new Error(friendlyDataError(err))
  }
}

export async function removeEntry(month, funderId) {
  return saveMonth(month, { updates: [], removes: [funderId] })
}

/* ------------------------------------------------------------------ *
 * Admins (Firestore)
 * ------------------------------------------------------------------ */

function adminFromDoc(snap) {
  const d = snap.data() || {}
  return {
    id: snap.id,
    email: d.email || '',
    displayName: d.displayName || '',
    role: d.role || 'admin',
    createdAt: toMillis(d.createdAt),
    lastLoginAt: toMillis(d.lastLoginAt),
  }
}

export function subscribeAdmins(emit) {
  return onSnapshot(
    query(collection(fs(), 'admins'), orderBy('email')),
    (snap) => emit({ data: snap.docs.map(adminFromDoc), loading: false }),
    (err) => emit({ error: friendlyDataError(err), loading: false }),
  )
}

export async function createAdmin({ email, password, displayName = '' }) {
  try {
    const created = await withSecondaryApp(async (secondaryAuth) => {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
      if (displayName) await updateProfile(cred.user, { displayName })
      await setDoc(doc(fs(), 'admins', cred.user.uid), {
        email: cred.user.email || email,
        displayName: displayName || '',
        role: 'admin',
        createdAt: serverTimestamp(),
        lastLoginAt: null,
      })
      await syncRtdbAdminFlag(cred.user.uid, true)
      return cred.user.uid
    })
    return { id: created }
  } catch (err) {
    const code = err && err.code
    if (code === 'auth/email-already-in-use') throw new Error('That email already has an account.')
    if (code === 'auth/weak-password') throw new Error('Password must be at least 6 characters.')
    if (code === 'auth/invalid-email') throw new Error('That email address is not valid.')
    throw new Error(friendlyAuthError(err))
  }
}

export async function updateAdmin(id, { displayName = '', email = '' }) {
  try {
    await updateDoc(doc(fs(), 'admins', id), {
      displayName: String(displayName || '').trim(),
      email: String(email || '').trim().toLowerCase(),
    })
  } catch (err) {
    throw new Error(friendlyDataError(err))
  }
}

export async function deleteAdmin(id) {
  try {
    await deleteDoc(doc(fs(), 'admins', id))
    await syncRtdbAdminFlag(id, false)
  } catch (err) {
    throw new Error(friendlyDataError(err))
  }
}

export async function changeMyPassword(currentUser, currentPassword, newPassword) {
  try {
    const fbUser = auth().currentUser
    if (!fbUser) throw new Error('You are signed out. Sign in again to change your password.')
    const cred = EmailAuthProvider.credential(fbUser.email, currentPassword)
    await reauthenticateWithCredential(fbUser, cred)
    await updatePassword(fbUser, newPassword)
  } catch (err) {
    const code = err && err.code
    if (code === 'auth/requires-recent-login') {
      throw new Error('For security, Firebase needs a fresh sign-in. Sign out and back in, then retry.')
    }
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      throw new Error('Your current password is incorrect.')
    }
    if (code === 'auth/weak-password') throw new Error('New password must be at least 6 characters.')
    throw new Error(friendlyAuthError(err))
  }
}

export async function sendPasswordReset(email) {
  try {
    await sendPasswordResetEmail(auth(), email)
  } catch (err) {
    throw new Error(friendlyAuthError(err))
  }
}

export const firebaseBackend = {
  kind: 'firebase',
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
