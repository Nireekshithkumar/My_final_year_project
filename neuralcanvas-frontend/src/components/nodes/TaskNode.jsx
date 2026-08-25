import { Handle, Position, useReactFlow } from "reactflow";

const STATUS_MAP = {
  not_run: { label: "Not Run", bg: "rgba(100,116,139,0.15)", color: "#94a3b8", border: "rgba(100,116,139,0.25)" },
  ready: { label: "Ready", bg: "rgba(255,0,113,0.12)", color: "#ff85be", border: "rgba(255,0,113,0.3)" },
  pending: { label: "⏳ Pending", bg: "rgba(100,116,139,0.15)", color: "#94a3b8", border: "rgba(100,116,139,0.25)" },
  running: { label: "⏳ Running", bg: "rgba(255,0,113,0.25)", color: "#ffc2dd", border: "rgba(255,0,113,0.6)" },
  success: { label: "✓ Done", bg: "rgba(34,197,94,0.15)", color: "#86efac", border: "rgba(34,197,94,0.35)" },
  failed: { label: "✗ Failed", bg: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "rgba(239,68,68,0.35)" },
  skipped: { label: "⊘ Skipped", bg: "rgba(148,163,184,0.12)", color: "#94a3b8", border: "rgba(148,163,184,0.25)" },
  waiting_for_dependency: { label: "Waiting…", bg: "rgba(249,115,22,0.15)", color: "#fdba74", border: "rgba(249,115,22,0.35)" },
};

export default function TaskNode({ id, data = {}, selected }) {
  const {
    icon = "⚙️",
    iconColor = "#ff0071",
    title = "Node",
    subtitle = "",
    outputs = [],
    nodeType = "",
    lastPrediction,
    status = "ready",
  } = data || {};
  const { setNodes, setEdges } = useReactFlow();

  const handleDelete = (e) => {
    e.stopPropagation();
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    data?.onDownload?.(id, data?.params);
  };
  const handlePredict = (e) => {
    e.stopPropagation();
    data?.onPredict?.(id);
  };
  const handleRunNode = (e) => {
    e.stopPropagation();
    data?.onRunNode?.(id);
  };

  const sb = STATUS_MAP[status] || STATUS_MAP.ready;


  return (
    <div style={{
      background: "rgba(17, 24, 39, 0.95)",
      border: selected ? "1.5px solid #ff0071" : "1px solid rgba(255, 255, 255, 0.1)",
      borderRadius: 14,
      boxShadow: selected
        ? "0 0 0 2px rgba(255,0,113,0.4), 0 12px 36px rgba(255,0,113,0.25)"
        : "0 10px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
      padding: "12px 14px",
      minWidth: 200,
      fontFamily: "'Inter', sans-serif",
      backdropFilter: "blur(16px)",
      transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
    }}>
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: "#ff0071",
          width: 12,
          height: 12,
          border: "2.5px solid #090d16",
          borderRadius: "50%",
          cursor: "crosshair",
          boxShadow: "0 0 8px rgba(255, 0, 113, 0.6)",
        }}
      />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <div style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: "rgba(255, 0, 113, 0.15)",
          border: "1px solid rgba(255, 0, 113, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          flexShrink: 0,
          boxShadow: "0 0 12px rgba(255,0,113,0.2)",
        }}>
          {icon || "⚙️"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 700,
            fontSize: 13,
            color: "#f8fafc",
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {title}
          </div>
        </div>
        {nodeType === "SaveModel" && (
          <button
            onClick={handleDownload}
            style={{ border: "none", background: "rgba(255,0,113,0.15)", color: "#ff85be", borderRadius: 6, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, cursor: "pointer" }}
            title="Download"
          >
            ⬇
          </button>
        )}
        <button
          onClick={handleDelete}
          style={{
            border: "none",
            background: "transparent",
            color: "#64748b",
            fontSize: 16,
            cursor: "pointer",
            padding: "0 2px",
            lineHeight: 1,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.target.style.color = "#ff0071")}
          onMouseLeave={(e) => (e.target.style.color = "#64748b")}
          title="Delete node"
        >
          ×
        </button>
      </div>

      {/* Subtitle & Status Badge */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "rgba(10, 15, 26, 0.8)",
        borderRadius: 8,
        padding: "5px 9px",
        marginBottom: 8,
        border: "1px solid rgba(255,255,255,0.05)",
      }}>
        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>{subtitle}</span>
        <span style={{
          borderRadius: 6,
          fontSize: 9.5,
          padding: "2px 7px",
          fontWeight: 700,
          letterSpacing: 0.3,
          background: sb.bg,
          color: sb.color,
          border: `1px solid ${sb.border}`,
        }}>
          {sb.label}
        </span>
      </div>

      {/* Clear Error Message Banner */}
      {status === 'failed' && (data?.lastError || data?.error) && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#fca5a5',
            fontSize: 10.5,
            lineHeight: 1.35,
            padding: '7px 9px',
            borderRadius: 8,
            marginBottom: 8,
            wordBreak: 'break-word',
          }}
        >
          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <span>⚠️</span>
            <span>{data?.errorType ? data.errorType.replace(/_/g, ' ') : 'Node Error'}</span>
          </div>
          <div>{data?.lastError || data?.error}</div>
          {Array.isArray(data?.availableColumns) && data.availableColumns.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 9.5, color: '#f87171' }}>
              Available columns: {data.availableColumns.slice(0, 4).join(', ')}
              {data.availableColumns.length > 4 ? ` (+${data.availableColumns.length - 4} more)` : ''}
            </div>
          )}
        </div>
      )}

      {/* Run Node Action Button */}
      {nodeType !== "start" && nodeType !== "end" && nodeType !== "predict" && (
        <button
          onClick={handleRunNode}
          style={{
            width: "100%",
            background: "linear-gradient(135deg, rgba(255, 0, 113, 0.85), rgba(217, 3, 104, 0.95))",
            color: "#fff",
            border: "1px solid rgba(255, 0, 113, 0.4)",
            borderRadius: 8,
            padding: "6px 0",
            fontSize: 11.5,
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 6,
            boxShadow: "0 3px 12px rgba(255, 0, 113, 0.3)",
            transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = "brightness(1.15)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = "brightness(1)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          ⚡ Quick Run
        </button>
      )}

      {/* Predict Action */}
      {nodeType === "predict" && (
        <>
          <button
            onClick={handlePredict}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #ff0071, #8b5cf6)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "7px 0",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              marginBottom: 6,
              boxShadow: "0 4px 16px rgba(255, 0, 113, 0.4)",
            }}
          >
            🎯 Predict
          </button>
          {lastPrediction !== undefined && lastPrediction !== null && (
            <div style={{
              fontSize: 11,
              color: "#86efac",
              fontWeight: 600,
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 8,
              padding: "5px 9px",
              marginBottom: 6,
              textAlign: "center",
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
            background: "rgba(255, 0, 113, 0.1)",
            border: "1px solid rgba(255, 0, 113, 0.3)",
            color: "#ff85be",
            fontSize: 10.5,
            borderRadius: 8,
            padding: "4px 10px",
            width: "100%",
            textAlign: "center",
            fontWeight: 600,
          }}>
            {out.label}
          </span>
          <Handle
            type="source"
            position={Position.Right}
            id={out.id}
            style={{
              background: "#ff0071",
              width: 12,
              height: 12,
              border: "2.5px solid #090d16",
              borderRadius: "50%",
              top: "50%",
              cursor: "crosshair",
              boxShadow: "0 0 8px rgba(255, 0, 113, 0.6)",
            }}
          />
        </div>
      ))}
    </div>
  );
}