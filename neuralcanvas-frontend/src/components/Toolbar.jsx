export default function Toolbar({
  pipelineName,
  status,
  onSave,
  onRun,
  onPause,
  onResume,
  onStop,
  onClear,
  showLeftPanel,
  setShowLeftPanel,
  showRightPanel,
  setShowRightPanel,
  showBottomPanel,
  setShowBottomPanel,
  onZoomIn,
  onZoomOut,
  onFitView,
}) {
  const statusConfig = {
    success: { cls: "badge-success", label: "● Ready / Done" },
    running: { cls: "badge-running", label: "⏳ Running…" },
    paused: { cls: "badge-running", label: "⏸ Paused" },
    failed: { cls: "badge-failed", label: "✗ Failed" },
    saved: { cls: "badge-success", label: "● Saved" },
  };
  const sc = statusConfig[status] || { cls: "badge-idle", label: "○ Idle" };
  const isRunning = status === "running";
  const isPaused = status === "paused";

  return (
    <div
      style={{
        height: 52,
        background: "rgba(10, 15, 26, 0.96)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 10,
        backdropFilter: "blur(16px)",
        zIndex: 10,
        userSelect: "none",
      }}
    >
      {/* Pipeline Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 4 }}>
        <span style={{ fontSize: 14 }}>⚡</span>
        <h1
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: "#f1f5f9",
            maxWidth: 180,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: -0.2,
          }}
        >
          {pipelineName || "Untitled Pipeline"}
        </h1>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: "rgba(255, 255, 255, 0.1)" }} />

      {/* Save Button */}
      <button
        onClick={onSave}
        disabled={isRunning}
        style={btnSecondaryStyle(isRunning)}
        title="Save DAG to database"
      >
        💾 Save DAG
      </button>

      {/* Run / Pause / Resume / Stop Controls */}
      {!isRunning && !isPaused && (
        <button onClick={onRun} style={btnPrimaryStyle} title="Execute complete DAG workflow">
          ▶ Run Full Pipeline
        </button>
      )}

      {isRunning && (
        <>
          <button
            onClick={onPause}
            style={{
              ...btnWarningStyle,
              animation: "pulse-pink 1.5s infinite",
            }}
            title="Pause pipeline execution"
          >
            ⏸ Pause
          </button>
          <button onClick={onStop} style={btnDangerStyle} title="Stop execution">
            ⏹ Stop
          </button>
        </>
      )}

      {isPaused && (
        <>
          <button onClick={onResume || onRun} style={btnResumeStyle} title="Resume pipeline execution">
            ▶ Resume Pipeline
          </button>
          <button onClick={onStop} style={btnDangerStyle} title="Reset pipeline status">
            ⏹ Reset
          </button>
        </>
      )}

      {/* Clear Button */}
      <button
        onClick={onClear}
        disabled={isRunning}
        style={btnGhostDangerStyle(isRunning)}
        title="Clear canvas"
      >
        🗑 Clear
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: "rgba(255, 255, 255, 0.1)", margin: "0 4px" }} />

      {/* Canvas Zoom Controls */}
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={onZoomIn} style={iconBtnStyle} title="Zoom In (+)">
          🔍+
        </button>
        <button onClick={onZoomOut} style={iconBtnStyle} title="Zoom Out (-)">
          🔍-
        </button>
        <button onClick={onFitView} style={iconBtnStyle} title="Fit Canvas to View">
          ⛶ Fit
        </button>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: "rgba(255, 255, 255, 0.1)", margin: "0 4px" }} />

      {/* VS Code Style Panel Toggles */}
      <div style={{ display: "flex", gap: 4 }}>
        <button
          onClick={() => setShowLeftPanel && setShowLeftPanel(!showLeftPanel)}
          style={panelToggleStyle(showLeftPanel)}
          title="Toggle Left Node Library (Sidebar)"
        >
          ◧ Left
        </button>
        <button
          onClick={() => setShowBottomPanel && setShowBottomPanel(!showBottomPanel)}
          style={panelToggleStyle(showBottomPanel)}
          title="Toggle Bottom Dataset Viewer (Panel)"
        >
          ⬒ Bottom
        </button>
        <button
          onClick={() => setShowRightPanel && setShowRightPanel(!showRightPanel)}
          style={panelToggleStyle(showRightPanel)}
          title="Toggle Right Inspector & Logs (Sidebar)"
        >
          ◨ Right
        </button>
      </div>

      {/* Status Badge */}
      <span className={`badge ${sc.cls}`} style={{ marginLeft: "auto" }}>
        {sc.label}
      </span>
    </div>
  );
}

const btnPrimaryStyle = {
  background: "linear-gradient(135deg, #ff0071 0%, #d90368 100%)",
  border: "none",
  color: "#fff",
  padding: "6px 16px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 2px 14px rgba(255, 0, 113, 0.45)",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const btnResumeStyle = {
  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  border: "none",
  color: "#fff",
  padding: "6px 16px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 2px 14px rgba(16, 185, 129, 0.45)",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const btnWarningStyle = {
  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  border: "none",
  color: "#fff",
  padding: "6px 14px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const btnDangerStyle = {
  background: "rgba(239, 68, 68, 0.2)",
  border: "1px solid rgba(239, 68, 68, 0.4)",
  color: "#fca5a5",
  padding: "6px 12px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const btnSecondaryStyle = (disabled) => ({
  background: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  color: "#e2e8f0",
  padding: "6px 12px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
});

const btnGhostDangerStyle = (disabled) => ({
  background: "rgba(239, 68, 68, 0.06)",
  border: "1px solid rgba(239, 68, 68, 0.2)",
  color: "#fca5a5",
  padding: "6px 12px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
});

const iconBtnStyle = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  color: "#94a3b8",
  padding: "5px 9px",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};

const panelToggleStyle = (active) => ({
  background: active ? "rgba(255, 0, 113, 0.18)" : "rgba(255, 255, 255, 0.03)",
  border: active ? "1px solid rgba(255, 0, 113, 0.45)" : "1px solid rgba(255, 255, 255, 0.08)",
  color: active ? "#ff85be" : "#64748b",
  padding: "5px 8px",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
});