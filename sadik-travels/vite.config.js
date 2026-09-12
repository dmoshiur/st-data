import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Load .env files for Vite AND make them available to our server-side code
// (process.env) so the API middleware can reach TURSO_DB_URL etc during
// `npm run dev`. We deliberately mirror them onto process.env so the same
// code works in Netlify Functions (where they are also on process.env).
function serverApiPlugin() {
  return {
    name: 'st-data-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()
        try {
          const { handleApi } = await import('./server/api.js')
          await handleApi(req, res)
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[dev api]', e)
          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: e.message || 'Server error' }))
          }
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Load all env vars (including non-VITE_ prefixed ones) into process.env
  // so the server-side code can read TURSO_*, ADMIN_*, JWT_SECRET etc.
  // Vite normally only exposes VITE_* variables to the client; the server
  // code reads process.env directly.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v
  }

  return {
    plugins: [react(), serverApiPlugin()],
    server: {
      host: true,
      port: 5173,
      allowedHosts: true,
    },
    preview: {
      host: true,
      port: 4173,
      allowedHosts: true,
    },
  }
})
