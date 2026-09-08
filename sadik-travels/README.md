# Sadiq Travels — Donor & Monthly Donation Manager

A fully-English admin web app for **Sadiq Travels** to manage funders (donors) and
record monthly donations. Built with:

- **Firebase Authentication** (Email/Password) — the admin signs in. You create the
  admin account in the Firebase Console.
- **Firestore** — stores the **Funders (donors)** list.
- **Realtime Database** — stores the **monthly donation records**.
- **React + Vite** — frontend.

---

## What the app does

| Page | Purpose |
| --- | --- |
| **Dashboard** | Live totals: funders, this month, this year, all time + recent donations. |
| **Funders** | Add / edit / delete / search funder names (with optional phone & note). |
| **Donations** | Pick a month (or use ‹ › to switch months), tick funders, enter each amount, and **Save**. Every month is kept permanently and can be viewed again by selecting that month. |

All data syncs in real time (updates appear instantly on every open device).

---

## 1. Create the Firebase project (one-time setup)

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com) and
   **Create a project** (e.g. `sadik-travels`).
2. In the project, add a **Web app**:
   - Project settings → **Your apps** → the web icon **`</>`** → register it.
   - Note the **Firebase config** values (shown under "SDK setup and configuration").
3. **Build → Realtime Database → Create Database** (choose a location; "Start in
   test mode" is fine for a private admin app, or use the rules below).
4. **Build → Firestore Database → Create Database** (same — test mode is fine, or use
   the rules below).
5. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**.
6. **Authentication → Users → Add user** — enter your admin email and password.
   This is the account you sign in with.

### Recommended security rules

**Realtime Database** (Rules tab) — only signed-in admins can read/write:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

**Firestore** (Rules tab) — only signed-in admins can read/write `funders`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /funders/{funderId} {
      allow read, write: if request.auth != null;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> Both rule files are included in this repo: `database.rules.json` and
> `firestore.rules`.

---

## 2. Run locally

```bash
cd sadik-travels
npm install
cp .env.example .env
```

Edit `.env` and paste your Firebase config:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=sadik-travels.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://sadik-travels-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=sadik-travels
VITE_FIREBASE_STORAGE_BUCKET=sadik-travels.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abc123
```

Then start it:

```bash
npm run dev
```

Open the printed URL (http://localhost:5173) and sign in with your admin email/password.

---

## 3. Deploy on Render (free static site)

The repo includes a **`render.yaml`** Blueprint so Render deploys it automatically.

1. Push this repository to **GitHub**.
2. Go to [https://render.com](https://render.com) → **New → Blueprint** → connect the repo.
   - (Alternatively: **New → Static Site**, set:
     - Build command: `npm install && npm run build`
     - Publish directory: `sadik-travels/dist`
     - Root directory: `sadik-travels`)
3. In **Environment → Environment Variables**, add the same 7 `VITE_FIREBASE_*`
   variables from your `.env`.
4. Deploy. Render builds the site and gives you a public `https://...onrender.com`
   URL — sign in and use it from anywhere.

> **Important:** the `VITE_*` variables are read **at build time**. After changing
> them in Render, trigger a new deploy so the site rebuilds with the new values.

---

## How data is stored

- **Funders → Firestore**
  - Collection `funders`, each document: `{ name, phone, note, createdAt }`.
- **Donations → Realtime Database**
  ```
  donations/
    ├─ 2026-08/
    │    ├─ <funderId>/ { name, phone, amount, savedAt }
    │    └─ ...
    └─ 2026-09/ ...
  ```
  The month key is `YYYY-MM`. Selecting a month shows/edits exactly that month, and
  past months stay saved forever.

---

## Notes

- The interface is **entirely in English**.
- Donations are in **Bangladeshi Taka (৳)** by default; you can rename the currency
  anywhere `৳` appears in the code if needed.
- Deleting a funder does **not** delete past donation records.
