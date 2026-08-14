import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import useStore from '../store/useStore'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setUser = useStore((state) => state.setUser)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data } = await api.post('/auth/login/', { email, password })
      setUser(data)
      navigate('/dashboard')
    } catch (err) {
      const message = err.response?.data?.error || 'Unable to sign in. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080c14', fontFamily: "'Inter', sans-serif", position: 'relative', overflow: 'hidden' }}>
      {/* Background Orbs */}
      <div className="orb orb-purple" style={{ width: 500, height: 500, top: -100, left: -150, zIndex: 0 }} />
      <div className="orb orb-blue" style={{ width: 400, height: 400, bottom: -100, right: -100, zIndex: 0 }} />

      {/* Card */}
      <div style={{ position: 'relative', zIndex: 1, width: 420, padding: '48px 40px', background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(20px)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20, boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>🧠</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', letterSpacing: -0.5, fontFamily: "'Space Grotesk', sans-serif" }}>Welcome back</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>Sign in to Neural Canvas</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, letterSpacing: 0.3 }}>EMAIL ADDRESS</label>
            <input
              className="nc-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, letterSpacing: 0.3 }}>PASSWORD</label>
            <input
              className="nc-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#fca5a5', marginTop: 12 }}>
              ⚠ {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: 24, padding: '13px 0', fontSize: 15, borderRadius: 12, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#475569', marginTop: 24 }}>
          Don&apos;t have an account?{' '}
          <a href="/register" style={{ color: '#a5b4fc', fontWeight: 600 }}>Create account</a>
        </p>
      </div>
    </div>
  )
}