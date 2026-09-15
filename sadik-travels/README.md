# Sadiq Travels — Donor & Monthly Donation Manager

A fully client-side admin web app: **Firebase Authentication** for sign-in,
**Firestore** for data, **React + Vite** for the UI. There is no backend to
host, so it deploys to Vercel, Netlify, Cloudflare Pages or plain static
hosting with no configuration beyond environment variables.

| Page | What it does |
| --- | --- |
| **Dashboard** | Totals for funders / this month / this year / all time, a 12-month collection chart, and the most recent donations. |
| **Funders** | Add, edit, delete and search donors (name, phone, note). Live-updating list. |
| **Donations** | Pick a month (or use ‹ ›), tick funders, enter amounts, **Save**. Every month is kept permanently. Includes a bulk-amount helper and a printable sheet. |
| **Admins** | Add, edit, remove administrators, send password-reset emails, change your own password. |

Also: **English ⇄ বাংলা** switch, **light/dark** themes, offline-tolerant
Firestore cache, and a demo mode (localStorage) when no Firebase config is
present so the UI is always reviewable.

---

## 1. Create the Firebase project

1. [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** (production mode).
4. *(Optional)* **Build → Realtime Database → Create Database** — only if you
   want donations stored there instead of in Firestore.
5. **Project settings → General → Your apps → Web app (`</>`)** → register an
   app and copy the `firebaseConfig` values.

## 2. Run locally

```bash
cd sadik-travels
npm install
cp .env.example .env
```

Fill `.env` with the values from step 1.5 — **every key must start with
`VITE_`**:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-app
VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef123456
# optional — stores donations in the Realtime Database instead of Firestore
VITE_FIREBASE_DATABASE_URL=
# optional — auto-creates the first admin while the admins table is empty
VITE_SEED_ADMIN_EMAIL=
VITE_SEED_ADMIN_PASSWORD=
```

```bash
npm run dev      # http://localhost:5173
```

> No `.env`? The app boots in **demo mode** and says so on screen. Data then
> lives in `localStorage` for that browser only.

## 3. First administrator

The `admins` collection starts empty, so the sign-in screen switches to
**"Set up the first administrator"**. Create the owner account there.

Alternatively set `VITE_SEED_ADMIN_EMAIL` / `VITE_SEED_ADMIN_PASSWORD`: while
the collection is empty, signing in with exactly those credentials creates the
owner automatically. Both values are ignored from then on.

## 4. Security rules

Rules ship in this folder — deploy them once:

```bash
npm i -g firebase-tools
firebase login
firebase use <your-project-id>
firebase deploy --only firestore:rules,database
```

- `firestore.rules` — admins, funders, donations, month aggregates.
- `database.rules.json` — only used when the Realtime Database is enabled.

> **⚠ Lock down after first run.** Creating the very first admin has to be
> allowed before any admin exists. Once the owner account is created, change
> the `allow create` line in `firestore.rules` (and the `/admins` `.write`
> line in `database.rules.json`) to require an existing admin, then redeploy.
> Both files mark the exact line.

## 5. Deploy to Vercel

1. **Add New → Project → Import** this GitHub repository.
2. **Root Directory:** `sadik-travels`.
   (`vercel.json` there sets the build command, SPA rewrite and cache headers.
   A root-level `vercel.json` covers the case where you leave the root as the
   repo root.)
3. **Environment Variables** — add all `VITE_FIREBASE_*` keys for
   **Production** *and* **Preview**.
4. **Deploy**, then **Redeploy** any time you change a variable.

### Why "works locally but not on Vercel" happens

Vite copies environment variables into the client bundle **at build time**, and
only those prefixed with `VITE_`. So the app silently falls back to demo mode
when any of these is true:

| Symptom | Cause |
| --- | --- |
| Values are set in the dashboard but the app says demo mode | No **redeploy** after adding them. |
| One key works, others don't | The key is missing the `VITE_` prefix. |
| Works in `npm run dev`, not in production | `.env` is local-only (and git-ignored); production needs the dashboard values. |
| Sign-in says the domain is unauthorised | **Authentication → Settings → Authorized domains** does not list the Vercel domain. |

The app is built to make this impossible to miss:

- `npm run build` prints exactly which `VITE_FIREBASE_*` keys are missing.
- The browser console warns on boot with the missing key names.
- The amber banner in the UI lists every key with a ✓/✗, shows where the
  config came from, and has a copy button for the whole template.

### Repoint a live build without redeploying

Edit [`public/config.js`](./public/config.js) and fill in
`window.__ST_CONFIG__`. Anything set there overrides the build-time env vars.

## 6. Data model

**Firestore**

```
admins/{uid}                              { email, displayName, role, createdAt, lastLoginAt }
funders/{id}                              { name, phone, note, createdAt, updatedAt }
donations/{YYYY-MM}/entries/{funderId}    { name, phone, amount, savedAt }
months/{YYYY-MM}                          { total, count, recent[], updatedAt }
```

**Realtime Database** (only when `VITE_FIREBASE_DATABASE_URL` is set)

```
admins/{uid}          true
donations/{YYYY-MM}/{funderId}   { name, phone, amount, savedAt }
```

Donor name and phone are snapshotted onto each donation row, so renaming or
deleting a funder never rewrites history.

`months/{YYYY-MM}` is a small aggregate maintained on every save; it lets the
dashboard compute all-time totals without reading every donation document.

## 7. Checks

```bash
npm test        # 38 tests: config resolution, totals maths, i18n parity,
                # plus a jsdom render test that signs in, adds a funder,
                # records a donation and switches language
npm run check   # tests + production build
```

## 8. Notes

- Currency is Bangladeshi Taka (৳). Bengali numerals are used automatically in
  বাংলা mode.
- Deleting a funder also deletes their saved donation rows.
- Firebase only lets an admin change **their own** password from the browser.
  For anyone else, use **Send reset email** on the Admins page.
- Removing an admin deletes their roster entry, which blocks them at the next
  sign-in; the Firebase Auth user itself can be deleted in the console.
- Amounts are in Bangladeshi Taka; the print stylesheet produces a clean
  monthly sheet.
