export default function Toolbar({ onSave, onRun, onStop, onClear, status, pipelineName }) {
  const statusConfig = {
    success: { cls: 'badge-success', label: '● Ready / Done' },
    running: { cls: 'badge-running', label: '⏳ Running…' },
    failed: { cls: 'badge-failed', label: '✗ Failed' },
    saved: { cls: 'badge-success', label: '● Saved' },
  }
  const sc = statusConfig[status] || { cls: 'badge-idle', label: '○ Idle' }
  const isRunning = status === 'running'

  return (
    <div style={{
      height: 54,
      background: 'rgba(10, 15, 26, 0.95)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 18px',
      gap: 12,
      backdropFilter: 'blur(16px)',
      zIndex: 10,
    }}>
      {/* Pipeline name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 6 }}>
        <span style={{ fontSize: 14 }}>⚡</span>
        <h1 style={{
          fontSize: 13.5,
          fontWeight: 700,
          color: '#f1f5f9',
          maxWidth: 220,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: "'Space Grotesk', sans-serif",
          letterSpacing: -0.2,
        }}>
          {pipelineName || 'Untitled Pipeline'}
        </h1>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 22, background: 'rgba(255, 255, 255, 0.1)' }} />

      {/* Action Buttons */}
      <button
        onClick={onSave}
        disabled={isRunning}
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          color: '#e2e8f0',
          padding: '6px 14px',
          borderRadius: 8,
          fontSize: 12.5,
          fontWeight: 600,
          cursor: isRunning ? 'not-allowed' : 'pointer',
          opacity: isRunning ? 0.5 : 1,
          transition: 'all 0.18s ease',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        💾 Save DAG
      </button>

      {!isRunning ? (
        <button
          onClick={onRun}
          style={{
            background: 'linear-gradient(135deg, #ff0071 0%, #d90368 100%)',
            border: 'none',
            color: '#fff',
            padding: '6px 18px',
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: '0 2px 14px rgba(255, 0, 113, 0.45)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 0, 113, 0.65)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 14px rgba(255, 0, 113, 0.45)';
          }}
        >
          ▶ Run Full Pipeline
        </button>
      ) : (
        <button
          onClick={onStop}
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
            border: 'none',
            color: '#fff',
            padding: '6px 18px',
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.18s ease',
            boxShadow: '0 2px 14px rgba(239, 68, 68, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            animation: 'pulse-pink 1.5s infinite',
          }}
        >
          ⏹ Stop Running
        </button>
      )}

      <button
        onClick={onClear}
        disabled={isRunning}
        style={{
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#fca5a5',
          padding: '6px 14px',
          borderRadius: 8,
          fontSize: 12.5,
          fontWeight: 600,
          cursor: isRunning ? 'not-allowed' : 'pointer',
          opacity: isRunning ? 0.5 : 1,
          transition: 'all 0.18s ease',
        }}
      >
        🗑 Clear
      </button>

      <span className={`badge ${sc.cls}`} style={{ marginLeft: 'auto' }}>
        {sc.label}
      </span>
    </div>
  )
}