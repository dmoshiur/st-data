// Shown when TURSO_DB_URL (etc.) are missing. In that case the app falls
// back to the browser-only demo store so the UI is still previewable.
export default function ConfigBanner() {
  return (
    <div className="demo-banner">
      <div className="demo-banner-inner">
        <span className="demo-dot" aria-hidden="true" />
        <strong>Demo Mode</strong>
        <span className="demo-text">
          The Turso database is not connected yet, so data is saved only in this browser.
        </span>
        <details className="demo-details">
          <summary>How to connect Turso</summary>
          <ol>
            <li>
              Create a database on <a href="https://turso.tech" target="_blank" rel="noreferrer">turso.tech</a>.
              Copy the <code>libsql://…</code> URL and create an auth token.
            </li>
            <li>
              Generate a long random string for <code>JWT_SECRET</code> (e.g. <code>openssl rand -hex 32</code>).
            </li>
            <li>
              Pick your first admin email &amp; password and set <code>ADMIN_EMAIL</code> and{' '}
              <code>ADMIN_PASSWORD</code>. That account will be created automatically the first time
              the site loads.
            </li>
            <li>
              In the Netlify dashboard (Site settings → Environment variables) add:
              <ul>
                <li><code>TURSO_DB_URL</code></li>
                <li><code>TURSO_DB_AUTH_TOKEN</code></li>
                <li><code>JWT_SECRET</code></li>
                <li><code>ADMIN_EMAIL</code></li>
                <li><code>ADMIN_PASSWORD</code></li>
              </ul>
              Deploy the site. The variables are read at <strong>runtime</strong>, so you only need to redeploy when code changes.
            </li>
            <li>
              Sign in with the email/password you set above. You can add, edit or remove other admins from the “Admins” page.
            </li>
          </ol>
        </details>
      </div>
    </div>
  )
}
