import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import ConfigBanner from './components/ConfigBanner'
import Loading from './components/Loading'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Funders from './pages/Funders'
import Donations from './pages/Donations'
import Admins from './pages/Admins'

const PAGES = {
  dashboard: Dashboard,
  funders: Funders,
  donations: Donations,
  admins: Admins,
}

function Shell() {
  const { user, configured } = useAuth()
  const [page, setPage] = useState('dashboard')

  if (user === undefined || configured === undefined) return <Loading full />

  if (!user) return <Login configured={configured} />

  const Current = PAGES[page] || Dashboard

  return (
    <>
      {!configured && <ConfigBanner />}
      <Layout page={page} setPage={setPage}>
        <Current />
      </Layout>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
