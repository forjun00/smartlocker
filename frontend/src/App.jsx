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
  const [authed, setAuthed] = useState(sessionStorage.getItem('adminAuthed') === '1')
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
              ? <AdminPage onLogout={() => { sessionStorage.removeItem('adminAuthed'); setAuthed(false) }} />
              : <LoginPage onLogin={() => setAuthed(true)} />
          } />
          <Route path="/locker/:id" element={<LockerPage />} />
          <Route path="/pickup/:token" element={<PickupPage />} />
        </Routes>
      </div>
    </div>
  )
}
