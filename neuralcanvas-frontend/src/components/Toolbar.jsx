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
  onOpenProfile,
  onOpenAutoML,
  onOpenCompare,
  onOpenRegistry,
  onOpenWhatIf,
  onOpenCopilot,
  onOpenReport,
  onExportProject,
  onImportProject,
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
        padding: "0 14px",
        gap: 8,
        backdropFilter: "blur(16px)",
        zIndex: 10,
        userSelect: "none",
        overflowX: "auto",
      }}
    >
      {/* Pipeline Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 2, flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>⚡</span>
        <h1
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#f1f5f9",
            maxWidth: 150,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: -0.2,
            margin: 0,
          }}
        >
          {pipelineName || "Untitled Pipeline"}
        </h1>
      </div>

      {/* Primary Execution Controls */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        <button
          onClick={onSave}
          disabled={isRunning}
          style={btnSecondaryStyle(isRunning)}
          title="Save DAG to database"
        >
          💾 Save
        </button>

        {!isRunning && !isPaused && (
          <button onClick={onRun} style={btnPrimaryStyle} title="Execute complete DAG workflow">
            ▶ Run
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
              ▶ Resume
            </button>
            <button onClick={onStop} style={btnDangerStyle} title="Reset pipeline status">
              ⏹ Reset
            </button>
          </>
        )}

        <button
          onClick={onClear}
          disabled={isRunning}
          style={btnGhostDangerStyle(isRunning)}
          title="Clear canvas"
        >
          🗑
        </button>
      </div>

      <div style={{ width: 1, height: 20, background: "rgba(255, 255, 255, 0.1)", flexShrink: 0 }} />

      {/* Advanced Studio Tools */}
      <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
        {onOpenProfile && (
          <button onClick={onOpenProfile} style={btnStudioStyle("#06b6d4")} title="Dataset Quality & Profiling">
            📊 Profile
          </button>
        )}
        {onOpenAutoML && (
          <button onClick={onOpenAutoML} style={btnStudioStyle("#ff0071")} title="1-Click AutoML Search">
            🤖 AutoML
          </button>
        )}
        {onOpenCompare && (
          <button onClick={onOpenCompare} style={btnStudioStyle("#3b82f6")} title="Compare Multiple Models">
            ⚖️ Compare
          </button>
        )}
        {onOpenRegistry && (
          <button onClick={onOpenRegistry} style={btnStudioStyle("#a855f7")} title="Model Registry & REST APIs">
            📦 Registry
          </button>
        )}
        {onOpenWhatIf && (
          <button onClick={onOpenWhatIf} style={btnStudioStyle("#f59e0b")} title="What-If Feature Simulation">
            🔮 What-If
          </button>
        )}
        {onOpenReport && (
          <button onClick={onOpenReport} style={btnStudioStyle("#10b981")} title="View / Export ML Report">
            📄 Report
          </button>
        )}
        {onOpenCopilot && (
          <button onClick={onOpenCopilot} style={btnCopilotStyle} title="AI Pipeline Copilot">
            ✨ Copilot
          </button>
        )}
      </div>

      <div style={{ width: 1, height: 20, background: "rgba(255, 255, 255, 0.1)", flexShrink: 0 }} />

      {/* Project Export / Import */}
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
        {onExportProject && (
          <button onClick={onExportProject} style={iconBtnStyle} title="Export Project as JSON">
            ⤓ Project
          </button>
        )}
        {onImportProject && (
          <label style={{ ...iconBtnStyle, cursor: "pointer", display: "flex", alignItems: "center", margin: 0 }}>
            ⤒ Import
            <input
              type="file"
              accept=".json"
              onChange={onImportProject}
              style={{ display: "none" }}
            />
          </label>
        )}
      </div>

      <div style={{ width: 1, height: 20, background: "rgba(255, 255, 255, 0.1)", flexShrink: 0 }} />

      {/* Canvas Zoom Controls */}
      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
        <button onClick={onZoomIn} style={iconBtnStyle} title="Zoom In (+)">+</button>
        <button onClick={onZoomOut} style={iconBtnStyle} title="Zoom Out (-)">-</button>
        <button onClick={onFitView} style={iconBtnStyle} title="Fit Canvas">⛶</button>
      </div>

      <div style={{ width: 1, height: 20, background: "rgba(255, 255, 255, 0.1)", flexShrink: 0 }} />

      {/* VS Code Style Panel Toggles */}
      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
        <button
          onClick={() => setShowLeftPanel && setShowLeftPanel(!showLeftPanel)}
          style={panelToggleStyle(showLeftPanel)}
          title="Toggle Left Node Library"
        >
          ◧ Left
        </button>
        <button
          onClick={() => setShowBottomPanel && setShowBottomPanel(!showBottomPanel)}
          style={panelToggleStyle(showBottomPanel)}
          title="Toggle Bottom Dataset Viewer"
        >
          ⬒ Bottom
        </button>
        <button
          onClick={() => setShowRightPanel && setShowRightPanel(!showRightPanel)}
          style={panelToggleStyle(showRightPanel)}
          title="Toggle Right Inspector & Logs"
        >
          ◨ Right
        </button>
      </div>

      {/* Status Badge */}
      <span className={`badge ${sc.cls}`} style={{ marginLeft: "auto", flexShrink: 0, fontSize: 11 }}>
        {sc.label}
      </span>
    </div>
  );
}

const btnPrimaryStyle = {
  background: "linear-gradient(135deg, #ff0071 0%, #d90368 100%)",
  border: "none",
  color: "#fff",
  padding: "5px 14px",
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 2px 12px rgba(255, 0, 113, 0.4)",
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const btnResumeStyle = {
  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  border: "none",
  color: "#fff",
  padding: "5px 14px",
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 2px 12px rgba(16, 185, 129, 0.4)",
};

const btnWarningStyle = {
  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  border: "none",
  color: "#fff",
  padding: "5px 12px",
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const btnDangerStyle = {
  background: "rgba(239, 68, 68, 0.2)",
  border: "1px solid rgba(239, 68, 68, 0.4)",
  color: "#fca5a5",
  padding: "5px 10px",
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const btnSecondaryStyle = (disabled) => ({
  background: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  color: "#e2e8f0",
  padding: "5px 10px",
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
});

const btnGhostDangerStyle = (disabled) => ({
  background: "rgba(239, 68, 68, 0.06)",
  border: "1px solid rgba(239, 68, 68, 0.2)",
  color: "#fca5a5",
  padding: "5px 8px",
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
});

const btnStudioStyle = (color) => ({
  background: `${color}14`,
  border: `1px solid ${color}33`,
  color: color,
  padding: "4px 8px",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  transition: "all 0.15s ease",
});

const btnCopilotStyle = {
  background: "linear-gradient(135deg, rgba(255,0,113,0.2), rgba(139,92,246,0.2))",
  border: "1px solid rgba(255,0,113,0.4)",
  color: "#ff85be",
  padding: "4px 10px",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

const iconBtnStyle = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  color: "#94a3b8",
  padding: "4px 8px",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};

const panelToggleStyle = (active) => ({
  background: active ? "rgba(255, 0, 113, 0.18)" : "rgba(255, 255, 255, 0.03)",
  border: active ? "1px solid rgba(255, 0, 113, 0.45)" : "1px solid rgba(255, 255, 255, 0.08)",
  color: active ? "#ff85be" : "#64748b",
  padding: "4px 7px",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
});