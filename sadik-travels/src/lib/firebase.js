/**
 * Firebase bootstrap — the single place the SDK is initialised.
 *
 * Everything else in the app imports from here, so there is exactly one
 * `initializeApp()` call per SDK and no chance of the "app already exists"
 * error that happens when a module gets hot-reloaded twice.
 */
import { getApps, initializeApp, deleteApp } from 'firebase/app'
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { readFirebaseEnv } from './firebaseConfig.js'

const APP_NAME = 'sadik-travels'

/** @type {{ok: boolean, missing: string[], source: string, storageEngine: string, seed: object, warnings: string[]}} */
export const firebaseEnv = readFirebaseEnv()
export const isFirebaseConfigured = firebaseEnv.ok

let _app = null
let _auth = null
let _db = null
let _rtdb = null
let _rtdbPromise = null

/** The one and only Firebase app instance for this page. */
export function app() {
  if (!isFirebaseConfigured) return null
  if (_app) return _app
  _app = getApps().find((a) => a.name === APP_NAME) || initializeApp(firebaseEnv.config, APP_NAME)
  return _app
}

/** @returns {import('firebase/auth').Auth|null} */
export function auth() {
  if (!isFirebaseConfigured) return null
  if (!_auth) _auth = getAuth(app())
  return _auth
}

/** @returns {import('firebase/firestore').Firestore|null} */
export function db() {
  if (!isFirebaseConfigured) return null
  if (!_db) _db = getFirestore(app())
  return _db
}

/**
 * Realtime Database, loaded on demand.
 *
 * `firebase/database` is ~200 kB of the SDK. Most installs use Firestore for
 * donations, so importing it dynamically keeps it out of the bundle those
 * users actually download. Returns null when no databaseURL is configured.
 *
 * @returns {Promise<import('firebase/database').Database|null>}
 */
export function getRtdb() {
  if (!isFirebaseConfigured || !firebaseEnv.config.databaseURL) return Promise.resolve(null)
  if (_rtdb) return Promise.resolve(_rtdb)
  if (!_rtdbPromise) {
    _rtdbPromise = import('firebase/database').then(({ getDatabase }) => {
      _rtdb = getDatabase(app())
      return _rtdb
    })
  }
  return _rtdbPromise
}

/**
 * Make the session survive a page reload (default in the browser, but being
 * explicit avoids surprises if someone changes the SDK defaults later).
 */
export async function ensurePersistence() {
  try {
    if (auth()) await setPersistence(auth(), browserLocalPersistence)
  } catch (_e) {
    /* non-fatal */
  }
}

/**
 * A throw-away Firebase app. Firebase Auth can only hold one signed-in user
 * per app instance, so creating/deleting other admins needs a second app that
 * we tear down immediately afterwards.
 */
export async function withSecondaryApp(fn) {
  const name = `st-secondary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const secondary = initializeApp(firebaseEnv.config, name)
  try {
    return await fn(getAuth(secondary))
  } finally {
    try {
      await deleteApp(secondary)
    } catch (_e) {
      /* ignore */
    }
  }
}

/** Turn any Firebase error into something a human can act on. */
export function friendlyAuthError(err) {
  const code = (err && err.code) || ''
  const msg = String((err && err.message) || '').toLowerCase()
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Incorrect email or password.'
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many failed attempts. Firebase has temporarily locked sign-in — wait a few minutes and try again.'
  }
  if (code === 'auth/network-request-failed' || msg.includes('network')) {
    return 'Network error. Check the connection, and make sure *.firebaseapp.com / *.googleapis.com are not blocked.'
  }
  if (code === 'auth/invalid-api-key' || msg.includes('api key')) {
    return 'Firebase rejected the API key. Re-check VITE_FIREBASE_API_KEY and redeploy.'
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is disabled in Firebase Console → Authentication → Sign-in method.'
  }
  if (code === 'auth/configuration-not-found') {
    return 'Authentication is not initialised — enable Email/Password in the Firebase Console.'
  }
  if (code === 'auth/unauthorized-domain' || msg.includes('authorized domains')) {
    return 'This domain is not authorised. Add it under Firebase Console → Authentication → Settings → Authorized domains.'
  }
  if (err && err.message) return err.message
  return 'Sign in failed. Please try again.'
}

/** Turn a Firestore/RTDB error into a readable message. */
export function friendlyDataError(err) {
  const code = (err && err.code) || ''
  const msg = String((err && err.message) || '')
  if (code === 'permission-denied' || msg.toLowerCase().includes('permission')) {
    return 'Firebase rules blocked this operation. Check your Firestore / Realtime Database security rules.'
  }
  if (code === 'unavailable' || msg.toLowerCase().includes('unavailable')) {
    return 'Cannot reach Firebase right now. Check the connection and try again.'
  }
  return msg || 'Something went wrong talking to Firebase.'
}
