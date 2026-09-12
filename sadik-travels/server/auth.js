// JWT helpers + admin record helpers shared by API routes.
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { db } from './db.js'

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days
const COOKIE_NAME = 'st_token'

function getSecret() {
  const s = process.env.JWT_SECRET || 'dev-insecure-secret-change-me'
  return s
}

export function signToken(admin) {
  return jwt.sign(
    { sub: String(admin.id), email: admin.email },
    getSecret(),
    { expiresIn: TOKEN_TTL_SECONDS },
  )
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret())
  } catch (_e) {
    return null
  }
}

// Extract the authenticated admin id/email from a request (cookie or
// Authorization header). Returns null when not signed in.
export function getAuth(req) {
  // Cookie
  const cookieHeader = req.headers?.cookie || ''
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`))
  if (match && match[1]) {
    const payload = verifyToken(decodeURIComponent(match[1]))
    if (payload) return { id: Number(payload.sub), email: payload.email }
  }
  // Authorization: Bearer <token>
  const authHeader = req.headers?.authorization || ''
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    const payload = verifyToken(token)
    if (payload) return { id: Number(payload.sub), email: payload.email }
  }
  return null
}

export function setAuthCookie(res, token) {
  const expires = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toUTCString()
  const isProd = process.env.NODE_ENV === 'production'
  // Netlify preview sites use https, so Secure is safe in production.
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Expires=${expires}; Path=/; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`,
  )
}

export function clearAuthCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; SameSite=Lax`,
  )
}

// Look up an admin by email (lowercase match).
export async function findAdminByEmail(email) {
  if (!db) return null
  const { rows } = await db.execute({
    sql: 'SELECT id, email, password_hash, display_name FROM admins WHERE email = ?',
    args: [String(email || '').toLowerCase().trim()],
  })
  return rows[0] || null
}

export async function findAdminById(id) {
  if (!db) return null
  const { rows } = await db.execute({
    sql: 'SELECT id, email, display_name, created_at, last_login_at FROM admins WHERE id = ?',
    args: [Number(id)],
  })
  return rows[0] || null
}

export async function verifyPassword(admin, password) {
  if (!admin || !password) return false
  return bcrypt.compare(password, admin.password_hash)
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

export async function recordLogin(id) {
  if (!db) return
  await db.execute({
    sql: 'UPDATE admins SET last_login_at = ? WHERE id = ?',
    args: [Date.now(), Number(id)],
  })
}

export { COOKIE_NAME, TOKEN_TTL_SECONDS }
