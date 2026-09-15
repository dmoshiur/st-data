/**
 * Render smoke test.
 *
 * Boots the real app (React components + AuthContext + i18n + demo backend)
 * inside jsdom, driven by Vite's own module pipeline so the exact source in
 * src/ is what runs — no mocks, no re-implementation.
 *
 * It walks the flow a new deploy hits first: sign-in screen → create the first
 * admin → dashboard → add a funder → record a donation.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

let dom
let vite
let act
let React
let renderModule
let App

function installGlobals() {
  dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
    url: 'http://localhost:5173/',
    pretendToBeVisual: true,
  })
  const { window } = dom

  // jsdom does not implement matchMedia; ThemeContext depends on it.
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })

  for (const key of [
    'window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage',
    'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'CustomEvent',
    'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'requestAnimationFrame',
    'cancelAnimationFrame', 'DOMParser', 'XMLHttpRequest', 'FormData', 'Blob', 'File',
    'FileReader', 'crypto',
  ]) {
    if (globalThis[key] === undefined && window[key] !== undefined) {
      globalThis[key] = window[key]
    }
  }
  globalThis.window = window
  globalThis.document = window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
}

function setInputValue(el, value) {
  const proto = el instanceof window.HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
  setter.call(el, value)
  el.dispatchEvent(new window.Event('input', { bubbles: true }))
}

function click(el) {
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
}

/**
 * jsdom does not run implicit form submission when a submit button is clicked,
 * so dispatch the submit event the way the browser would.
 */
function submitForm(el) {
  const form = el.closest('form')
  assert.ok(form, 'element should be inside a form')
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
}

const text = () => dom.window.document.body.textContent || ''
const html = () => dom.window.document.body.innerHTML

function byText(selector, needle) {
  const nodes = [...dom.window.document.querySelectorAll(selector)]
  return nodes.find((n) => (n.textContent || '').trim().includes(needle))
}

// Long enough per tick to let the demo backend's simulated latency settle.
async function flush(times = 8) {
  for (let i = 0; i < times; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
  }
}

before(async () => {
  installGlobals()
  React = await import('react')
  const ReactDOM = await import('react-dom/client')
  const { createServer } = await import('vite')

  vite = await createServer({
    root: process.cwd(),
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    envDir: process.cwd(),
  })

  const mod = await vite.ssrLoadModule('/src/App.jsx')
  App = mod.default
  act = React.act

  renderModule = ReactDOM
})

after(async () => {
  if (vite) await vite.close()
  if (dom) dom.window.close()
})

test('the app boots to the sign-in screen (no Firebase config => demo setup)', async () => {
  const container = dom.window.document.getElementById('root')
  const root = renderModule.createRoot(container)

  await act(async () => {
    root.render(React.createElement(App))
  })
  await flush()

  assert.match(text(), /Sadiq Travels/, 'brand should render')
  assert.match(text(), /Set up the first administrator/, 'empty admins list should offer first-run setup')
  assert.ok(dom.window.document.querySelector('input[type="email"]'), 'email field should render')
  assert.ok(dom.window.document.querySelector('input[type="password"]'), 'password field should render')

  globalThis.__stRoot = root
})

test('creating the first admin signs in and renders the dashboard shell', async () => {
  const doc = dom.window.document

  const nameInput = doc.querySelector('input[autocomplete="name"]')
  assert.ok(nameInput, 'setup mode should ask for a display name')
  await act(async () => {
    setInputValue(nameInput, 'Owner')
  })

  await act(async () => {
    setInputValue(doc.querySelector('input[type="email"]'), 'owner@example.com')
  })
  await act(async () => {
    setInputValue(doc.querySelector('input[type="password"]'), 'secret123')
  })

  const submit = byText('button[type="submit"]', 'Create account')
  assert.ok(submit, 'submit button should read "Create account"')
  await act(async () => {
    submitForm(submit)
  })
  await flush(6)

  if (!/Dashboard/.test(text())) {
    // eslint-disable-next-line no-console
    console.log('BODY AFTER SUBMIT >>>', text().slice(0, 900))
  }
  assert.match(text(), /Dashboard/, 'dashboard nav should be visible after sign-in')
  assert.match(text(), /Funders/, 'funders nav should be visible')
  assert.match(text(), /Demo mode/, 'demo status pill should be shown')
  assert.ok(doc.querySelector('.sidebar'), 'sidebar should render')
  assert.match(html(), /stat-card/, 'stat cards should render')
})

test('adding a funder on the Funders page shows up in the table', async () => {
  const doc = dom.window.document

  const nav = byText('.nav-item', 'Funders')
  assert.ok(nav, 'Funders nav item should exist')
  await act(async () => {
    click(nav)
  })
  await flush(6)

  assert.match(text(), /Funders \(donors\)/, 'funders page heading should render')

  const nameField = [...doc.querySelectorAll('.card form .field')].find((f) =>
    (f.textContent || '').includes('Funder name'),
  )
  assert.ok(nameField, 'add-funder form should have a name field')

  await act(async () => {
    setInputValue(nameField.querySelector('input'), 'Karim Uddin')
  })
  const addBtn = byText('.card form button[type="submit"]', 'Add funder')
  await act(async () => {
    submitForm(addBtn)
  })
  await flush(6)

  assert.match(text(), /Karim Uddin/, 'the new funder should appear in the list')
  assert.match(text(), /Showing 1 of 1/, 'the count footer should update')
})

test('the donations page records an amount for the new funder', async () => {
  const doc = dom.window.document

  await act(async () => {
    click(byText('.nav-item', 'Donations'))
  })
  await flush(6)

  assert.match(text(), /Monthly donations/, 'donations page heading should render')
  assert.match(text(), /Karim Uddin/, 'funder should be listed for the month')

  const row = [...doc.querySelectorAll('tbody tr')].find((r) =>
    (r.textContent || '').includes('Karim Uddin'),
  )
  assert.ok(row, 'donation row should exist')

  await act(async () => {
    click(row.querySelector('input[type="checkbox"]'))
  })
  await flush(3)

  const amount = row.querySelector('.amount-input')
  assert.ok(amount, 'amount input should be present')
  await act(async () => {
    setInputValue(amount, '2500')
  })

  await act(async () => {
    click(byText('.head-actions button', 'Save'))
  })
  await flush(8)

  assert.match(text(), /Saved 1 donor/, 'success toast should confirm the save')
  assert.match(text(), /September 2026|October 2026|20\d\d/, 'a month label should render')
})

test('switching language re-renders the whole shell in Bangla', async () => {
  const doc = dom.window.document

  const bn = byText('.lang-btn', 'বাংলা')
  assert.ok(bn, 'Bangla language toggle should exist')
  await act(async () => {
    click(bn)
  })
  await flush(3)

  assert.equal(doc.documentElement.lang, 'bn')
  assert.equal(doc.documentElement.dataset.lang, 'bn')
  assert.match(text(), /ড্যাশবোর্ড/, 'nav should switch to Bangla')
  assert.equal(dom.window.localStorage.getItem('sadik-travels.lang'), 'bn')
})

test('the theme toggle writes a resolved theme to <html>', async () => {
  const doc = dom.window.document
  const before = doc.documentElement.dataset.theme

  const toggle = doc.querySelector('.topbar-actions .icon-action')
  assert.ok(toggle, 'theme toggle should render in the topbar')
  await act(async () => {
    click(toggle)
  })
  await flush(2)

  const after = doc.documentElement.dataset.theme
  assert.notEqual(after, before, 'theme should change')
  assert.ok(['light', 'dark'].includes(after))
})
