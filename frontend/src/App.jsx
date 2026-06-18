import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Background from './components/Background'
import Nav from './components/Nav'
import AdminPage from './pages/AdminPage'
import LockerPage from './pages/LockerPage'
import PickupPage from './pages/PickupPage'
import LoginPage from './pages/LoginPage'

export default function App() {
  const { pathname } = useLocation()
  const [token, setToken] = useState(sessionStorage.getItem('adminToken') || '')
  const authed = !!token
  const showNav = !pathname.startsWith('/pickup/')
  const isAdmin = pathname === '/'

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflowX: 'hidden' }}>
      <Background />
      {showNav && !( isAdmin && !authed) && <Nav />}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Routes>
          <Route path="/" element={
            authed
              ? <AdminPage token={token} onLogout={() => { sessionStorage.removeItem('adminToken'); setToken('') }} />
              : <LoginPage onLogin={(t) => { sessionStorage.setItem('adminToken', t); setToken(t) }} />
          } />
          <Route path="/locker/:id" element={<LockerPage />} />
          <Route path="/pickup/:token" element={<PickupPage />} />
        </Routes>
      </div>
    </div>
  )
}
