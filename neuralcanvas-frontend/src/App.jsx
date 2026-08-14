import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Canvas from './pages/Canvas.jsx'
import Navbar from './components/Navbar'
import useStore from './store/useStore'

function ProtectedRoute({ children }) {
  const user = useStore((state) => state.user)
  if (!user) return <Navigate to='/login' replace />
  return children
}

function PublicRoute({ children }) {
  const user = useStore((state) => state.user)
  if (user) return <Navigate to='/dashboard' replace />
  return children
}

export default function App() {
  const { theme, user } = useStore()

  return (
    <div className={theme}>
      <BrowserRouter>
        {user && <Navbar />}
        <Routes>
          <Route path='/' element={<Landing />} />
          <Route path='/login' element={<PublicRoute><Login /></PublicRoute>} />
          <Route path='/register' element={<PublicRoute><Register /></PublicRoute>} />
          <Route path='/dashboard' element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path='/pipeline/:id' element={<ProtectedRoute><Canvas /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}