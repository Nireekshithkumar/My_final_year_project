import { useState, useEffect } from "react";
import api from "../api/axios";

const TYPE_BADGES = {
  numerical: { bg: "#0891b2", label: "NUM" },
  categorical: { bg: "#8b5cf6", label: "CAT" },
  text: { bg: "#f59e0b", label: "TXT" },
  boolean: { bg: "#16a34a", label: "BOOL" },
  datetime: { bg: "#ec4899", label: "DATE" },
};

export default function DatasetViewer({ pipelineId, selectedNodeId, isDark, refreshTrigger }) {
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState("");
  const [notRunYet, setNotRunYet] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedCol, setExpandedCol] = useState(null);

  useEffect(() => {
    if (!pipelineId) return;

    const fetchPreview = async () => {
      setLoading(true);
      setError("");
      setNotRunYet(false);
      try {
        const url = selectedNodeId
          ? `/pipelines/${pipelineId}/nodes/${selectedNodeId}/preview/?page=${page}&page_size=30`
          : `/pipelines/${pipelineId}/nodes/preview/?page=${page}&page_size=30`;
        const { data } = await api.get(url);
        setPreviewData(data);
      } catch (err) {
        setPreviewData(null);
        const status = err.response?.status;
        const detail = err.response?.data?.detail || "";
        if (status === 404) {
          // Node exists but hasn't produced output yet — not an error
          setNotRunYet(true);
        } else {
          setError(detail || "No dataset output available for this node.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [pipelineId, selectedNodeId, page, refreshTrigger]);

  const c = isDark ? darkStyles : lightStyles;

  if (collapsed) {
    return (
      <div style={{ ...c.container, height: 36, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>📊 Dataset Preview & Statistics Panel</span>
        <button onClick={() => setCollapsed(false)} style={c.toggleBtn}>▲ Expand Panel</button>
      </div>
    );
  }

  return (
    <div style={{ ...c.container, height: 260, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={c.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>📊 Dataset Viewer</span>
          {previewData && (
            <span style={c.metaPill}>
              {previewData.total_rows} rows × {previewData.total_columns} columns | Node: {previewData.node_id}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {previewData && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={c.pageBtn}>◀</button>
              <span style={{ fontSize: 11 }}>Page {previewData.page} of {Math.ceil(previewData.total_rows / previewData.page_size) || 1}</span>
              <button disabled={page >= Math.ceil(previewData.total_rows / previewData.page_size)} onClick={() => setPage((p) => p + 1)} style={c.pageBtn}>▶</button>
            </div>
          )}
          <button onClick={() => setCollapsed(true)} style={c.toggleBtn}>▼ Collapse</button>
        </div>
      </div>

      {/* Main Table Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 12px 12px 12px" }}>
        {loading && <div style={c.emptyMsg}>Loading dataset slice…</div>}
        {!loading && notRunYet && (
          <div style={{ ...c.emptyMsg, color: '#f59e0b', fontSize: 12 }}>
            ⏳ This node hasn't been executed yet. Run the pipeline or Quick Run this node to see its output.
          </div>
        )}
        {!loading && !notRunYet && error && <div style={c.errorMsg}>{error}</div>}


        {!loading && !error && previewData && (
          <table style={c.table}>
            <thead>
              <tr>
                <th style={{ ...c.th, width: 40 }}>#</th>
                {previewData.columns.map((col) => {
                  const type = previewData.column_types[col] || "numerical";
                  const badge = TYPE_BADGES[type] || TYPE_BADGES.numerical;
                  const isExpanded = expandedCol === col;
                  const stats = previewData.column_stats[col] || {};

                  return (
                    <th key={col} style={c.th}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 600 }}>{col}</span>
                        <span style={{ ...c.badge, background: badge.bg }}>{badge.label}</span>
                      </div>
                      <button onClick={() => setExpandedCol(isExpanded ? null : col)} style={c.statsBtn}>
                        {isExpanded ? "Hide Stats ▲" : "Stats ▼"}
                      </button>

                      {/* Expandable Column Statistics Drawer */}
                      {isExpanded && (
                        <div style={c.statsDrawer}>
                          <div style={{ fontWeight: 700, marginBottom: 4, borderBottom: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`, paddingBottom: 2 }}>
                            Stats: {col}
                          </div>
                          {Object.entries(stats).map(([k, v]) => (
                            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, margin: "2px 0" }}>
                              <span style={{ opacity: 0.8 }}>{k}:</span>
                              <span style={{ fontWeight: 600 }}>{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {previewData.rows.map((row, idx) => (
                <tr key={idx} style={idx % 2 === 0 ? c.trEven : c.trOdd}>
                  <td style={{ ...c.td, color: isDark ? "#64748b" : "#94a3b8", fontSize: 10 }}>
                    {(previewData.page - 1) * previewData.page_size + idx + 1}
                  </td>
                  {previewData.columns.map((col) => (
                    <td key={col} style={c.td}>
                      {row[col] !== null && row[col] !== undefined ? String(row[col]) : <em style={{ opacity: 0.4 }}>NaN</em>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const darkStyles = {
  container: { background: "#0f172a", borderTop: "1px solid #334155", color: "#f1f5f9", fontFamily: "Inter, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid #1e293b" },
  metaPill: { background: "#1e293b", padding: "2px 8px", borderRadius: 12, fontSize: 11, color: "#94a3b8" },
  toggleBtn: { background: "transparent", border: "1px solid #334155", color: "#94a3b8", borderRadius: 4, padding: "2px 8px", fontSize: 11, cursor: "pointer" },
  pageBtn: { background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9", borderRadius: 4, padding: "2px 6px", fontSize: 11, cursor: "pointer" },
  emptyMsg: { padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 },
  errorMsg: { padding: 20, textAlign: "center", color: "#f87171", fontSize: 12 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: { position: "sticky", top: 0, background: "#1e293b", padding: "6px 10px", textAlign: "left", borderBottom: "2px solid #334155", zIndex: 10 },
  td: { padding: "6px 10px", borderBottom: "1px solid #1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWIdth: 200 },
  trEven: { background: "#0f172a" },
  trOdd: { background: "#182234" },
  badge: { fontSize: 9, fontWeight: 700, color: "#fff", borderRadius: 3, padding: "1px 4px" },
  statsBtn: { background: "transparent", border: "none", color: "#38bdf8", fontSize: 10, cursor: "pointer", padding: 0, marginTop: 2 },
  statsDrawer: { position: "absolute", top: "100%", left: 0, width: 160, background: "#1e293b", border: "1px solid #475569", borderRadius: 6, padding: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.5)", zIndex: 100, textAlign: "left" }
};

const lightStyles = {
  container: { background: "#fff", borderTop: "1px solid #e2e8f0", color: "#0f172a", fontFamily: "Inter, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid #f1f5f9" },
  metaPill: { background: "#f1f5f9", padding: "2px 8px", borderRadius: 12, fontSize: 11, color: "#475569" },
  toggleBtn: { background: "transparent", border: "1px solid #cbd5e1", color: "#475569", borderRadius: 4, padding: "2px 8px", fontSize: 11, cursor: "pointer" },
  pageBtn: { background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 4, padding: "2px 6px", fontSize: 11, cursor: "pointer" },
  emptyMsg: { padding: 20, textAlign: "center", color: "#64748b", fontSize: 12 },
  errorMsg: { padding: 20, textAlign: "center", color: "#dc2626", fontSize: 12 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: { position: "sticky", top: 0, background: "#f8fafc", padding: "6px 10px", textAlign: "left", borderBottom: "2px solid #e2e8f0", zIndex: 10 },
  td: { padding: "6px 10px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWIdth: 200 },
  trEven: { background: "#fff" },
  trOdd: { background: "#f8fafc" },
  badge: { fontSize: 9, fontWeight: 700, color: "#fff", borderRadius: 3, padding: "1px 4px" },
  statsBtn: { background: "transparent", border: "none", color: "#0284c7", fontSize: 10, cursor: "pointer", padding: 0, marginTop: 2 },
  statsDrawer: { position: "absolute", top: "100%", left: 0, width: 160, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, padding: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 100, textAlign: "left" }
};
