import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import useStore from '../store/useStore'

const STATUS_BADGE = {
  success: 'badge-success',
  running: 'badge-running',
  failed: 'badge-failed',
}

function PipelineCard({ pipeline, onDelete, onOpen }) {
  const status = pipeline.graph?.status || 'idle'
  const badgeClass = STATUS_BADGE[status] || 'badge-idle'

  return (
    <div
      className="glass-card"
      style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, cursor: 'default' }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.3))',
            border: '1px solid rgba(99,102,241,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>🔬</div>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 3 }}>{pipeline.name}</h2>
            <p style={{ fontSize: 11, color: '#475569' }}>
              {new Date(pipeline.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <span className={`badge ${badgeClass}`}>● {status}</span>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16 }}>
        {[
          { label: 'Status', value: status },
          { label: 'ID', value: `#${pipeline.id}` },
          { label: 'Elapsed', value: pipeline.graph?.elapsed_seconds ? `${pipeline.graph.elapsed_seconds}s` : '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: 1, background: 'rgba(8,12,20,0.5)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(99,102,241,0.08)' }}>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: 0.5, marginBottom: 3 }}>{label.toUpperCase()}</div>
            <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button
          className="btn-primary"
          onClick={onOpen}
          style={{ flex: 1, padding: '9px 0', fontSize: 13, borderRadius: 10 }}
        >
          ▶ Open Canvas
        </button>
        <button
          className="btn-danger"
          onClick={onDelete}
          style={{ padding: '9px 16px', fontSize: 13, borderRadius: 10 }}
        >
          🗑
        </button>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [pipelines, setPipelines] = useState([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const user = useStore((s) => s.user)
  const logout = useStore((s) => s.logout)

  useEffect(() => {
    const loadPipelines = async () => {
      try {
        const { data } = await api.get('/pipelines/')
        setPipelines(data)
      } catch (err) {
        if (err.response?.status === 401) { navigate('/login'); return }
        setError('Unable to load pipelines right now.')
      }
    }
    loadPipelines()
  }, [navigate])

  const create = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const { data } = await api.post('/pipelines/', { name })
      navigate(`/pipeline/${data.id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create the pipeline.')
      setCreating(false)
    }
  }

  const deletePipeline = async (id) => {
    if (!confirm('Delete this pipeline?')) return
    try {
      await api.delete(`/pipelines/${id}/`)
      setPipelines((c) => c.filter((p) => p.id !== id))
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to delete.')
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080c14', fontFamily: "'Inter', sans-serif", position: 'relative' }}>
      {/* Background */}
      <div className="orb orb-purple" style={{ width: 600, height: 600, top: -200, right: -100, zIndex: 0 }} />
      <div className="orb orb-blue" style={{ width: 400, height: 400, bottom: 0, left: -100, zIndex: 0 }} />

      {/* Topbar */}
      <nav style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid rgba(99,102,241,0.1)', background: 'rgba(8,12,20,0.8)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🧠</div>
          <span style={{ fontSize: 17, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>
            Neural <span className="gradient-text">Canvas</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user && (
            <span style={{ fontSize: 13, color: '#475569', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', padding: '5px 12px', borderRadius: 20 }}>
              👤 {user.email || user.username}
            </span>
          )}
          <button className="btn-danger" onClick={handleLogout} style={{ padding: '7px 16px', fontSize: 13 }}>Logout</button>
        </div>
      </nav>

      {/* Main content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 34, fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -1, marginBottom: 6 }}>
            My <span className="gradient-text">Pipelines</span>
          </h1>
          <p style={{ color: '#475569', fontSize: 14 }}>
            {pipelines.length} pipeline{pipelines.length !== 1 ? 's' : ''} · Start building your next ML workflow
          </p>
        </div>

        {/* Create row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          <input
            className="nc-input"
            placeholder="Pipeline name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            style={{ maxWidth: 320 }}
          />
          <button
            className="btn-primary"
            onClick={create}
            disabled={creating || !name.trim()}
            style={{ padding: '12px 24px', whiteSpace: 'nowrap', opacity: (creating || !name.trim()) ? 0.6 : 1, cursor: (creating || !name.trim()) ? 'not-allowed' : 'pointer' }}
          >
            {creating ? '⏳ Creating…' : '+ New Pipeline'}
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: '#fca5a5', marginBottom: 20 }}>
            ⚠ {error}
          </div>
        )}

        {/* Grid */}
        {pipelines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#334155' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🧬</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#475569' }}>No pipelines yet</h3>
            <p style={{ fontSize: 14 }}>Create your first pipeline above to get started.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {pipelines.map((pipeline) => (
              <PipelineCard
                key={pipeline.id}
                pipeline={pipeline}
                onOpen={() => navigate(`/pipeline/${pipeline.id}`)}
                onDelete={() => deletePipeline(pipeline.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}