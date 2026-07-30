import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import useStore from '../store/useStore'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const setUser = useStore((state) => state.setUser)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    try {
      const { data } = await api.post('/auth/login/', { email, password })
      setUser(data)
      navigate('/dashboard')
    } catch (err) {
      const message = err.response?.data?.error || 'Unable to sign in. Please try again.'
      setError(message)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>Welcome back</h1>
        <p style={s.subtitle}>Sign in to Neural Canvas</p>

        <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          <label style={s.label}>Email</label>
          <input
            style={s.input}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />

          <label style={s.label}>Password</label>
          <input
            style={s.input}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
          />

          {error && <div style={s.error}>{error}</div>}

          <button type="submit" style={s.button}>Sign In</button>
        </form>

        <p style={s.footer}>
          Don&apos;t have an account? <a href="/register" style={s.link}>Register</a>
        </p>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f8fafc', fontFamily: 'Inter, sans-serif',
  },
  card: {
    background: '#fff', padding: '40px 36px', borderRadius: 12,
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)', width: 380, border: '1px solid #e2e8f0',
  },
  title: { fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  label: { fontSize: 12, color: '#475569', fontWeight: 600, display: 'block', marginTop: 14, marginBottom: 4 },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box',
  },
  button: {
    width: '100%', marginTop: 22, padding: '10px 0', background: '#312e81',
    color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600,
    fontSize: 14, cursor: 'pointer',
  },
  error: { color: '#dc2626', fontSize: 12, marginTop: 10 },
  footer: { textAlign: 'center', fontSize: 13, color: '#64748b', marginTop: 20 },
  link: { color: '#312e81', fontWeight: 600, textDecoration: 'none' },
}