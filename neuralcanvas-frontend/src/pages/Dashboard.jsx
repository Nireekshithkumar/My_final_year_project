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
      style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, cursor: 'default' }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(255, 0, 113, 0.25), rgba(139, 92, 246, 0.25))',
            border: '1px solid rgba(255, 0, 113, 0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            boxShadow: '0 0 16px rgba(255, 0, 113, 0.2)',
          }}>🔬</div>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 3 }}>{pipeline.name}</h2>
            <p style={{ fontSize: 11, color: '#64748b' }}>
              {new Date(pipeline.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <span className={`badge ${badgeClass}`}>● {status}</span>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Status', value: status },
          { label: 'ID', value: `#${pipeline.id}` },
          { label: 'Elapsed', value: pipeline.graph?.elapsed_seconds ? `${pipeline.graph.elapsed_seconds}s` : '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: 1, background: 'rgba(10, 15, 26, 0.8)', borderRadius: 8, padding: '7px 10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 700, letterSpacing: 0.5, marginBottom: 2 }}>{label.toUpperCase()}</div>
            <div style={{ fontSize: 12.5, color: '#cbd5e1', fontWeight: 600 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button
          className="btn-primary"
          onClick={onOpen}
          style={{ flex: 1, padding: '8px 0', fontSize: 13, borderRadius: 8, justifyContent: 'center' }}
        >
          ▶ Open Canvas
        </button>
        <button
          className="btn-danger"
          onClick={onDelete}
          style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8 }}
          title="Delete pipeline"
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

  return (
    <div style={{ minHeight: '100vh', background: '#090d16', fontFamily: "'Inter', sans-serif", position: 'relative' }}>
      {/* Background Orbs */}
      <div className="orb orb-pink" style={{ width: 600, height: 600, top: -200, right: -100, zIndex: 0, opacity: 0.35 }} />
      <div className="orb orb-purple" style={{ width: 400, height: 400, bottom: 0, left: -100, zIndex: 0, opacity: 0.25 }} />

      {/* Main content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -1, marginBottom: 6 }}>
            My <span style={{ background: 'linear-gradient(135deg, #ff0071, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pipelines</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: 13.5 }}>
            {pipelines.length} pipeline{pipelines.length !== 1 ? 's' : ''} · Drag, configure, and train machine learning workflows
          </p>
        </div>

        {/* Create row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          <input
            className="nc-input"
            placeholder="Pipeline name (e.g. Housing Price Prediction)…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            style={{ maxWidth: 360 }}
          />
          <button
            className="btn-primary"
            onClick={create}
            disabled={creating || !name.trim()}
            style={{ padding: '10px 22px', whiteSpace: 'nowrap', opacity: (creating || !name.trim()) ? 0.6 : 1, cursor: (creating || !name.trim()) ? 'not-allowed' : 'pointer' }}
          >
            {creating ? '⏳ Creating…' : '⚡ + New Pipeline'}
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#fca5a5', marginBottom: 20 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Grid */}
        {pipelines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#475569' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🧬</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#94a3b8' }}>No pipelines yet</h3>
            <p style={{ fontSize: 13.5 }}>Create your first pipeline above to begin designing your workflow.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 20 }}>
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