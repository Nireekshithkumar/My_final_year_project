import { useState, useEffect, useRef } from "react";
import api from "../api/axios";

const TYPE_BADGES = {
  numerical: { bg: "#0891b2", label: "NUM" },
  categorical: { bg: "#8b5cf6", label: "CAT" },
  text: { bg: "#f59e0b", label: "TXT" },
  boolean: { bg: "#16a34a", label: "BOOL" },
  datetime: { bg: "#ec4899", label: "DATE" },
};

export default function DatasetViewer({ pipelineId, selectedNodeId, isDark, refreshTrigger, height = 230, onHeightChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState("");
  const [notRunYet, setNotRunYet] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedCol, setExpandedCol] = useState(null);
  const [partition, setPartition] = useState("X_train");

  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(height);

  useEffect(() => {
    if (!pipelineId) return;

    const fetchPreview = async () => {
      setLoading(true);
      setError("");
      setNotRunYet(false);
      try {
        const url = selectedNodeId
          ? `/pipelines/${pipelineId}/nodes/${selectedNodeId}/preview/?page=${page}&page_size=30&partition=${partition}`
          : `/pipelines/${pipelineId}/nodes/preview/?page=${page}&page_size=30`;
        const { data } = await api.get(url);
        setPreviewData(data);
      } catch (err) {
        setPreviewData(null);
        const status = err.response?.status;
        const detail = err.response?.data?.detail || "";
        if (status === 404) {
          setNotRunYet(true);
        } else {
          setError(detail || "No dataset output available for this node.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [pipelineId, selectedNodeId, page, refreshTrigger, partition]);

  // Mouse drag resizing handler
  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const deltaY = startYRef.current - moveEvent.clientY;
      const newHeight = Math.min(Math.max(startHeightRef.current + deltaY, 120), window.innerHeight * 0.75);
      if (onHeightChange) onHeightChange(newHeight);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const columns = previewData?.columns || [];
  const rows = previewData?.rows || [];
  const columnTypes = previewData?.column_types || {};
  const columnStats = previewData?.column_stats || {};
  const totalRows = previewData?.total_rows || 0;
  const totalColumns = previewData?.total_columns || 0;
  const currentPartition = previewData?.partition || null;
  const totalPages = Math.ceil(totalRows / 30) || 1;

  const currentHeight = isMaximized ? "75vh" : collapsed ? 38 : `${height}px`;

  return (
    <div
      style={{
        height: currentHeight,
        background: "rgba(10, 15, 26, 0.98)",
        borderTop: "1px solid rgba(255, 255, 255, 0.1)",
        display: "flex",
        flexDirection: "column",
        zIndex: 20,
        backdropFilter: "blur(20px)",
        position: "relative",
        transition: isDraggingRef.current ? "none" : "height 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Resizer Handle Bar */}
      {!collapsed && (
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: "absolute",
            top: -4,
            left: 0,
            right: 0,
            height: 8,
            cursor: "row-resize",
            zIndex: 30,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          title="Drag to resize bottom panel height"
        >
          <div
            style={{
              width: 48,
              height: 3,
              borderRadius: 2,
              background: "rgba(255, 255, 255, 0.2)",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#ff0071")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)")}
          />
        </div>
      )}

      {/* Top Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 16px",
          borderBottom: collapsed ? "none" : "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(17, 24, 39, 0.8)",
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontWeight: 700, color: "#f8fafc", display: "flex", alignItems: "center", gap: 6 }}>
            📊 {selectedNodeId ? `Node Preview (${selectedNodeId})` : "Dataset Table"}
          </span>
          {totalRows > 0 && !collapsed && (
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              {totalRows} rows • {totalColumns} columns
              {currentPartition && ` • ${currentPartition}`}
            </span>
          )}
          {/* Partition selector for split-dataset nodes */}
          {currentPartition && !collapsed && (
            <select
              value={partition}
              onChange={(e) => { setPartition(e.target.value); setPage(1); }}
              style={{
                fontSize: 11,
                background: "rgba(30, 41, 59, 0.9)",
                color: "#e2e8f0",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 4,
                padding: "2px 6px",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="X_train">X_train</option>
              <option value="X_test">X_test</option>
              <option value="y_train">y_train</option>
              <option value="y_test">y_test</option>
              <option value="all">All (combined)</option>
            </select>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {totalPages > 1 && !collapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8" }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                style={paginationBtnStyle(page <= 1)}
              >
                ◀ Prev
              </button>
              <span>{page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={paginationBtnStyle(page >= totalPages)}
              >
                Next ▶
              </button>
            </div>
          )}

          <button
            onClick={() => setIsMaximized(!isMaximized)}
            style={actionBtnStyle}
            title={isMaximized ? "Restore size" : "Maximize panel"}
          >
            {isMaximized ? "❐ Restore" : "⛶ Maximize"}
          </button>

          <button
            onClick={() => {
              setCollapsed(!collapsed);
              if (isMaximized) setIsMaximized(false);
            }}
            style={actionBtnStyle}
          >
            {collapsed ? "▲ Expand" : "▼ Collapse"}
          </button>
        </div>
      </div>

      {/* Table Body Content */}
      {!collapsed && (
        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
          {loading && (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
              Loading dataset preview…
            </div>
          )}

          {!loading && notRunYet && (
            <div style={{ padding: 36, textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
              <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>This block has not been executed yet.</div>
              <p style={{ fontSize: 11.5, color: "#475569", marginTop: 4 }}>
                Click ▶ Run on the node or ▶ Run Full Pipeline on the top toolbar to generate outputs.
              </p>
            </div>
          )}

          {!loading && error && !notRunYet && (
            <div style={{ padding: 30, textAlign: "center", color: "#fca5a5" }}>
              ⚠ {error}
            </div>
          )}

          {!loading && !notRunYet && !error && rows.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>
              No tabular data rows available.
            </div>
          )}

          {!loading && !notRunYet && !error && rows.length > 0 && (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 11.5,
                textAlign: "left",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <thead>
                <tr style={{ background: "#0e1524", position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
                  <th style={{ padding: "8px 10px", width: 40, color: "#64748b" }}>#</th>
                  {columns.map((col) => {
                    const badge = TYPE_BADGES[columnTypes[col]] || { bg: "#475569", label: "TXT" };
                    return (
                      <th key={col} style={{ padding: "8px 12px", borderLeft: "1px solid rgba(255, 255, 255, 0.05)", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 700, color: "#f1f5f9" }}>{col}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, background: badge.bg, color: "#fff", padding: "1px 5px", borderRadius: 3 }}>
                            {badge.label}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                      background: rIdx % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.015)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 0, 113, 0.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = rIdx % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.015)")}
                  >
                    <td style={{ padding: "6px 10px", color: "#64748b" }}>{(page - 1) * 30 + rIdx + 1}</td>
                    {columns.map((col) => (
                      <td key={col} style={{ padding: "6px 12px", borderLeft: "1px solid rgba(255, 255, 255, 0.04)", color: "#cbd5e1", whiteSpace: "nowrap" }}>
                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span style={{ color: "#64748b", fontStyle: "italic" }}>null</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

const paginationBtnStyle = (disabled) => ({
  background: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  color: disabled ? "#475569" : "#cbd5e1",
  padding: "3px 8px",
  borderRadius: 4,
  fontSize: 10.5,
  cursor: disabled ? "not-allowed" : "pointer",
});

const actionBtnStyle = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  color: "#94a3b8",
  padding: "3px 9px",
  borderRadius: 5,
  fontSize: 11,
  cursor: "pointer",
};
