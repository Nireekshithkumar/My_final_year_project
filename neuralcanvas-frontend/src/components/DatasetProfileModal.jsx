import { useState, useEffect } from "react";
import api from "../api/axios";

export default function DatasetProfileModal({ isOpen, onClose, datasetId, onApplyTarget }) {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("");

  useEffect(() => {
    if (!isOpen || !datasetId) return;

    const fetchProfile = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get(`/datasets/${datasetId}/profile/`);
        setProfile(data);
        if (data.target_suggestions && data.target_suggestions.length > 0) {
          setSelectedTarget(data.target_suggestions[0].column);
        }
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to generate dataset profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [isOpen, datasetId]);

  if (!isOpen) return null;

  const getScoreColor = (score) => {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        {/* Modal Header */}
        <div style={modalHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                Dataset Profile & Quality Analysis
              </h2>
              <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                {profile?.name || "Analyzing dataset..."}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 20, overflowY: "auto", maxHeight: "calc(85vh - 120px)" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
              <div style={{ fontSize: 28, animation: "pulse-pink 1.5s infinite" }}>⚡</div>
              <div style={{ marginTop: 8, fontWeight: 600 }}>Calculating dataset statistics and quality score…</div>
            </div>
          )}

          {error && (
            <div style={errorBannerStyle}>
              ⚠️ {error}
            </div>
          )}

          {profile && !loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Top Metrics Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
                <div style={statCardStyle}>
                  <div style={statLabelStyle}>ROWS</div>
                  <div style={statValStyle}>{profile.total_rows?.toLocaleString()}</div>
                </div>
                <div style={statCardStyle}>
                  <div style={statLabelStyle}>COLUMNS</div>
                  <div style={statValStyle}>{profile.total_columns}</div>
                </div>
                <div style={statCardStyle}>
                  <div style={statLabelStyle}>NUMERICAL</div>
                  <div style={{ ...statValStyle, color: "#06b6d4" }}>{profile.numerical_columns_count}</div>
                </div>
                <div style={statCardStyle}>
                  <div style={statLabelStyle}>CATEGORICAL</div>
                  <div style={{ ...statValStyle, color: "#a855f7" }}>{profile.categorical_columns_count}</div>
                </div>
                <div style={statCardStyle}>
                  <div style={statLabelStyle}>MISSING VALUES</div>
                  <div style={{ ...statValStyle, color: profile.total_missing_values > 0 ? "#f59e0b" : "#22c55e" }}>
                    {profile.total_missing_values} ({profile.missing_percentage}%)
                  </div>
                </div>
                <div style={statCardStyle}>
                  <div style={statLabelStyle}>DUPLICATES</div>
                  <div style={{ ...statValStyle, color: profile.duplicate_rows > 0 ? "#ef4444" : "#22c55e" }}>
                    {profile.duplicate_rows}
                  </div>
                </div>
                <div style={statCardStyle}>
                  <div style={statLabelStyle}>DATA QUALITY</div>
                  <div style={{ ...statValStyle, color: getScoreColor(profile.data_quality_score) }}>
                    {profile.data_quality_score}/100
                  </div>
                </div>
              </div>

              {/* Task Detection & Target Suggestions */}
              <div style={sectionBoxStyle}>
                <h3 style={sectionTitleStyle}>🎯 Automatic Target & Task Detection</h3>
                <div style={{ display: "flex", gap: 20, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>DETECTED TASK</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#ff85be" }}>
                      {profile.detected_task?.task || "Classification"}
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginLeft: 8 }}>
                        (Confidence: {profile.detected_task?.confidence}%)
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {profile.detected_task?.reasoning}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>SUGGESTED TARGET COLUMN</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <select
                        value={selectedTarget}
                        onChange={(e) => setSelectedTarget(e.target.value)}
                        style={selectStyle}
                      >
                        {profile.columns?.map((c) => (
                          <option key={c} value={c}>
                            {c} {profile.target_suggestions?.some((s) => s.column === c) ? "★" : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => onApplyTarget && onApplyTarget(selectedTarget)}
                        style={btnApplyTargetStyle}
                      >
                        Use Target
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column Summary Table */}
              <div style={sectionBoxStyle}>
                <h3 style={sectionTitleStyle}>📋 Column Analysis Breakdown</h3>
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.03)", color: "#94a3b8", textAlign: "left" }}>
                        <th style={thStyle}>Column Name</th>
                        <th style={thStyle}>Type</th>
                        <th style={thStyle}>Missing (%)</th>
                        <th style={thStyle}>Unique Values</th>
                        <th style={thStyle}>Outliers</th>
                        <th style={thStyle}>Mean / Distribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.columns?.map((col) => {
                        const cp = profile.column_profiles?.[col] || {};
                        return (
                          <tr key={col} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <td style={tdStyle}>
                              <strong>{col}</strong>
                              {col === selectedTarget && <span style={targetBadgeStyle}>TARGET</span>}
                            </td>
                            <td style={tdStyle}>
                              <span style={typeBadgeStyle(cp.type)}>{cp.type?.toUpperCase()}</span>
                            </td>
                            <td style={{ ...tdStyle, color: cp.null_count > 0 ? "#f59e0b" : "#86efac" }}>
                              {cp.null_count} ({cp.null_pct}%)
                            </td>
                            <td style={tdStyle}>{cp.unique_count}</td>
                            <td style={{ ...tdStyle, color: cp.outliers_count > 0 ? "#ef4444" : "#64748b" }}>
                              {cp.outliers_count || "0"}
                            </td>
                            <td style={{ ...tdStyle, color: "#94a3b8" }}>
                              {cp.mean !== undefined ? `Mean: ${cp.mean} [${cp.min} - ${cp.max}]` : "Categorical / Text"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.75)",
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 20,
};

const modalContentStyle = {
  background: "#0d1322",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 16,
  width: "100%",
  maxWidth: 880,
  maxHeight: "85vh",
  boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  fontFamily: "'Inter', sans-serif",
};

const modalHeaderStyle = {
  padding: "16px 20px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "rgba(10, 15, 26, 0.8)",
};

const closeBtnStyle = {
  background: "transparent",
  border: "none",
  color: "#64748b",
  fontSize: 18,
  cursor: "pointer",
  padding: "4px 8px",
};

const statCardStyle = {
  background: "rgba(15, 23, 42, 0.8)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  borderRadius: 10,
  padding: "10px 12px",
};

const statLabelStyle = {
  fontSize: 9.5,
  fontWeight: 700,
  color: "#64748b",
  letterSpacing: 0.5,
};

const statValStyle = {
  fontSize: 16,
  fontWeight: 800,
  color: "#f8fafc",
  marginTop: 3,
};

const sectionBoxStyle = {
  background: "rgba(15, 23, 42, 0.6)",
  border: "1px solid rgba(255, 255, 255, 0.07)",
  borderRadius: 12,
  padding: 16,
};

const sectionTitleStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: "#e2e8f0",
  margin: 0,
};

const selectStyle = {
  flex: 1,
  background: "#080c14",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  color: "#f8fafc",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
  outline: "none",
};

const btnApplyTargetStyle = {
  background: "linear-gradient(135deg, #ff0071, #d90368)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "6px 14px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const thStyle = {
  padding: "8px 10px",
  fontWeight: 700,
  fontSize: 11,
};

const tdStyle = {
  padding: "8px 10px",
  color: "#e2e8f0",
};

const typeBadgeStyle = (type) => ({
  background: type === "numerical" ? "rgba(6,182,212,0.15)" : "rgba(168,85,247,0.15)",
  color: type === "numerical" ? "#67e8f9" : "#d8b4fe",
  padding: "2px 6px",
  borderRadius: 4,
  fontSize: 9.5,
  fontWeight: 700,
});

const targetBadgeStyle = {
  background: "rgba(255, 0, 113, 0.2)",
  color: "#ff85be",
  fontSize: 9,
  padding: "1px 5px",
  borderRadius: 4,
  marginLeft: 6,
  fontWeight: 700,
};

const errorBannerStyle = {
  background: "rgba(239, 68, 68, 0.1)",
  border: "1px solid rgba(239, 68, 68, 0.3)",
  color: "#fca5a5",
  padding: "10px 14px",
  borderRadius: 8,
  fontSize: 12,
};
