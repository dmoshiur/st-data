import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const REQUIRED = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_AUTH_DOMAIN',
]

/**
 * Vite only inlines env vars that start with VITE_ and that exist when the
 * build runs. Fail loudly here rather than shipping a bundle that silently
 * boots into demo mode on Vercel.
 */
function firebaseEnvWarning(env, mode) {
  const missing = REQUIRED.filter((k) => !env[k])
  if (missing.length === 0) return
  // eslint-disable-next-line no-console
  console.warn(
    [
      '',
      `\x1b[33m[st-data] Firebase env is incomplete for mode "${mode}".\x1b[0m`,
      `  Missing: ${missing.join(', ')}`,
      '  The app will boot in demo mode (localStorage only).',
      '  · Local:  add them to sadik-travels/.env, then restart `npm run dev`.',
      '  · Vercel: Project → Settings → Environment Variables, then REDEPLOY.',
      '  Keys must start with VITE_ or Vite strips them from the client bundle.',
      '',
    ].join('\n'),
  )
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  firebaseEnvWarning(env, mode)

  return {
    plugins: [react()],
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
    build: {
      target: 'es2020',
      cssCodeSplit: false,
      chunkSizeWarningLimit: 900,
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          // Split the Firebase SDK out of the entry chunk so the login screen
          // paints while the (much larger) data layer is still downloading.
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            // The Realtime Database SDK is imported lazily at runtime; forcing
            // it into the main firebase chunk would undo that split, so let
            // Rollup keep it separate.
            if (id.includes('firebase/database') || id.includes('@firebase/database')) return
            if (id.includes('firebase') || id.includes('@firebase')) return 'firebase'
            if (id.includes('react-dom')) return 'react-dom'
            if (id.includes('react')) return 'react'
            return 'vendor'
          },
        },
      },
    },
  }
})
