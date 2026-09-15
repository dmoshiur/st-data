import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CONFIG_KEYS,
  REQUIRED_KEYS,
  resolveFirebaseConfig,
} from '../src/lib/firebaseConfig.js'

const FULL = {
  VITE_FIREBASE_API_KEY: 'AIzaSy-test-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo',
  VITE_FIREBASE_STORAGE_BUCKET: 'demo.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
  VITE_FIREBASE_APP_ID: '1:1234567890:web:abc',
}

test('a complete VITE_ env produces a usable config', () => {
  const r = resolveFirebaseConfig({ env: FULL })
  assert.equal(r.ok, true)
  assert.deepEqual(r.missing, [])
  assert.equal(r.config.apiKey, 'AIzaSy-test-key')
  assert.equal(r.config.projectId, 'demo')
  assert.equal(r.source, 'build-time env (VITE_FIREBASE_*)')
})

test('missing keys are reported by name instead of failing silently', () => {
  const r = resolveFirebaseConfig({
    env: { VITE_FIREBASE_API_KEY: 'AIzaSy-x', VITE_FIREBASE_PROJECT_ID: 'demo' },
  })
  assert.equal(r.ok, false)
  assert.deepEqual(r.config, {})
  assert.ok(r.missing.includes('appId'), 'appId should be reported missing')
  assert.ok(!r.missing.includes('apiKey'))
  assert.ok(!r.missing.includes('authDomain'), 'authDomain is derivable from projectId')
  assert.equal(r.config.authDomain, undefined)
  assert.equal(r.resolved.authDomain, 'demo.firebaseapp.com')
})

test('authDomain is derived from projectId when absent', () => {
  const r = resolveFirebaseConfig({
    env: {
      VITE_FIREBASE_API_KEY: 'k',
      VITE_FIREBASE_PROJECT_ID: 'my-app',
      VITE_FIREBASE_APP_ID: '1:1:web:1',
    },
  })
  assert.equal(r.ok, true)
  assert.equal(r.config.authDomain, 'my-app.firebaseapp.com')
  assert.ok(r.warnings.some((w) => w.includes('derived')))
})

test('window.__ST_CONFIG__ (runtime /config.js) overrides build-time env', () => {
  const r = resolveFirebaseConfig({
    env: FULL,
    runtime: { projectId: 'other-project', apiKey: 'runtime-key' },
  })
  assert.equal(r.ok, true)
  assert.equal(r.config.projectId, 'other-project')
  assert.equal(r.config.apiKey, 'runtime-key')
  assert.ok(
    r.source.includes('config.js override'),
    `source should disclose the partial override, got: ${r.source}`,
  )
  assert.ok(r.source.includes('projectId'))
})

test('a complete runtime config is labelled as the sole source', () => {
  const r = resolveFirebaseConfig({
    env: {},
    runtime: {
      apiKey: 'rk',
      authDomain: 'rp.firebaseapp.com',
      projectId: 'rp',
      appId: '1:1:web:1',
    },
  })
  assert.equal(r.ok, true)
  assert.equal(r.source, 'config.js (runtime)')
})

test('runtime config also accepts ENV_VAR-style keys', () => {
  const r = resolveFirebaseConfig({
    env: {},
    runtime: {
      VITE_FIREBASE_API_KEY: 'rk',
      VITE_FIREBASE_PROJECT_ID: 'rp',
      VITE_FIREBASE_APP_ID: '1:1:web:1',
      VITE_FIREBASE_AUTH_DOMAIN: 'rp.firebaseapp.com',
    },
  })
  assert.equal(r.ok, true)
  assert.equal(r.config.projectId, 'rp')
})

test('a single VITE_FIREBASE_CONFIG JSON blob works (ENV-style keys)', () => {
  const r = resolveFirebaseConfig({
    env: { VITE_FIREBASE_CONFIG: JSON.stringify(FULL) },
  })
  assert.equal(r.ok, true)
  assert.equal(r.source, 'VITE_FIREBASE_CONFIG')
  assert.equal(r.config.appId, '1:1234567890:web:abc')
})

test('the same blob also works with camelCase firebaseConfig keys', () => {
  const r = resolveFirebaseConfig({
    env: {
      VITE_FIREBASE_CONFIG: JSON.stringify({
        apiKey: 'AIzaSy-camel',
        authDomain: 'camel.firebaseapp.com',
        projectId: 'camel',
        storageBucket: 'camel.appspot.com',
        messagingSenderId: '999',
        appId: '1:999:web:camel',
      }),
    },
  })
  assert.equal(r.ok, true)
  assert.equal(r.config.apiKey, 'AIzaSy-camel')
  assert.equal(r.config.projectId, 'camel')
})

test('invalid JSON in VITE_FIREBASE_CONFIG warns instead of throwing', () => {
  const r = resolveFirebaseConfig({ env: { VITE_FIREBASE_CONFIG: '{not json' } })
  assert.equal(r.ok, false)
  assert.ok(r.warnings.some((w) => w.includes('not valid JSON')))
})

test('whitespace-only values count as missing', () => {
  const r = resolveFirebaseConfig({
    env: { ...FULL, VITE_FIREBASE_API_KEY: '   ' },
  })
  assert.equal(r.ok, false)
  assert.ok(r.missing.includes('apiKey'))
})

test('storageEngine switches to the Realtime Database only when a URL is set', () => {
  assert.equal(resolveFirebaseConfig({ env: FULL }).storageEngine, 'firestore')
  assert.equal(
    resolveFirebaseConfig({
      env: { ...FULL, VITE_FIREBASE_DATABASE_URL: 'https://demo-default-rtdb.firebaseio.com' },
    }).storageEngine,
    'database',
  )
})

test('seed admin credentials are read separately from the app config', () => {
  const r = resolveFirebaseConfig({
    env: { ...FULL, VITE_SEED_ADMIN_EMAIL: 'owner@example.com', VITE_SEED_ADMIN_PASSWORD: 's3cret' },
  })
  assert.equal(r.seed.email, 'owner@example.com')
  assert.equal(r.seed.password, 's3cret')
  assert.equal(r.config.seedEmail, undefined, 'seed values must not leak into firebaseConfig')
})

test('no config at all yields demo mode with every required key named', () => {
  const r = resolveFirebaseConfig({})
  assert.equal(r.ok, false)
  assert.equal(r.source, 'none')
  assert.deepEqual(r.missing.slice().sort(), REQUIRED_KEYS.slice().sort())
  assert.equal(Object.keys(CONFIG_KEYS).length, 7)
})

test('readFirebaseEnv is safe outside a browser', async () => {
  const { readFirebaseEnv } = await import('../src/lib/firebaseConfig.js')
  const r = readFirebaseEnv()
  assert.equal(typeof r.ok, 'boolean')
  assert.ok(Array.isArray(r.missing))
})
