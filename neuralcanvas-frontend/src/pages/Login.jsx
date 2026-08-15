import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
      const message = err.response?.data?.error || 'Unable to sign in. Please check your credentials.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#090d16',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflow: 'hidden',
      padding: '24px 16px',
    }}>
      {/* Background Orbs */}
      <div className="orb orb-pink" style={{ width: 500, height: 500, top: -150, left: -150, zIndex: 0, opacity: 0.4 }} />
      <div className="orb orb-purple" style={{ width: 450, height: 450, bottom: -120, right: -120, zIndex: 0, opacity: 0.35 }} />

      {/* Card */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: 420,
        padding: '44px 36px',
        background: 'rgba(17, 24, 39, 0.92)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 20,
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(255, 0, 113, 0.1)',
      }}>
        {/* Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #ff0071, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            margin: '0 auto 16px',
            boxShadow: '0 0 20px rgba(255, 0, 113, 0.45)',
          }}>
            🧠
          </div>
          <h1 style={{
            fontSize: 23,
            fontWeight: 800,
            color: '#f8fafc',
            letterSpacing: -0.4,
            fontFamily: "'Space Grotesk', sans-serif",
            marginBottom: 4,
          }}>
            Welcome Back
          </h1>
          <p style={{ fontSize: 13, color: '#64748b' }}>Sign in to continue to Neural Canvas</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#94a3b8', marginBottom: 6, letterSpacing: 0.4 }}>
              EMAIL ADDRESS
            </label>
            <input
              className="nc-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#94a3b8', marginBottom: 6, letterSpacing: 0.4 }}>
              PASSWORD
            </label>
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
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
              padding: '9px 12px',
              fontSize: 12.5,
              color: '#fca5a5',
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{
              width: '100%',
              marginTop: 6,
              padding: '12px 0',
              fontSize: 14,
              borderRadius: 10,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              justifyContent: 'center',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12.5, color: '#64748b', marginTop: 22 }}>
          Don&apos;t have an account?{' '}
          <Link to="/register" style={{ color: '#ff85be', fontWeight: 600 }}>
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}