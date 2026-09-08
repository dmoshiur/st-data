// ---------------------------------------------------------------------------
// Demo mode (browser-only) data layer.
//
// Used ONLY when Firebase is not configured (no VITE_FIREBASE_API_KEY), so the
// whole app can be previewed in the browser. Data lives in localStorage.
// When Firebase is configured, the real SDK (src/store/*) is used instead.
// ---------------------------------------------------------------------------

const LS_KEY = 'sadik-travels-demo'
const USER_KEY = 'sadik-travels-demo-user'

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    /* ignore */
  }
  return { funders: [], donations: {} }
}

let store = load()

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store))
  } catch (e) {
    /* ignore */
  }
}

function makeId() {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

function emit(listeners) {
  ;[...listeners].forEach((fn) => {
    try {
      fn()
    } catch (e) {
      /* ignore */
    }
  })
}

const firestoreListeners = new Set()
const databaseListeners = new Set()
const authListeners = new Set()

// ---------- helpers ----------
function getPath(obj, path) {
  const parts = String(path || '').split('/').filter(Boolean)
  let cur = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[p]
  }
  return cur
}

function setPath(obj, path, value) {
  const parts = String(path || '').split('/').filter(Boolean)
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}
    cur = cur[parts[i]]
  }
  cur[parts[parts.length - 1]] = value
}

function deletePath(obj, path) {
  const parts = String(path || '').split('/').filter(Boolean)
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur[parts[i]]
    if (cur == null) return
  }
  delete cur[parts[parts.length - 1]]
}

// ---------- Firestore (funders) ----------
export const demoFirestore = {
  collection(_db, name) {
    return { __demoCollection: name }
  },

  query(collRef, ...constraints) {
    const q = { __demoCollection: collRef.__demoCollection, __orderBy: null }
    constraints.forEach((c) => {
      if (c && c.__orderByField) q.__orderBy = c.__orderByField
    })
    return q
  },

  orderBy(field) {
    return { __orderByField: field }
  },

  doc(_db, name, id) {
    return { __demoCollection: name, __demoId: id }
  },

  onSnapshot(q, success /*, error */) {
    const emitSnapshot = () => {
      let rows = store.funders.map((f) => ({ ...f }))
      if (q.__orderBy === 'name') {
        rows.sort((a, b) =>
          String(a.name || '').localeCompare(String(b.name || ''), 'en', {
            sensitivity: 'base',
          }),
        )
      }
      success({
        docs: rows.map((f) => ({ id: f.id, data: () => ({ ...f }) })),
      })
    }
    emitSnapshot()
    const listener = () => emitSnapshot()
    firestoreListeners.add(listener)
    return () => firestoreListeners.delete(listener)
  },

  async addDoc(collRef, data) {
    const docData = { ...data, id: makeId() }
    store.funders.push(docData)
    persist()
    emit(firestoreListeners)
    return { id: docData.id }
  },

  async updateDoc(docRef, data) {
    const f = store.funders.find((x) => x.id === docRef.__demoId)
    if (f) Object.assign(f, data)
    persist()
    emit(firestoreListeners)
  },

  async deleteDoc(docRef) {
    store.funders = store.funders.filter((x) => x.id !== docRef.__demoId)
    persist()
    emit(firestoreListeners)
  },

  serverTimestamp() {
    return Date.now()
  },
}

// ---------- Realtime Database (donations) ----------
export const demoDatabase = {
  ref(_db, path) {
    return { __demoPath: path || '' }
  },

  onValue(refObj, success /*, error */) {
    const emitValue = () => {
      const value = getPath(store.donations, refObj.__demoPath)
      success({
        val: () => value ?? null,
        exists: () => value != null,
      })
    }
    emitValue()
    const listener = () => emitValue()
    databaseListeners.add(listener)
    return () => databaseListeners.delete(listener)
  },

  async update(refObj, patch) {
    if (!store.donations) store.donations = {}
    Object.entries(patch).forEach(([key, value]) => {
      const full = refObj.__demoPath ? `${refObj.__demoPath}/${key}` : key
      if (value === null) deletePath(store.donations, full)
      else setPath(store.donations, full, value)
    })
    persist()
    emit(databaseListeners)
  },
}

// ---------- Auth ----------
function getCurrentUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

export const demoAuth = {
  async signInWithEmailAndPassword(_auth, email, password) {
    const e = String(email || '').trim()
    if (!e || !password) {
      throw { code: 'auth/invalid-credential', message: 'Enter email and password.' }
    }
    const user = { uid: 'demo-' + e, email: e, displayName: null }
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    emit(authListeners)
    return { user }
  },

  async signOut() {
    localStorage.removeItem(USER_KEY)
    emit(authListeners)
  },

  async sendPasswordResetEmail() {
    return undefined
  },

  onAuthStateChanged(_auth, callback) {
    callback(getCurrentUser())
    const listener = () => callback(getCurrentUser())
    authListeners.add(listener)
    return () => authListeners.delete(listener)
  },
}
