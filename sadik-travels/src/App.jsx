import { Suspense, lazy, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { I18nProvider } from './i18n/index.jsx'
import { FeedbackProvider } from './components/Feedback.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import ConfigBanner from './components/ConfigBanner.jsx'
import Loading from './components/Loading.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'

// Page code is split out of the entry chunk: the login screen paints before
// the dashboard/donations code is even downloaded.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Funders = lazy(() => import('./pages/Funders.jsx'))
const Donations = lazy(() => import('./pages/Donations.jsx'))
const Admins = lazy(() => import('./pages/Admins.jsx'))

const PAGES = { dashboard: Dashboard, funders: Funders, donations: Donations, admins: Admins }

function Shell() {
  const { user, configured, diagnostics } = useAuth()
  const [page, setPage] = useState('dashboard')

  if (user === undefined) return <Loading full />
  if (!user) return <Login />

  const Current = PAGES[page] || Dashboard

  return (
    <Layout page={page} setPage={setPage}>
      {!configured && <ConfigBanner diagnostics={diagnostics} />}
      <ErrorBoundary key={page}>
        <Suspense fallback={<Loading />}>
          <Current />
        </Suspense>
      </ErrorBoundary>
    </Layout>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <FeedbackProvider>
          <AuthProvider>
            <Shell />
          </AuthProvider>
        </FeedbackProvider>
      </ThemeProvider>
    </I18nProvider>
  )
}
