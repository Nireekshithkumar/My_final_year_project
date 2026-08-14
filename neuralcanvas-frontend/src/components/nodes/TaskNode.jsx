import { Handle, Position, useReactFlow } from "reactflow";

const STATUS_MAP = {
  not_run: { label: "Not Run", bg: "rgba(100,116,139,0.2)", color: "#94a3b8", border: "rgba(100,116,139,0.3)" },
  ready: { label: "Ready", bg: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "rgba(99,102,241,0.4)" },
  running: { label: "⏳ Running", bg: "rgba(251,191,36,0.2)", color: "#fde68a", border: "rgba(251,191,36,0.4)" },
  success: { label: "✓ Done", bg: "rgba(34,197,94,0.2)", color: "#86efac", border: "rgba(34,197,94,0.4)" },
  failed: { label: "✗ Failed", bg: "rgba(239,68,68,0.2)", color: "#fca5a5", border: "rgba(239,68,68,0.4)" },
  waiting_for_dependency: { label: "Waiting…", bg: "rgba(249,115,22,0.2)", color: "#fdba74", border: "rgba(249,115,22,0.4)" },
};

export default function TaskNode({ id, data }) {
  const { icon, iconColor, title, subtitle, outputs = [], nodeType, lastPrediction, status = "ready" } = data;
  const { setNodes, setEdges } = useReactFlow();

  const handleDelete = (e) => {
    e.stopPropagation();
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleDownload = (e) => { e.stopPropagation(); data.onDownload?.(id, data.params); };
  const handlePredict = (e) => { e.stopPropagation(); data.onPredict?.(id); };
  const handleRunNode = (e) => { e.stopPropagation(); data.onRunNode?.(id); };

  const sb = STATUS_MAP[status] || STATUS_MAP.ready;

  return (
    <div style={{
      background: "rgba(15,23,42,0.95)",
      border: `1px solid ${iconColor || "rgba(99,102,241,0.3)"}44`,
      borderRadius: 12,
      boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px ${iconColor || "#6366f1"}22`,
      padding: "10px 13px",
      minWidth: 185,
      fontFamily: "'Inter', sans-serif",
      backdropFilter: "blur(10px)",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: "#6366f1", width: 8, height: 8, border: "2px solid #080c14" }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 7,
          background: `${iconColor}30` || "rgba(99,102,241,0.2)",
          border: `1px solid ${iconColor}50` || "rgba(99,102,241,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, flexShrink: 0,
        }}>
          {icon}
        </div>
        <span style={{ fontWeight: 700, fontSize: 12.5, color: "#f1f5f9", flex: 1, lineHeight: 1.2 }}>{title}</span>
        {nodeType === "SaveModel" && (
          <button onClick={handleDownload} style={{ border: "none", background: "transparent", color: "#a5b4fc", fontSize: 14, cursor: "pointer", padding: "0 2px" }} title="Download">⬇</button>
        )}
        <button onClick={handleDelete} style={{ border: "none", background: "transparent", color: "#475569", fontSize: 15, cursor: "pointer", padding: "0 2px", lineHeight: 1 }} title="Delete node">×</button>
      </div>

      {/* Subtitle + status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(8,12,20,0.6)", borderRadius: 7, padding: "4px 8px", marginBottom: 7 }}>
        <span style={{ fontSize: 11, color: "#475569" }}>{subtitle}</span>
        <span style={{
          borderRadius: 4, fontSize: 9.5, padding: "2px 6px", fontWeight: 700,
          background: sb.bg, color: sb.color, border: `1px solid ${sb.border}`,
        }}>
          {sb.label}
        </span>
      </div>

      {/* Run Node button */}
      {nodeType !== "start" && nodeType !== "end" && nodeType !== "predict" && (
        <button
          onClick={handleRunNode}
          style={{
            width: "100%",
            background: "linear-gradient(135deg, rgba(5,150,105,0.8), rgba(16,185,129,0.6))",
            color: "#ecfdf5",
            border: "1px solid rgba(16,185,129,0.3)",
            borderRadius: 7, padding: "5px 0",
            fontSize: 11, fontWeight: 700,
            cursor: "pointer", marginBottom: 6,
            transition: "all 0.15s",
          }}
        >
          ▶ Run Node
        </button>
      )}

      {/* Predict */}
      {nodeType === "predict" && (
        <>
          <button
            onClick={handlePredict}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, rgba(99,102,241,0.8), rgba(139,92,246,0.6))",
              color: "#f1f5f9", border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: 7, padding: "6px 0", fontSize: 12, fontWeight: 700,
              cursor: "pointer", marginBottom: 6,
            }}
          >
            🎯 Predict
          </button>
          {lastPrediction !== undefined && lastPrediction !== null && (
            <div style={{
              fontSize: 11, color: "#86efac", fontWeight: 600,
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: 7, padding: "4px 8px", marginBottom: 6,
            }}>
              Result: <strong>{String(lastPrediction)}</strong>
            </div>
          )}
        </>
      )}

      {/* Output handles */}
      {outputs.map((out) => (
        <div key={out.id} style={{ marginTop: 4, position: "relative" }}>
          <span style={{
            display: "inline-block",
            background: `${out.color}22`,
            border: `1px solid ${out.color}44`,
            color: out.color,
            fontSize: 10.5, borderRadius: 10,
            padding: "3px 10px", width: "100%", textAlign: "center",
            fontWeight: 600,
          }}>
            {out.label}
          </span>
          <Handle
            type="source"
            position={Position.Right}
            id={out.id}
            style={{ background: out.color, width: 8, height: 8, border: "2px solid #080c14", top: "50%" }}
          />
        </div>
      ))}
    </div>
  );
}