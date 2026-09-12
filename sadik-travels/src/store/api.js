// Thin fetch wrapper around the /api backend. Uses httpOnly cookies for
// auth (no tokens stored in JS), works against both the Vite dev server
// and Netlify production because the URL is always same-origin /api/*.

async function request(method, path, body, { signal } = {}) {
  const opts = {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  }
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(`/api${path}`, opts)
  } catch (e) {
    throw new Error('Network error. Check your connection and try again.')
  }
  let data = null
  const text = await res.text()
  if (text) {
    try { data = JSON.parse(text) } catch { data = { error: text } }
  }
  if (!res.ok) {
    const msg = (data && data.error) || `Request failed (${res.status}).`
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  health: () => request('GET', '/health'),

  // auth
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/auth/me'),

  // funders
  listFunders: () => request('GET', '/funders'),
  createFunder: (data) => request('POST', '/funders', data),
  updateFunder: (id, data) => request('PUT', `/funders/${id}`, data),
  deleteFunder: (id) => request('DELETE', `/funders/${id}`),

  // donations
  getTotals: () => request('GET', '/donations/totals'),
  getMonth: (month) => request('GET', `/donations/${month}`),
  saveMonth: (month, { updates, removes }) =>
    request('PUT', `/donations/${month}`, { updates, removes }),

  // admins
  listAdmins: () => request('GET', '/admins'),
  createAdmin: (data) => request('POST', '/admins', data),
  updateAdmin: (id, data) => request('PUT', `/admins/${id}`, data),
  deleteAdmin: (id) => request('DELETE', `/admins/${id}`),
  changePassword: (id, currentPassword, newPassword) =>
    request('POST', `/admins/${id}/change-password`, { currentPassword, newPassword }),
}

export function isConfiguredFromHealth(health) {
  return !!(health && health.configured && !health.demo)
}
