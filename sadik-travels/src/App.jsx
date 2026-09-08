import { useState } from 'react'
import { isConfigured } from './firebase'
import { AuthProvider, useAuth } from './context/AuthContext'
import DemoBanner from './components/DemoBanner'
import Loading from './components/Loading'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Funders from './pages/Funders'
import Donations from './pages/Donations'

const PAGES = {
  dashboard: Dashboard,
  funders: Funders,
  donations: Donations,
}

function Shell() {
  const { user } = useAuth()
  const [page, setPage] = useState('dashboard')

  if (user === undefined) return <Loading full />

  if (!user) return <Login />

  const Current = PAGES[page] || Dashboard

  return (
    <Layout page={page} setPage={setPage}>
      <Current />
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      {!isConfigured && <DemoBanner />}
      <Shell />
    </AuthProvider>
  )
}
