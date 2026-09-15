/**
 * Pure Firebase config resolution.
 *
 * THE BUG THIS FILE EXISTS TO PREVENT
 * ----------------------------------
 * Vite only inlines environment variables that (a) start with `VITE_` and
 * (b) exist **at build time**. If you add `FIREBASE_API_KEY` to your Vercel
 * dashboard without the `VITE_` prefix, or add it *after* the deploy was
 * built, the client bundle silently receives `undefined` and the app appears
 * to "not connect to Firebase" even though the values are set.
 *
 * So we resolve config from three sources, in priority order, and we report
 * exactly which keys are still missing instead of failing silently:
 *
 *   1. `window.__ST_CONFIG__`        — from /config.js, editable AFTER a build
 *   2. `import.meta.env.VITE_FIREBASE_*` — standard build-time env vars
 *   3. `import.meta.env.VITE_FIREBASE_CONFIG` — one JSON blob, if you prefer
 *
 * This module has no Firebase imports so it can be unit-tested in plain Node.
 */

/** Keys we need, and the env var that provides each one. */
export const CONFIG_KEYS = {
  apiKey: ['VITE_FIREBASE_API_KEY'],
  authDomain: ['VITE_FIREBASE_AUTH_DOMAIN'],
  projectId: ['VITE_FIREBASE_PROJECT_ID'],
  storageBucket: ['VITE_FIREBASE_STORAGE_BUCKET'],
  messagingSenderId: ['VITE_FIREBASE_MESSAGING_SENDER_ID'],
  appId: ['VITE_FIREBASE_APP_ID'],
  databaseURL: ['VITE_FIREBASE_DATABASE_URL'],
}

/** Keys without which the app cannot talk to Firebase at all. */
export const REQUIRED_KEYS = ['apiKey', 'projectId', 'appId', 'authDomain']

/** Seed account used only on a completely empty `admins` collection. */
export const SEED_KEYS = {
  seedEmail: ['VITE_SEED_ADMIN_EMAIL'],
  seedPassword: ['VITE_SEED_ADMIN_PASSWORD'],
}

function pick(env, names) {
  for (const name of names) {
    const raw = env ? env[name] : undefined
    if (typeof raw === 'string' && raw.trim() !== '') return raw.trim()
  }
  return undefined
}

function parseBlob(env) {
  const raw = pick(env, ['VITE_FIREBASE_CONFIG', 'VITE_FIREBASE_JSON'])
  if (!raw) return {}
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (_e) {
    return { __parseError: raw }
  }
  if (!parsed || typeof parsed !== 'object') return { __parseError: raw }
  // Accept either the canonical `apiKey` spelling or `VITE_FIREBASE_API_KEY`,
  // so pasting the env block straight in works too.
  return normalizeKeys(parsed)
}

/** Accept both `apiKey` and `VITE_FIREBASE_API_KEY` spellings in one object. */
function normalizeKeys(input) {
  if (!input || typeof input !== 'object') return {}
  const out = {}
  for (const [key, aliases] of Object.entries(CONFIG_KEYS)) {
    if (typeof input[key] === 'string' && input[key].trim() !== '') {
      out[key] = input[key].trim()
      continue
    }
    for (const alias of aliases) {
      const camel = alias
        .replace(/^VITE_FIREBASE_/, '')
        .toLowerCase()
        .replace(/_(\w)/g, (_m, c) => c.toUpperCase())
      if (typeof input[alias] === 'string' && input[alias].trim() !== '') {
        out[key] = input[alias].trim()
        break
      }
      if (typeof input[camel] === 'string' && input[camel].trim() !== '') {
        out[key] = input[camel].trim()
        break
      }
    }
  }
  return out
}

/**
 * @param {object} [opts]
 * @param {object} [opts.env]      `import.meta.env` (or process.env in tests)
 * @param {object} [opts.runtime]  `window.__ST_CONFIG__`
 * @returns {{config: object, ok: boolean, missing: string[], source: string,
 *            storageEngine: 'database'|'firestore', seed: object, warnings: string[]}}
 */
export function resolveFirebaseConfig({ env = {}, runtime = null } = {}) {
  const warnings = []
  const fromBlob = parseBlob(env)
  if (fromBlob.__parseError) {
    warnings.push('VITE_FIREBASE_CONFIG is not valid JSON and was ignored.')
    delete fromBlob.__parseError
  }

  const resolved = {}
  const usedBlobOnly = []
  for (const key of Object.keys(CONFIG_KEYS)) {
    const value =
      fromBlob[key] ??
      pick(env, CONFIG_KEYS[key])
    if (value) resolved[key] = value
  }

  const runtimeConfig = normalizeKeys(runtime)
  const runtimeKeys = Object.keys(runtimeConfig)

  // Runtime /config.js wins — it is the escape hatch for fixing a broken
  // deploy without a rebuild.
  Object.assign(resolved, runtimeConfig)

  // authDomain is derivable from projectId; fill it in so a missing value
  // never blocks sign-in.
  if (!resolved.authDomain && resolved.projectId) {
    resolved.authDomain = `${resolved.projectId}.firebaseapp.com`
    warnings.push('VITE_FIREBASE_AUTH_DOMAIN was derived from VITE_FIREBASE_PROJECT_ID.')
  }

  const missing = REQUIRED_KEYS.filter((k) => !resolved[k])

  // Pick a source label for the diagnostics UI, so "where did this config
  // come from?" is answerable from the screen instead of by guesswork.
  let source = 'none'
  if (missing.length === 0) {
    const runtimeHasAll = REQUIRED_KEYS.every((k) => runtimeConfig[k])
    const blobHasAll = REQUIRED_KEYS.every((k) => fromBlob[k])
    if (runtimeKeys.length > 0 && runtimeHasAll) {
      source = 'config.js (runtime)'
    } else if (runtimeKeys.length > 0) {
      source = `build-time env (VITE_FIREBASE_*) + config.js override (${runtimeKeys.join(', ')})`
    } else if (Object.keys(fromBlob).length > 0 && blobHasAll) {
      source = 'VITE_FIREBASE_CONFIG'
    } else {
      source = 'build-time env (VITE_FIREBASE_*)'
    }
  }

  const seed = {
    email: pick(env, SEED_KEYS.seedEmail) || null,
    password: pick(env, SEED_KEYS.seedPassword) || null,
  }

  // Realtime Database is used for donations when its URL is configured
  // (that is where the original app kept them); otherwise Firestore.
  const storageEngine = resolved.databaseURL ? 'database' : 'firestore'
  if (missing.length === 0 && !resolved.databaseURL) {
    warnings.push(
      'VITE_FIREBASE_DATABASE_URL is not set — donations are stored in Firestore instead of the Realtime Database.',
    )
  }

  return {
    config: missing.length === 0 ? resolved : {},
    ok: missing.length === 0,
    missing,
    source,
    storageEngine,
    seed,
    warnings,
    resolved,
  }
}

/** Read the config from the live browser environment. */
export function readFirebaseEnv() {
  const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}
  const runtime =
    (typeof globalThis !== 'undefined' && globalThis.__ST_CONFIG__) ||
    (typeof window !== 'undefined' && window.__ST_CONFIG__) ||
    null
  return resolveFirebaseConfig({ env, runtime })
}
