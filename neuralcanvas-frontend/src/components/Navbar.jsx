import useStore from '../store/useStore'
import { useNavigate } from 'react-router-dom'

export default function Navbar() {
  const user = useStore((s) => s.user)
  const logout = useStore((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <nav style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 24px',
      background: 'rgba(10, 15, 26, 0.95)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div
        onClick={() => navigate('/dashboard')}
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
      >
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          background: 'linear-gradient(135deg, #ff0071, #8b5cf6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          boxShadow: '0 0 16px rgba(255, 0, 113, 0.4)',
        }}>
          🧠
        </div>
        <span style={{
          fontSize: 15.5,
          fontWeight: 800,
          color: '#f8fafc',
          fontFamily: "'Space Grotesk', sans-serif",
          letterSpacing: -0.3,
        }}>
          Neural <span style={{
            background: 'linear-gradient(135deg, #ff0071 0%, #ff85be 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Canvas</span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {user && (
          <span style={{
            fontSize: 12,
            color: '#cbd5e1',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '4px 12px',
            borderRadius: 16,
            fontFamily: "'Inter', sans-serif",
          }}>
            👤 {user.email || user.username}
          </span>
        )}
        {user && (
          <button
            onClick={handleLogout}
            className="btn-danger"
            style={{ padding: '6px 14px', fontSize: 12.5 }}
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  )
}