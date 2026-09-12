// Shared database setup (used by both Netlify Functions and the Vite dev server).
//
// Required env vars:
//   TURSO_DB_URL       - libSQL connection URL (libsql://xxx.turso.io or http://...)
//   TURSO_DB_AUTH_TOKEN - Turso database auth token (optional for local dev)
//   ADMIN_EMAIL        - email used to seed the first admin account
//   ADMIN_PASSWORD     - password used to seed the first admin account
//   JWT_SECRET         - secret used to sign JWT tokens (set a long random string)

import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'

function getEnv(name, fallback = '') {
  // Netlify provides env vars on process.env; the Vite dev plugin injects
  // them the same way, so a single lookup works.
  return (process.env[name] ?? fallback).toString().trim()
}

const url = getEnv('TURSO_DB_URL')
const authToken = getEnv('TURSO_DB_AUTH_TOKEN')

export const hasDbConfig = Boolean(url)

export const db = hasDbConfig
  ? createClient({
      url,
      authToken: authToken || undefined,
    })
  : null

// Run the DB migrations (idempotent). Call this on startup / first request.
const migrated = { done: false }

export async function migrate() {
  if (!db) throw new Error('TURSO_DB_URL is not configured')
  if (migrated.done) return

  await db.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at INTEGER NOT NULL,
      last_login_at INTEGER
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS funders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at INTEGER NOT NULL
    )
  `)

  // Donations are stored keyed by month (YYYY-MM) and funder id.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS donations (
      month TEXT NOT NULL,                -- 'YYYY-MM'
      funder_id INTEGER NOT NULL,
      name TEXT NOT NULL,                 -- snapshot of funder name at save time
      phone TEXT DEFAULT '',              -- snapshot of phone at save time
      amount REAL NOT NULL,
      saved_at INTEGER NOT NULL,
      PRIMARY KEY (month, funder_id),
      FOREIGN KEY (funder_id) REFERENCES funders(id) ON DELETE CASCADE
    )
  `)

  migrated.done = true
}

// Seed a default admin from env vars when the admins table is empty.
// Called once per cold start.
export async function seedDefaultAdmin() {
  if (!db) return
  const email = getEnv('ADMIN_EMAIL')
  const password = getEnv('ADMIN_PASSWORD')
  if (!email || !password) return

  const { rows } = await db.execute('SELECT COUNT(*) AS c FROM admins')
  if (Number(rows[0]?.c) > 0) return

  const hash = await bcrypt.hash(password, 10)
  await db.execute({
    sql: 'INSERT INTO admins (email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?)',
    args: [email.toLowerCase(), hash, 'Default Admin', Date.now()],
  })
  // eslint-disable-next-line no-console
  console.log(`Seeded default admin: ${email}`)
}

export async function initDb() {
  if (!hasDbConfig) return
  await migrate()
  await seedDefaultAdmin()
}
