export default function DemoBanner() {
  return (
    <div className="demo-banner">
      <div className="demo-banner-inner">
        <span className="demo-dot" aria-hidden="true" />
        <strong>Demo Mode</strong>
        <span className="demo-text">
          Firebase is not connected yet, so data is saved only in this browser.
        </span>
        <details className="demo-details">
          <summary>How to connect Firebase</summary>
          <ol>
            <li>Copy <code>.env.example</code> to <code>.env</code> in the project folder.</li>
            <li>Firebase Console → Project settings → <strong>Your apps</strong> → Web app → <strong>SDK setup (Config)</strong>.</li>
            <li>Paste the 7 config values into <code>.env</code> (the <code>databaseURL</code> comes from the Realtime Database).</li>
            <li>Enable <strong>Email/Password</strong> sign-in and add your admin user in Authentication → Users.</li>
            <li>Restart the dev server, or set the same values in Render and redeploy. See <code>README.md</code>.</li>
          </ol>
        </details>
      </div>
    </div>
  )
}
