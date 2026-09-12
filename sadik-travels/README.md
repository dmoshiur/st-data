# Sadiq Travels — Donor & Monthly Donation Manager

A fully-English admin web app for **Sadiq Travels** to manage funders (donors)
and record monthly donations. Built with:

- **Turso (libSQL)** — persistent relational database for funders, donations
  and admin accounts.
- **Netlify Functions** — serverless backend that signs JWTs, talks to Turso,
  and exposes a small `/api/*` surface to the React frontend.
- **JWT + bcrypt auth** — passwords are hashed with bcrypt; sessions are
  httpOnly cookies signed with a `JWT_SECRET`.
- **React + Vite** — frontend.

When no database is configured (e.g. previewing locally without a `.env`), the
app falls back to a browser-only **demo mode** backed by `localStorage` so the
UI stays usable with the credentials `demo@example.com` / `demo123`.

---

## What the app does

| Page | Purpose |
| --- | --- |
| **Dashboard** | Live totals: funders, this month, this year, all time + recent donations. |
| **Funders** | Add / edit / delete / search funder names (with optional phone & note). |
| **Donations** | Pick a month (or use ‹ › to switch months), tick funders, enter each amount, and **Save**. Every month is kept permanently and can be viewed again by selecting that month. |
| **Admins** | Add, edit and remove administrator accounts. Also change your own password. |

---

## 1. One-time setup

### 1.1 Create a Turso database

1. Sign up at [https://turso.tech](https://turso.tech) and create a database
   (e.g. `sadik-travels`).
2. From the database page, copy the **Database URL** (`libsql://…`) and create
   an **Auth Token** (both are in the "Getting Started" / "Tokens" tabs).

### 1.2 Generate a JWT secret

Pick a long random string for signing session tokens. On macOS / Linux:

```bash
openssl rand -hex 32
```

### 1.3 Decide on your first admin

Choose an email and password for the default administrator. The app will
auto-create that account the first time it boots (only when the admins table
is empty). After that you can add/edit/remove admins from the **Admins** page.

---

## 2. Run locally

```bash
cd sadik-travels
npm install
cp .env.example .env
```

Edit `.env` and fill in your values:

```
TURSO_DB_URL=libsql://your-db.turso.io
TURSO_DB_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
JWT_SECRET=paste-the-long-random-string
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=your-strong-password
```

Then start the dev server (the API runs in-process via a Vite plugin — no
separate backend to run):

```bash
npm run dev
```

Open http://localhost:5173 and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

> If you skip `.env`, the app still boots in **demo mode** with an in-browser
> store. Sign in with `demo@example.com` / `demo123`.

---

## 3. Deploy to Netlify

The repo ships with a `netlify.toml` that configures the build and the `/api/*`
rewrite to the serverless function in `netlify/functions/api.mjs`.

1. Push this repository to **GitHub**.
2. In Netlify: **Add new site → Import an existing project → connect GitHub → choose the repo**.
   - Build command: `npm run build` (already set in `netlify.toml`)
   - Publish directory: `dist` (already set)
   - Functions directory: `netlify/functions` (already set)
3. Go to **Site configuration → Environment variables** and add:

   | Key | Value |
   | --- | --- |
   | `TURSO_DB_URL` | Your Turso `libsql://…` URL |
   | `TURSO_DB_AUTH_TOKEN` | Your Turso auth token |
   | `JWT_SECRET` | Long random string |
   | `ADMIN_EMAIL` | Email for the first admin (one-time seed) |
   | `ADMIN_PASSWORD` | Password for the first admin (one-time seed) |

4. Trigger a deploy. The site will come up at `https://<your-site>.netlify.app`.
   Sign in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

> **Important:** Environment variables are read **at runtime** by the
> serverless functions (not baked into the build). If you change them in the
> Netlify dashboard, just wait a moment for the function to cold-start again
> — no redeploy is required.
>
> To change the default admin later, go to the **Admins** page inside the app
> (the env vars are only used on a completely empty `admins` table).

---

## How data is stored (Turso schema)

Three tables are created automatically on first run:

- **admins** — `id, email (unique), password_hash (bcrypt), display_name, created_at, last_login_at`
- **funders** — `id, name, phone, note, created_at`
- **donations** — `(month, funder_id) PK, name, phone, amount, saved_at`
  - Month key is `YYYY-MM`. Funder name/phone are snapshotted at save time so
    renaming or deleting a funder does not rewrite past donation records.

---

## Notes

- The interface is entirely in **English**.
- Donations are in **Bangladeshi Taka (৳)** by default; you can rename the
  currency anywhere `৳` appears in the code if needed.
- Deleting a funder also removes their monthly donation rows.
- All admin passwords are hashed with bcrypt before storage.
