import { useState, useEffect } from "react";
import api from "../api/axios";

export default function DatasetProfileModal({ isOpen, onClose, pipelineId, datasetId, onApplyTarget }) {
  const [activeTab, setActiveTab] = useState("overview"); // 'overview', 'histograms', 'correlation', 'sample'
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [edaData, setEdaData] = useState(null);
  const [error, setError] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("");
  const [selectedHistCol, setSelectedHistCol] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (!pipelineId && !datasetId) return;

    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        // Try fetching rich pipeline-level EDA first if pipelineId is available
        if (pipelineId) {
          try {
            const { data: eda } = await api.get(`/pipelines/${pipelineId}/eda/`);
            setEdaData(eda);
            if (eda.histograms && Object.keys(eda.histograms).length > 0) {
              setSelectedHistCol(Object.keys(eda.histograms)[0]);
            }
          } catch (e) {
            console.warn("Pipeline EDA not available yet, falling back to dataset profile", e);
          }
        }

        // Fetch dataset profile if datasetId available
        if (datasetId) {
          const { data } = await api.get(`/datasets/${datasetId}/profile/`);
          setProfile(data);
          if (data.target_suggestions && data.target_suggestions.length > 0) {
            setSelectedTarget(data.target_suggestions[0].column);
          }
        }
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to generate dataset profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, pipelineId, datasetId]);

  if (!isOpen) return null;

  const getScoreColor = (score) => {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
  };

  const getCorrColor = (val) => {
    if (val === null || val === undefined) return "transparent";
    if (val > 0.7) return "rgba(239, 68, 68, 0.4)";
    if (val > 0.3) return "rgba(249, 115, 22, 0.3)";
    if (val < -0.7) return "rgba(59, 130, 246, 0.4)";
    if (val < -0.3) return "rgba(6, 182, 212, 0.3)";
    return "rgba(255, 255, 255, 0.04)";
  };

  const summary = edaData?.summary || {
    rows: profile?.total_rows,
    columns: profile?.total_columns,
    numeric_columns: profile?.numerical_columns_count,
    missing_total: profile?.total_missing_values,
    missing_pct: profile?.missing_percentage,
    duplicates: profile?.duplicate_rows,
  };

  const columnsList = edaData?.columns || profile?.columns?.map((c) => {
    const cp = profile.column_profiles?.[c] || {};
    return {
      name: c,
      dtype: cp.type || "string",
      kind: cp.type === "integer" || cp.type === "float" ? "numeric" : "categorical",
      missing: cp.null_count || 0,
      missing_pct: cp.null_pct || 0,
      unique: cp.unique_count || 0,
      mean: cp.mean,
      min: cp.min,
      max: cp.max,
      outlier_count: cp.outliers_count,
    };
  }) || [];

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        {/* Modal Header */}
        <div style={modalHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>📊</span>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                Automated EDA & Dataset Profiling
              </h2>
              <p style={{ fontSize: 11, color: "#64748b", margin: "2px 0 0" }}>
                Interactive statistical analysis, distribution curves, and correlation matrix
              </p>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: 8, padding: "8px 20px", background: "rgba(15, 23, 42, 0.6)", borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
          {[
            { id: "overview", label: "📋 Overview & Quality" },
            { id: "histograms", label: "📈 Distributions & Histograms" },
            { id: "correlation", label: "🔥 Correlation Heatmap" },
            { id: "sample", label: "👁️ Sample Preview" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: activeTab === tab.id ? 700 : 500,
                background: activeTab === tab.id ? "rgba(255, 0, 113, 0.15)" : "transparent",
                color: activeTab === tab.id ? "#ff85be" : "#94a3b8",
                border: activeTab === tab.id ? "1px solid rgba(255, 0, 113, 0.3)" : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div style={{ padding: 20, overflowY: "auto", maxHeight: "calc(85vh - 150px)" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
              <div style={{ fontSize: 28, animation: "pulse-pink 1.5s infinite" }}>⚡</div>
              <div style={{ marginTop: 8, fontWeight: 600 }}>Calculating dataset statistics and distributions…</div>
            </div>
          )}

          {error && (
            <div style={errorBannerStyle}>
              ⚠️ {error}
            </div>
          )}

          {!loading && !error && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Top Metrics Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
                <div style={statCardStyle}>
                  <div style={statLabelStyle}>ROWS</div>
                  <div style={statValStyle}>{summary.rows?.toLocaleString() || "—"}</div>
                </div>
                <div style={statCardStyle}>
                  <div style={statLabelStyle}>COLUMNS</div>
                  <div style={statValStyle}>{summary.columns || "—"}</div>
                </div>
                <div style={statCardStyle}>
                  <div style={statLabelStyle}>NUMERICAL</div>
                  <div style={{ ...statValStyle, color: "#06b6d4" }}>{summary.numeric_columns || "—"}</div>
                </div>
                <div style={statCardStyle}>
                  <div style={statLabelStyle}>MISSING VALUES</div>
                  <div style={{ ...statValStyle, color: summary.missing_total > 0 ? "#f59e0b" : "#22c55e" }}>
                    {summary.missing_total ?? 0} ({summary.missing_pct ?? 0}%)
                  </div>
                </div>
                <div style={statCardStyle}>
                  <div style={statLabelStyle}>DUPLICATES</div>
                  <div style={{ ...statValStyle, color: summary.duplicates > 0 ? "#ef4444" : "#22c55e" }}>
                    {summary.duplicates ?? 0}
                  </div>
                </div>
                {profile?.data_quality_score !== undefined && (
                  <div style={statCardStyle}>
                    <div style={statLabelStyle}>DATA QUALITY</div>
                    <div style={{ ...statValStyle, color: getScoreColor(profile.data_quality_score) }}>
                      {profile.data_quality_score}/100
                    </div>
                  </div>
                )}
              </div>

              {/* TAB 1: OVERVIEW & QUALITY */}
              {activeTab === "overview" && (
                <>
                  {/* Task Detection & Target Suggestions */}
                  {profile?.detected_task && (
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

                        {profile.columns && (
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
                        )}
                      </div>
                    </div>
                  )}

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
                            <th style={thStyle}>Mean / Min-Max</th>
                          </tr>
                        </thead>
                        <tbody>
                          {columnsList.map((col) => (
                            <tr key={col.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                              <td style={tdStyle}>
                                <strong>{col.name}</strong>
                                {col.name === selectedTarget && <span style={targetBadgeStyle}>TARGET</span>}
                              </td>
                              <td style={tdStyle}>
                                <span style={typeBadgeStyle(col.dtype)}>{col.dtype?.toUpperCase()}</span>
                              </td>
                              <td style={{ ...tdStyle, color: col.missing > 0 ? "#f59e0b" : "#86efac" }}>
                                {col.missing} ({col.missing_pct}%)
                              </td>
                              <td style={tdStyle}>{col.unique}</td>
                              <td style={{ ...tdStyle, color: col.outlier_count > 0 ? "#ef4444" : "#64748b" }}>
                                {col.outlier_count || "0"}
                              </td>
                              <td style={{ ...tdStyle, color: "#94a3b8" }}>
                                {col.mean !== undefined && col.mean !== null
                                  ? `Mean: ${typeof col.mean === "number" ? col.mean.toFixed(2) : col.mean} [${col.min} - ${col.max}]`
                                  : "Categorical / Text"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: HISTOGRAMS */}
              {activeTab === "histograms" && (
                <div style={sectionBoxStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <h3 style={sectionTitleStyle}>📈 Numeric Feature Distributions</h3>
                    {edaData?.histograms && Object.keys(edaData.histograms).length > 0 && (
                      <select
                        value={selectedHistCol}
                        onChange={(e) => setSelectedHistCol(e.target.value)}
                        style={selectStyle}
                      >
                        {Object.keys(edaData.histograms).map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {edaData?.histograms && selectedHistCol && edaData.histograms[selectedHistCol] ? (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#ff85be", marginBottom: 10 }}>
                        Distribution: {selectedHistCol}
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-end", height: 160, gap: 4, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                        {(() => {
                          const hist = edaData.histograms[selectedHistCol];
                          const maxCount = Math.max(...hist.counts, 1);
                          return hist.counts.map((count, idx) => {
                            const heightPct = Math.max((count / maxCount) * 100, 4);
                            const binStart = hist.bins[idx];
                            const binEnd = hist.bins[idx + 1];
                            return (
                              <div
                                key={idx}
                                style={{
                                  flex: 1,
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  height: "100%",
                                  justifyContent: "flex-end",
                                }}
                                title={`Range: ${typeof binStart === "number" ? binStart.toFixed(1) : binStart} - ${typeof binEnd === "number" ? binEnd.toFixed(1) : binEnd} | Count: ${count}`}
                              >
                                <div
                                  style={{
                                    width: "100%",
                                    height: `${heightPct}%`,
                                    background: "linear-gradient(180deg, #ff0071 0%, rgba(255, 0, 113, 0.4) 100%)",
                                    borderRadius: "3px 3px 0 0",
                                    transition: "height 0.3s ease",
                                  }}
                                />
                              </div>
                            );
                          });
                        })()}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "#64748b" }}>
                        <span>Min: {edaData.histograms[selectedHistCol].bins[0]}</span>
                        <span>Max: {edaData.histograms[selectedHistCol].bins[edaData.histograms[selectedHistCol].bins.length - 1]}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: "#64748b", padding: "20px 0", textAlign: "center" }}>
                      No histogram data available for numeric features. Run the pipeline to populate.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CORRELATION MATRIX */}
              {activeTab === "correlation" && (
                <div style={sectionBoxStyle}>
                  <h3 style={sectionTitleStyle}>🔥 Pearson Correlation Matrix</h3>
                  {edaData?.correlation?.columns && edaData.correlation.columns.length > 1 ? (
                    <div style={{ overflowX: "auto", marginTop: 10 }}>
                      <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Feature</th>
                            {edaData.correlation.columns.map((c) => (
                              <th key={c} style={{ ...thStyle, textAlign: "center", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis" }}>
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {edaData.correlation.matrix.map((row, rowIdx) => (
                            <tr key={rowIdx}>
                              <td style={{ ...tdStyle, fontWeight: 700, color: "#94a3b8" }}>
                                {edaData.correlation.columns[rowIdx]}
                              </td>
                              {row.map((val, colIdx) => (
                                <td
                                  key={colIdx}
                                  style={{
                                    ...tdStyle,
                                    textAlign: "center",
                                    background: getCorrColor(val),
                                    fontWeight: rowIdx === colIdx ? 700 : 500,
                                    color: val === 1.0 ? "#fff" : Math.abs(val) > 0.5 ? "#f8fafc" : "#94a3b8",
                                  }}
                                  title={`Corr(${edaData.correlation.columns[rowIdx]}, ${edaData.correlation.columns[colIdx]}): ${val}`}
                                >
                                  {val !== null ? (typeof val === "number" ? val.toFixed(2) : val) : "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ color: "#64748b", padding: "20px 0", textAlign: "center" }}>
                      At least 2 numerical features are required to compute a correlation heatmap.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: SAMPLE PREVIEW */}
              {activeTab === "sample" && (
                <div style={sectionBoxStyle}>
                  <h3 style={sectionTitleStyle}>👁️ First 10 Sample Rows</h3>
                  {edaData?.sample && edaData.sample.length > 0 ? (
                    <div style={{ overflowX: "auto", marginTop: 10 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: "rgba(255,255,255,0.03)", color: "#94a3b8" }}>
                            {Object.keys(edaData.sample[0]).map((key) => (
                              <th key={key} style={thStyle}>{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {edaData.sample.map((row, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                              {Object.values(row).map((v, cIdx) => (
                                <td key={cIdx} style={{ ...tdStyle, color: "#e2e8f0" }}>
                                  {v !== null && v !== undefined ? String(v) : "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ color: "#64748b", padding: "20px 0", textAlign: "center" }}>
                      No sample records available. Run a Load Dataset block first.
                    </div>
                  )}
                </div>
              )}
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
