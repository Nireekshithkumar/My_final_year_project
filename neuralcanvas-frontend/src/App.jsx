import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Canvas from './pages/Canvas.jsx'
import AICopilot from './pages/AICopilot.jsx'
import ExperimentTracking from './pages/ExperimentTracking.jsx'
import Navbar from './components/Navbar'
import ErrorBoundary from './components/ErrorBoundary'
import useStore from './store/useStore'

function ProtectedRoute({ children }) {
  const { user, authLoading } = useStore()
  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#090d16',
        color: '#ff85be',
        gap: 12,
        fontFamily: "'Space Grotesk', sans-serif",
      }}>
        <div style={{ fontSize: 32, animation: 'pulse-pink 1.5s infinite' }}>⚡</div>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>Loading NeuralCanvas…</div>
      </div>
    )
  }
  if (!user) return <Navigate to='/login' replace />
  return children
}

function PublicRoute({ children }) {
  const { user, authLoading } = useStore()
  if (authLoading) return null
  if (user) return <Navigate to='/dashboard' replace />
  return children
}

export default function App() {
  const { theme, user, hydrateUser } = useStore()

  useEffect(() => {
    hydrateUser()
  }, [hydrateUser])

  return (
    <div className={theme}>
      <BrowserRouter>
        {user && <Navbar />}
        <Routes>
          <Route path='/' element={<Landing />} />
          <Route path='/login' element={<PublicRoute><Login /></PublicRoute>} />
          <Route path='/register' element={<PublicRoute><Register /></PublicRoute>} />
          <Route path='/dashboard' element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path='/experiments' element={<ProtectedRoute><ExperimentTracking /></ProtectedRoute>} />
          <Route path='/ai-copilot' element={<ProtectedRoute><AICopilot /></ProtectedRoute>} />
          <Route path='/pipeline/:id' element={<ProtectedRoute><Canvas /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}