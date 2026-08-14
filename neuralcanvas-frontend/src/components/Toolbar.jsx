export default function Toolbar({ onSave, onRun, onClear, status, pipelineName }) {
  const statusConfig = {
    success: { cls: 'badge-success', label: '● Success' },
    running: { cls: 'badge-running', label: '⏳ Running…' },
    failed: { cls: 'badge-failed', label: '✗ Failed' },
    saved: { cls: 'badge-success', label: '● Saved' },
  }
  const sc = statusConfig[status] || { cls: 'badge-idle', label: '○ Idle' }

  return (
    <div style={{
      height: 52,
      background: 'rgba(8,12,20,0.95)',
      borderBottom: '1px solid rgba(99,102,241,0.12)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 10,
      backdropFilter: 'blur(10px)',
      zIndex: 10,
    }}>
      {/* Pipeline name */}
      <h1 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginRight: 8, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Space Grotesk', sans-serif" }}>
        {pipelineName}
      </h1>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'rgba(99,102,241,0.2)' }} />

      <button
        onClick={onSave}
        style={{
          background: 'rgba(99,102,241,0.1)',
          border: '1px solid rgba(99,102,241,0.2)',
          color: '#a5b4fc',
          padding: '5px 14px',
          borderRadius: 8,
          fontSize: 12.5,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
        onMouseEnter={(e) => { e.target.style.background = 'rgba(99,102,241,0.2)'; e.target.style.borderColor = 'rgba(99,102,241,0.4)' }}
        onMouseLeave={(e) => { e.target.style.background = 'rgba(99,102,241,0.1)'; e.target.style.borderColor = 'rgba(99,102,241,0.2)' }}
      >
        💾 Save
      </button>

      <button
        onClick={onRun}
        style={{
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none',
          color: '#fff',
          padding: '5px 16px',
          borderRadius: 8,
          fontSize: 12.5,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: '0 2px 12px rgba(99,102,241,0.4)',
        }}
      >
        ▶ Run
      </button>

      <button
        onClick={onClear}
        style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: '#fca5a5',
          padding: '5px 14px',
          borderRadius: 8,
          fontSize: 12.5,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        🗑 Clear
      </button>

      <span className={`badge ${sc.cls}`} style={{ marginLeft: 4 }}>{sc.label}</span>
    </div>
  )
}