// All API routes. Exposes a Node `(req, res) => void` handler (no Express
// needed) that works both inside a Netlify Function adapter and inside a
// small Vite dev-server middleware.

import bcrypt from 'bcryptjs'
import { initDb, db, hasDbConfig } from './db.js'
import {
  getAuth,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  findAdminByEmail,
  findAdminById,
  verifyPassword,
  hashPassword,
  recordLogin,
} from './auth.js'

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message })
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function lower(str) {
  return String(str || '').toLowerCase().trim()
}

function requireAuth(req, res) {
  const auth = getAuth(req)
  if (!auth) {
    sendError(res, 401, 'Not signed in.')
    return null
  }
  return auth
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleHealth(_req, res) {
  if (!hasDbConfig) {
    return sendJson(res, 200, { ok: true, configured: false, demo: true })
  }
  try {
    await initDb()
    await db.execute('SELECT 1')
    sendJson(res, 200, { ok: true, configured: true, demo: false })
  } catch (e) {
    sendJson(res, 500, { ok: false, configured: true, error: e.message })
  }
}

// POST /api/auth/login  { email, password }
async function handleLogin(req, res) {
  if (!hasDbConfig) return sendError(res, 503, 'Database not configured.')
  const body = await readJson(req)
  const email = lower(body.email)
  const password = String(body.password || '')
  if (!email || !password) return sendError(res, 400, 'Email and password are required.')

  await initDb()
  const admin = await findAdminByEmail(email)
  if (!admin) return sendError(res, 401, 'Incorrect email or password.')
  const ok = await verifyPassword(admin, password)
  if (!ok) return sendError(res, 401, 'Incorrect email or password.')

  await recordLogin(admin.id)
  const token = signToken(admin)
  setAuthCookie(res, token)
  sendJson(res, 200, {
    user: { id: admin.id, email: admin.email, displayName: admin.display_name || null },
  })
}

// POST /api/auth/logout
async function handleLogout(_req, res) {
  clearAuthCookie(res)
  sendJson(res, 200, { ok: true })
}

// GET  /api/auth/me
async function handleMe(req, res) {
  if (!hasDbConfig) return sendError(res, 503, 'Database not configured.')
  const auth = getAuth(req)
  if (!auth) return sendJson(res, 200, { user: null })
  await initDb()
  const admin = await findAdminById(auth.id)
  if (!admin) {
    clearAuthCookie(res)
    return sendJson(res, 200, { user: null })
  }
  sendJson(res, 200, {
    user: {
      id: admin.id,
      email: admin.email,
      displayName: admin.display_name || null,
      createdAt: admin.created_at,
      lastLoginAt: admin.last_login_at,
    },
  })
}

// ---------- Funders ----------

async function listFunders(_req, res) {
  const { rows } = await db.execute(
    'SELECT id, name, phone, note, created_at AS createdAt FROM funders ORDER BY name COLLATE NOCASE ASC',
  )
  sendJson(res, 200, rows)
}

async function createFunder(req, res) {
  const body = await readJson(req)
  const name = String(body.name || '').trim()
  if (!name) return sendError(res, 400, 'Funder name is required.')
  const phone = String(body.phone || '').trim()
  const note = String(body.note || '').trim()
  const ts = Date.now()
  const r = await db.execute({
    sql: 'INSERT INTO funders (name, phone, note, created_at) VALUES (?, ?, ?, ?)',
    args: [name, phone, note, ts],
  })
  sendJson(res, 201, { id: Number(r.lastInsertRowid), name, phone, note, createdAt: ts })
}

async function updateFunder(req, res, id) {
  const body = await readJson(req)
  const name = String(body.name || '').trim()
  if (!name) return sendError(res, 400, 'Funder name is required.')
  const phone = String(body.phone || '').trim()
  const note = String(body.note || '').trim()
  const { rowsAffected } = await db.execute({
    sql: 'UPDATE funders SET name = ?, phone = ?, note = ? WHERE id = ?',
    args: [name, phone, note, Number(id)],
  })
  if (!rowsAffected) return sendError(res, 404, 'Funder not found.')
  sendJson(res, 200, { ok: true })
}

async function deleteFunder(_req, res, id) {
  // FK cascade will clear orphaned donation rows.
  const { rowsAffected } = await db.execute({
    sql: 'DELETE FROM funders WHERE id = ?',
    args: [Number(id)],
  })
  if (!rowsAffected) return sendError(res, 404, 'Funder not found.')
  sendJson(res, 200, { ok: true })
}

// ---------- Donations ----------

async function getMonthDonations(_req, res, month) {
  // Returns every saved donation for the given month (YYYY-MM) plus an
  // `orphan` flag for entries whose funder was deleted.
  const { rows } = await db.execute({
    sql: `SELECT d.funder_id AS funderId, d.name, d.phone, d.amount, d.saved_at AS savedAt,
                 (f.id IS NULL) AS orphan
          FROM donations d LEFT JOIN funders f ON f.id = d.funder_id
          WHERE d.month = ? ORDER BY d.name COLLATE NOCASE ASC`,
    args: [month],
  })
  // Cast integer booleans.
  const out = rows.map((r) => ({ ...r, orphan: !!r.orphan }))
  sendJson(res, 200, out)
}

async function saveMonthDonations(req, res, month) {
  const body = await readJson(req)
  const updates = Array.isArray(body.updates) ? body.updates : []
  const removes = Array.isArray(body.removes) ? body.removes : []

  // Validate amounts.
  for (const u of updates) {
    const amt = Number(u.amount)
    if (!u.funderId || !amt || amt <= 0) {
      return sendError(res, 400, 'Each selected funder needs a positive amount.')
    }
  }

  const ts = Date.now()
  const tx = await db.transaction('write')
  try {
    for (const u of updates) {
      // Snapshot current funder name/phone so past records remain legible
      // even if the funder is later renamed/deleted.
      const { rows } = await tx.execute({
        sql: 'SELECT name, phone FROM funders WHERE id = ?',
        args: [Number(u.funderId)],
      })
      if (rows.length === 0) throw new Error(`Funder ${u.funderId} not found`)
      const name = String(u.name || rows[0].name).trim() || rows[0].name
      const phone = u.phone != null ? String(u.phone).trim() : rows[0].phone

      await tx.execute({
        sql: `INSERT INTO donations (month, funder_id, name, phone, amount, saved_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(month, funder_id) DO UPDATE SET
                name = excluded.name,
                phone = excluded.phone,
                amount = excluded.amount,
                saved_at = excluded.saved_at`,
        args: [month, Number(u.funderId), name, phone, Number(u.amount), ts],
      })
    }
    for (const id of removes) {
      await tx.execute({
        sql: 'DELETE FROM donations WHERE month = ? AND funder_id = ?',
        args: [month, Number(id)],
      })
    }
    await tx.commit()
  } catch (e) {
    try { await tx.rollback() } catch (_) { /* noop */ }
    return sendError(res, 400, e.message || 'Save failed.')
  }

  // Return fresh data for the month.
  const { rows } = await db.execute({
    sql: `SELECT d.funder_id AS funderId, d.name, d.phone, d.amount, d.saved_at AS savedAt,
                 (f.id IS NULL) AS orphan
          FROM donations d LEFT JOIN funders f ON f.id = d.funder_id
          WHERE d.month = ? ORDER BY d.name COLLATE NOCASE ASC`,
    args: [month],
  })
  sendJson(res, 200, rows.map((r) => ({ ...r, orphan: !!r.orphan })))
}

// GET /api/donations/totals  => { total, totalThisMonth, totalThisYear, recent }
async function getTotals(_req, res) {
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const thisMonth = `${yyyy}-${mm}`

  const all = await db.execute(
    'SELECT month, funder_id AS funderId, name, amount, saved_at AS savedAt FROM donations',
  )

  let total = 0
  let totalThisMonth = 0
  let totalThisYear = 0
  let donorMonths = 0
  const monthsSet = new Set()
  const recent = []

  for (const r of all.rows) {
    const amt = Number(r.amount) || 0
    total += amt
    donorMonths += 1
    monthsSet.add(r.month)
    if (r.month === thisMonth) totalThisMonth += amt
    if (r.month.startsWith(yyyy)) totalThisYear += amt
    recent.push({ ...r, amount: amt })
  }
  recent.sort((a, b) => (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0))

  sendJson(res, 200, {
    total,
    totalThisMonth,
    totalThisYear,
    donorMonths,
    monthsWithData: monthsSet.size,
    recent: recent.slice(0, 6),
  })
}

// ---------- Admins (admin management) ----------

async function listAdmins(_req, res) {
  const { rows } = await db.execute(
    'SELECT id, email, display_name AS displayName, created_at AS createdAt, last_login_at AS lastLoginAt FROM admins ORDER BY id ASC',
  )
  sendJson(res, 200, rows)
}

async function createAdmin(req, res) {
  const body = await readJson(req)
  const email = lower(body.email)
  const password = String(body.password || '')
  const displayName = String(body.displayName || '').trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendError(res, 400, 'A valid email address is required.')
  }
  if (password.length < 6) {
    return sendError(res, 400, 'Password must be at least 6 characters.')
  }
  const existing = await findAdminByEmail(email)
  if (existing) return sendError(res, 400, 'An admin with that email already exists.')
  const hash = await hashPassword(password)
  const ts = Date.now()
  const r = await db.execute({
    sql: 'INSERT INTO admins (email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?)',
    args: [email, hash, displayName || null, ts],
  })
  sendJson(res, 201, {
    id: Number(r.lastInsertRowid),
    email,
    displayName: displayName || null,
    createdAt: ts,
    lastLoginAt: null,
  })
}

async function updateAdmin(req, res, id) {
  const body = await readJson(req)
  const existing = await findAdminById(Number(id))
  if (!existing) return sendError(res, 404, 'Admin not found.')

  const patch = {}
  if (body.email !== undefined) {
    const email = lower(body.email)
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendError(res, 400, 'A valid email address is required.')
    }
    if (email !== existing.email) {
      const dup = await findAdminByEmail(email)
      if (dup && dup.id !== Number(id)) {
        return sendError(res, 400, 'An admin with that email already exists.')
      }
    }
    patch.email = email
  } else {
    patch.email = existing.email
  }
  patch.displayName = body.displayName !== undefined
    ? (String(body.displayName || '').trim() || null)
    : existing.display_name

  await db.execute({
    sql: 'UPDATE admins SET email = ?, display_name = ? WHERE id = ?',
    args: [patch.email, patch.displayName, Number(id)],
  })

  // Password change is optional.
  if (body.password && String(body.password).length > 0) {
    if (String(body.password).length < 6) {
      return sendError(res, 400, 'Password must be at least 6 characters.')
    }
    const hash = await hashPassword(String(body.password))
    await db.execute({
      sql: 'UPDATE admins SET password_hash = ? WHERE id = ?',
      args: [hash, Number(id)],
    })
  }

  sendJson(res, 200, { ok: true })
}

async function deleteAdmin(req, res, id, currentAuth) {
  const targetId = Number(id)
  if (targetId === currentAuth.id) {
    return sendError(res, 400, 'You cannot delete your own account while signed in.')
  }
  const { rows } = await db.execute({
    sql: 'SELECT COUNT(*) AS c FROM admins',
    args: [],
  })
  if (Number(rows[0]?.c) <= 1) {
    return sendError(res, 400, 'There must be at least one admin.')
  }
  const { rowsAffected } = await db.execute({
    sql: 'DELETE FROM admins WHERE id = ?',
    args: [targetId],
  })
  if (!rowsAffected) return sendError(res, 404, 'Admin not found.')
  sendJson(res, 200, { ok: true })
}

// POST /api/admins/:id/change-password  (change own password — requires currentPassword)
async function changePassword(req, res, id, currentAuth) {
  const targetId = Number(id)
  if (targetId !== currentAuth.id) {
    return sendError(res, 403, 'You can only change your own password here.')
  }
  const body = await readJson(req)
  const currentPassword = String(body.currentPassword || '')
  const newPassword = String(body.newPassword || '')
  if (!currentPassword || !newPassword) {
    return sendError(res, 400, 'Current and new password are required.')
  }
  if (newPassword.length < 6) {
    return sendError(res, 400, 'New password must be at least 6 characters.')
  }
  const admin = await db.execute({
    sql: 'SELECT password_hash FROM admins WHERE id = ?',
    args: [targetId],
  })
  if (!admin.rows[0]) return sendError(res, 404, 'Admin not found.')
  const ok = await bcryptCompare(currentPassword, admin.rows[0].password_hash)
  if (!ok) return sendError(res, 401, 'Current password is incorrect.')
  const hash = await hashPassword(newPassword)
  await db.execute({
    sql: 'UPDATE admins SET password_hash = ? WHERE id = ?',
    args: [hash, targetId],
  })
  sendJson(res, 200, { ok: true })
}

function bcryptCompare(plain, hash) {
  return bcrypt.compare(plain, hash)
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function handleApi(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost')
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    const method = req.method.toUpperCase()

    // Public (no auth) routes.
    if (method === 'GET' && pathname === '/api/health') return handleHealth(req, res)
    if (method === 'POST' && pathname === '/api/auth/login') return handleLogin(req, res)
    if (method === 'GET' && pathname === '/api/auth/me') return handleMe(req, res)
    if (method === 'POST' && pathname === '/api/auth/logout') return handleLogout(req, res)

    // Everything past this point requires auth + DB.
    if (!hasDbConfig) return sendError(res, 503, 'Database not configured.')
    await initDb()
    const auth = requireAuth(req, res)
    if (!auth) return

    // Funders
    if (method === 'GET' && pathname === '/api/funders') return listFunders(req, res)
    if (method === 'POST' && pathname === '/api/funders') return createFunder(req, res)

    const funderMatch = pathname.match(/^\/api\/funders\/(\d+)$/)
    if (funderMatch) {
      if (method === 'PUT' || method === 'PATCH') return updateFunder(req, res, funderMatch[1])
      if (method === 'DELETE') return deleteFunder(req, res, funderMatch[1])
    }

    // Donations
    const monthMatch = pathname.match(/^\/api\/donations\/(\d{4}-\d{2})$/)
    if (monthMatch) {
      if (method === 'GET') return getMonthDonations(req, res, monthMatch[1])
      if (method === 'PUT' || method === 'POST') return saveMonthDonations(req, res, monthMatch[1])
    }
    if (method === 'GET' && pathname === '/api/donations/totals') return getTotals(req, res)

    // Admins
    if (method === 'GET' && pathname === '/api/admins') return listAdmins(req, res)
    if (method === 'POST' && pathname === '/api/admins') return createAdmin(req, res)

    const adminMatch = pathname.match(/^\/api\/admins\/(\d+)$/)
    if (adminMatch) {
      if (method === 'PUT' || method === 'PATCH') return updateAdmin(req, res, adminMatch[1])
      if (method === 'DELETE') return deleteAdmin(req, res, adminMatch[1], auth)
    }
    const pwMatch = pathname.match(/^\/api\/admins\/(\d+)\/change-password$/)
    if (pwMatch && method === 'POST') {
      return changePassword(req, res, pwMatch[1], auth)
    }

    sendError(res, 404, 'Not found.')
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[api]', e)
    if (!res.writableEnded) sendError(res, 500, e.message || 'Server error')
  }
}
