import { useAuth } from '../context/AuthContext'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'funders', label: 'Funders', icon: '👥' },
  { id: 'donations', label: 'Donations', icon: '💝' },
  { id: 'admins', label: 'Admins', icon: '🛡️' },
]

export default function Layout({ page, setPage, children }) {
  const { user, logout } = useAuth()

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">ST</div>
          <div>
            <div className="brand-name">Sadiq Travels</div>
            <div className="brand-sub">Donor Management</div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`nav-item ${page === n.id ? 'active' : ''}`}
              onClick={() => setPage(n.id)}
            >
              <span className="nav-icon" aria-hidden="true">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="admin-chip">
            <div className="avatar">{user?.email?.[0]?.toUpperCase()}</div>
            <div className="admin-info">
              <div className="admin-email" title={user?.email}>{user?.email}</div>
              <div className="admin-role">{user?.displayName || 'Administrator'}</div>
            </div>
          </div>
          <button type="button" className="btn ghost block" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1>{NAV.find((n) => n.id === page)?.label}</h1>
          <span className="topbar-brand">Sadiq Travels</span>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  )
}
