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
  const [activeNav, setActiveNav] = useState('dashboard')
  const [aiStatus, setAiStatus] = useState({ online: true, active_provider: 'Groq' })
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

    // Fetch AI Status
    api.get('/ai/status/')
      .then((res) => setAiStatus(res.data))
      .catch(() => {})
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

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', isRoute: false },
    { id: 'ai-copilot', label: 'AI Copilot', icon: '🤖', isRoute: true, route: '/ai-copilot', badge: aiStatus.online ? 'AI Online' : 'AI Mode' },
    { id: 'pipelines', label: 'My Pipelines', icon: '🔬', isRoute: false, count: pipelines.length },
    { id: 'datasets', label: 'Datasets', icon: '📂', isRoute: false },
    { id: 'models', label: 'Models', icon: '📦', isRoute: false },
    { id: 'experiments', label: 'Experiments', icon: '🧪', isRoute: false },
    { id: 'settings', label: 'Settings', icon: '⚙️', isRoute: false },
  ]

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)', background: '#090d16', fontFamily: "'Inter', sans-serif", position: 'relative' }}>
      {/* Background Orbs */}
      <div className="orb orb-pink" style={{ width: 600, height: 600, top: -200, right: -100, zIndex: 0, opacity: 0.25 }} />
      <div className="orb orb-purple" style={{ width: 400, height: 400, bottom: 0, left: -100, zIndex: 0, opacity: 0.2 }} />

      {/* Dashboard Sidebar */}
      <aside style={{
        width: 240,
        background: 'rgba(10, 15, 26, 0.95)',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '24px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        zIndex: 2,
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, padding: '0 10px', marginBottom: 6 }}>
          Navigation
        </div>

        {navItems.map((item) => {
          const isActive = activeNav === item.id
          const isCopilot = item.id === 'ai-copilot'

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.isRoute) {
                  navigate(item.route)
                } else {
                  setActiveNav(item.id)
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 10,
                border: isCopilot
                  ? '1px solid rgba(255, 0, 113, 0.35)'
                  : isActive
                  ? '1px solid rgba(139, 92, 246, 0.3)'
                  : '1px solid transparent',
                background: isCopilot
                  ? 'linear-gradient(135deg, rgba(255, 0, 113, 0.15), rgba(139, 92, 246, 0.15))'
                  : isActive
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'transparent',
                color: isCopilot ? '#ff85be' : isActive ? '#f8fafc' : '#94a3b8',
                fontWeight: isCopilot || isActive ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span style={{
                  fontSize: 9.5,
                  padding: '2px 6px',
                  borderRadius: 8,
                  fontWeight: 700,
                  background: 'rgba(34, 197, 94, 0.2)',
                  color: '#86efac',
                  border: '1px solid rgba(34, 197, 94, 0.4)',
                }}>
                  {item.badge}
                </span>
              )}

              {item.count !== undefined && (
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                  {item.count}
                </span>
              )}
            </button>
          )
        })}

        {/* AI Copilot Promo Banner in Sidebar */}
        <div style={{
          marginTop: 'auto',
          background: 'linear-gradient(135deg, rgba(255, 0, 113, 0.12), rgba(139, 92, 246, 0.12))',
          border: '1px solid rgba(255, 0, 113, 0.25)',
          borderRadius: 12,
          padding: '14px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🤖</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>AI Copilot</span>
          </div>
          <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, margin: 0 }}>
            Generate DAG pipelines, recommend models, and fix errors automatically.
          </p>
          <button
            onClick={() => navigate('/ai-copilot')}
            style={{
              background: 'linear-gradient(135deg, #ff0071, #8b5cf6)',
              color: '#fff',
              border: 'none',
              borderRadius: 7,
              padding: '6px 0',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(255, 0, 113, 0.3)',
            }}
          >
            Launch Copilot ➔
          </button>
        </div>
      </aside>

      {/* Main content Area */}
      <main style={{ position: 'relative', zIndex: 1, flex: 1, padding: '36px 32px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -1, marginBottom: 6 }}>
                My <span style={{ background: 'linear-gradient(135deg, #ff0071, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pipelines</span>
              </h1>
              <p style={{ color: '#64748b', fontSize: 13.5 }}>
                {pipelines.length} pipeline{pipelines.length !== 1 ? 's' : ''} · Drag, configure, train, and orchestrate ML workflows
              </p>
            </div>
          </div>

          {/* Quick AI Copilot Dashboard Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(255, 0, 113, 0.12) 0%, rgba(139, 92, 246, 0.15) 100%)',
            border: '1px solid rgba(255, 0, 113, 0.3)',
            borderRadius: 14,
            padding: '18px 22px',
            marginBottom: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            boxShadow: '0 4px 24px rgba(255, 0, 113, 0.12)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'linear-gradient(135deg, #ff0071, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                boxShadow: '0 0 16px rgba(255, 0, 113, 0.4)',
                flexShrink: 0,
              }}>
                🤖
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', marginBottom: 2 }}>
                  NeuralCanva AI Copilot
                </h3>
                <p style={{ fontSize: 12.5, color: '#cbd5e1', margin: 0 }}>
                  Analyze datasets, build pipelines, debug models, and optimize experiments with AI.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/ai-copilot')}
              style={{
                background: 'linear-gradient(135deg, #ff0071 0%, #d90368 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '9px 18px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(255, 0, 113, 0.35)',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ⚡ Open AI Copilot
            </button>
          </div>

          {/* Create Pipeline row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
            <input
              className="nc-input"
              placeholder="Pipeline name (e.g. Housing Price Prediction)…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              style={{ maxWidth: 380 }}
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
              <p style={{ fontSize: 13.5 }}>Create your first pipeline above or use AI Copilot to generate one.</p>
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
      </main>
    </div>
  )
}