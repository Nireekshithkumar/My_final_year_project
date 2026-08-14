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
      padding: '12px 28px',
      background: 'rgba(8,12,20,0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(99,102,241,0.12)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🧠</div>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.3 }}>
          Neural <span style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Canvas</span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user && (
          <span style={{ fontSize: 12, color: '#64748b', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', padding: '4px 12px', borderRadius: 16 }}>
            {user.email || user.username}
          </span>
        )}
        {user && (
          <button
            onClick={handleLogout}
            className="btn-danger"
            style={{ padding: '6px 14px', fontSize: 13 }}
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  )
}