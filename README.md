# Sadiq Travels — Donor & Monthly Donation Manager

Admin web app for **Sadiq Travels** to manage funders (donors) and record
monthly donations.

- **Firebase Authentication** (Email/Password) — admin sign-in
- **Firestore** — funders, the admin roster, and monthly donation records
- **Realtime Database** (optional) — donations, if you prefer them there
- **React 18 + Vite** — static frontend, no server to run
- **English + বাংলা** interface, light/dark themes, print-ready donation sheet

> The app lives in [`sadik-travels/`](./sadik-travels).
> Full setup, deployment and troubleshooting guide:
> **[sadik-travels/README.md](./sadik-travels/README.md)**

## Quick start

```bash
cd sadik-travels
npm install
cp .env.example .env      # then paste your Firebase web-app config
npm run dev
```

## Deploy to Vercel

1. Import this repository as a Vercel project.
2. Set **Root Directory** to `sadik-travels` (a root-level `vercel.json` is
   also provided if you leave the root as-is).
3. Add every `VITE_FIREBASE_*` variable under
   **Project → Settings → Environment Variables** (Production *and* Preview).
4. **Redeploy.** Vite inlines env vars at build time — setting them without a
   new build is the single most common reason a Firebase app works locally but
   not in production.

## Checks

```bash
cd sadik-travels
npm test     # 38 unit + render tests (node:test, jsdom)
npm run check # tests + production build
```
