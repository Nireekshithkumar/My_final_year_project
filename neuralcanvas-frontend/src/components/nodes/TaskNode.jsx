// src/components/nodes/TaskNode.jsx
import { Handle, Position } from "reactflow";
import { useReactFlow } from "reactflow";

export default function TaskNode({ id, data }) {
  const { icon, iconColor, title, subtitle, checked, outputs = [], nodeType, lastPrediction } = data;
  const { setNodes, setEdges } = useReactFlow();

  const handleDelete = (e) => {
    e.stopPropagation();
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    data.onDownload?.(id, data.params);
  };

  const handlePredict = (e) => {
    e.stopPropagation();
    data.onPredict?.(id);
  };

  return (
    <div style={styles.card}>
      <Handle type="target" position={Position.Left} style={styles.handleIn} />

      <div style={styles.header}>
        <div style={{ ...styles.iconCircle, background: iconColor }}>{icon}</div>
        <span style={styles.title}>{title}</span>

        {nodeType === "SaveModel" && (
          <button onClick={handleDownload} style={styles.downloadBtn} title="Download model bundle">
            ⬇
          </button>
        )}

        <button onClick={handleDelete} style={styles.deleteBtn} title="Delete node">×</button>
      </div>

      <div style={styles.subtitleRow}>
        <span style={styles.subtitle}>{subtitle}</span>
        {checked && <span style={styles.checkBadge}>✓</span>}
      </div>

      {nodeType === "predict" && (
        <>
          <button onClick={handlePredict} style={styles.predictBtn}>
            Predict
          </button>
          {lastPrediction !== undefined && lastPrediction !== null && (
            <div style={styles.predictionResult}>
              Result: <strong>{String(lastPrediction)}</strong>
            </div>
          )}
        </>
      )}

      {outputs.map((out) => (
        <div key={out.id} style={{ ...styles.outputRow, position: "relative" }}>
          <span style={{ ...styles.outputPill, background: out.color }}>
            {out.label}
          </span>
          <Handle
            type="source"
            position={Position.Right}
            id={out.id}
            style={{ ...styles.handleOut, top: "50%" }}
          />
        </div>
      ))}
    </div>
  );
}

const styles = {
  card: {
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)", padding: "10px 14px",
    minWidth: 190, fontFamily: "Inter, sans-serif",
  },
  header: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  iconCircle: {
    width: 22, height: 22, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, color: "#fff", flexShrink: 0,
  },
  title: { fontWeight: 600, fontSize: 13, color: "#1e293b", flex: 1 },
  downloadBtn: {
    border: "none", background: "transparent", color: "#2563eb",
    fontSize: 14, cursor: "pointer", lineHeight: 1, padding: "0 2px",
  },
  deleteBtn: {
    border: "none", background: "transparent", color: "#ef4444",
    fontSize: 16, cursor: "pointer", lineHeight: 1, padding: "0 2px",
  },
  subtitleRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "#f8fafc", borderRadius: 6, padding: "4px 8px", marginBottom: 6,
  },
  subtitle: { fontSize: 12, color: "#475569" },
  checkBadge: { background: "#2563eb", color: "#fff", borderRadius: 4, fontSize: 10, padding: "1px 5px" },
  outputRow: { marginTop: 4 },
  outputPill: {
    display: "inline-block", color: "#fff", fontSize: 11,
    borderRadius: 12, padding: "3px 10px", width: "100%", textAlign: "center",
  },
  predictBtn: {
    width: "100%", background: "#2563eb", color: "#fff", border: "none",
    borderRadius: 6, padding: "6px 0", fontSize: 12, fontWeight: 600,
    cursor: "pointer", marginBottom: 6,
  },
  predictionResult: {
    fontSize: 12, color: "#16a34a", fontWeight: 600,
    background: "#f0fdf4", borderRadius: 6, padding: "4px 8px", marginBottom: 6,
  },
  handleIn: { background: "#94a3b8", width: 8, height: 8 },
  handleOut: { background: "#3b82f6", width: 8, height: 8 },
};