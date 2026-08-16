import { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer, ScatterChart, Scatter, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell, ReferenceLine
} from "recharts";
import api from "../api/axios";

export default function ChartPanel({ pipelineId, selectedNodeId, isDark = true }) {
  const [chartType, setChartType] = useState("auto");
  const [xAxis, setXAxis] = useState("");
  const [yAxis, setYAxis] = useState("");
  const [histCol, setHistCol] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [autoUpdate, setAutoUpdate] = useState(true);

  const fetchChartData = async () => {
    if (!pipelineId || !selectedNodeId) {
      setData(null);
      setErrorMsg("");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const url = `/pipelines/${pipelineId}/nodes/${selectedNodeId}/preview/?page=1&page_size=250`;
      const { data: res } = await api.get(url);

      if (res && (Array.isArray(res.rows) || res.metrics || res.confusion_matrix || res.plots)) {
        setData(res);
        if (res.columns && res.columns.length > 0) {
          const numCols = res.columns.filter((col) => res.column_types?.[col] === "numerical");
          const defaultX = numCols[0] || res.columns[0] || "";
          const defaultY = numCols[1] || numCols[0] || res.columns[1] || res.columns[0] || "";

          setXAxis((prev) => (res.columns.includes(prev) ? prev : defaultX));
          setYAxis((prev) => (res.columns.includes(prev) ? prev : defaultY));
          setHistCol((prev) => (numCols.includes(prev) ? prev : defaultX));
        }

        // Auto select tab based on content
        if (res.metrics || res.confusion_matrix || res.accuracy !== undefined || res.r2 !== undefined) {
          if (chartType === "auto") setChartType("metrics");
        } else if (chartType === "auto") {
          setChartType("scatter");
        }
      } else {
        setData(null);
        setErrorMsg(res?.error || "No data returned for this node.");
      }
    } catch (err) {
      setData(null);
      if (err.response?.status === 404) {
        setErrorMsg("Node has not produced outputs yet. Run this block or the pipeline first.");
      } else {
        setErrorMsg(err.response?.data?.error || "Unable to fetch data for chart generation.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoUpdate && selectedNodeId) {
      fetchChartData();
    }
  }, [pipelineId, selectedNodeId, autoUpdate]);

  const columns = data?.columns || [];
  const rows = data?.rows || [];
  const columnTypes = data?.column_types || {};
  const metrics = data?.metrics || {};
  const plots = data?.plots || {};
  const confusionMatrix = data?.confusion_matrix || metrics?.confusion_matrix || plots?.confusion_matrix;
  const classificationReport = data?.classification_report || metrics?.classification_report;
  const accuracy = data?.accuracy ?? metrics?.accuracy;
  const f1 = data?.f1 ?? metrics?.f1;
  const precision = data?.precision ?? metrics?.precision;
  const recall = data?.recall ?? metrics?.recall;
  const r2 = data?.r2 ?? metrics?.r2;
  const rmse = data?.rmse ?? metrics?.rmse;
  const mse = data?.mse ?? metrics?.mse;
  const mae = data?.mae ?? metrics?.mae;
  const mape = data?.mape ?? metrics?.mape;
  const explainedVariance = data?.explained_variance ?? metrics?.explained_variance;

  const isRegression = metrics?.task_type === 'regression' || (r2 !== undefined && accuracy === undefined) || (mse !== undefined && accuracy === undefined);
  const isClassification = metrics?.task_type === 'classification' || accuracy !== undefined || f1 !== undefined || Boolean(confusionMatrix) || Boolean(classificationReport);
  const hasMetrics = isRegression || isClassification;

  const numericCols = useMemo(() => {
    return columns.filter((col) => {
      const type = columnTypes[col];
      if (type === "numerical") return true;
      if (rows.length > 0 && typeof rows[0][col] === "number") return true;
      return false;
    });
  }, [columns, columnTypes, rows]);

  // Chart data for 2D plots
  const chartData = useMemo(() => {
    if (!rows.length || !xAxis) return [];
    return rows.slice(0, 150).map((r, i) => {
      const xVal = r[xAxis];
      const yVal = r[yAxis];
      const numX = typeof xVal === "number" ? xVal : parseFloat(xVal);
      const numY = typeof yVal === "number" ? yVal : parseFloat(yVal);

      return {
        id: i,
        [xAxis]: isNaN(numX) ? String(xVal ?? "") : numX,
        [yAxis]: isNaN(numY) ? 0 : numY,
        raw_x: String(xVal ?? ""),
        raw_y: String(yVal ?? ""),
      };
    });
  }, [rows, xAxis, yAxis]);

  // Regression scatter (Actual vs Predicted)
  const regressionScatterData = useMemo(() => {
    if (plots?.actual && plots?.predicted) {
      return plots.actual.map((act, i) => ({
        actual: act,
        predicted: plots.predicted[i],
        residual: plots.residuals ? plots.residuals[i] : act - plots.predicted[i],
      }));
    }
    if (rows.length && "actual" in rows[0] && "predictions" in rows[0]) {
      return rows.map((r) => ({
        actual: Number(r.actual) || 0,
        predicted: Number(r.predictions) || 0,
        residual: (Number(r.actual) || 0) - (Number(r.predictions) || 0),
      }));
    }
    return [];
  }, [plots, rows]);

  // Classification report bar chart format
  const classReportData = useMemo(() => {
    if (!classificationReport || typeof classificationReport !== "object") return [];
    const entries = [];
    Object.entries(classificationReport).forEach(([className, vals]) => {
      if (typeof vals === "object" && vals !== null && !["accuracy", "macro avg", "weighted avg"].includes(className)) {
        entries.push({
          class: `Class ${className}`,
          precision: Math.round((vals.precision || 0) * 100),
          recall: Math.round((vals.recall || 0) * 100),
          f1: Math.round((vals["f1-score"] || 0) * 100),
        });
      }
    });
    return entries;
  }, [classificationReport]);

  // Histogram Bins calculation
  const histogramData = useMemo(() => {
    const target = histCol || numericCols[0] || xAxis;
    if (!rows.length || !target) return [];

    const values = rows
      .map((r) => Number(r[target]))
      .filter((v) => !isNaN(v) && isFinite(v));

    if (values.length === 0) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
      return [{ bin: `${min}`, count: values.length }];
    }

    const binCount = 8;
    const step = (max - min) / binCount;
    const bins = Array.from({ length: binCount }, (_, i) => ({
      bin: `${(min + i * step).toFixed(1)}–${(min + (i + 1) * step).toFixed(1)}`,
      count: 0,
    }));

    values.forEach((v) => {
      let idx = Math.floor((v - min) / step);
      if (idx >= binCount) idx = binCount - 1;
      if (idx >= 0) bins[idx].count += 1;
    });

    return bins;
  }, [rows, histCol, numericCols, xAxis]);

  // Correlation matrix
  const correlationMatrix = useMemo(() => {
    if (!rows.length || numericCols.length < 2) return null;
    const targetCols = numericCols.slice(0, 8);

    const matrix = [];
    targetCols.forEach((c1) => {
      const row = { col: c1 };
      targetCols.forEach((c2) => {
        const v1 = rows.map((r) => Number(r[c1]) || 0);
        const v2 = rows.map((r) => Number(r[c2]) || 0);
        const mean1 = v1.reduce((a, b) => a + b, 0) / (v1.length || 1);
        const mean2 = v2.reduce((a, b) => a + b, 0) / (v2.length || 1);
        const num = v1.reduce((acc, val, i) => acc + (val - mean1) * (v2[i] - mean2), 0);
        const den = Math.sqrt(
          v1.reduce((acc, val) => acc + (val - mean1) ** 2, 0) *
          v2.reduce((acc, val) => acc + (val - mean2) ** 2, 0)
        );
        row[c2] = den !== 0 ? Math.round((num / den) * 100) / 100 : 1;
      });
      matrix.push(row);
    });

    return { cols: targetCols, matrix };
  }, [rows, numericCols]);

  if (!selectedNodeId) {
    return (
      <div style={{ padding: "36px 16px", textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
        <h4 style={{ fontSize: 13.5, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>
          No Node Selected
        </h4>
        <p style={{ fontSize: 11.5, color: "#64748b", maxWidth: 280, margin: "0 auto", lineHeight: 1.5 }}>
          Click any block on the canvas to inspect its training metrics, distributions, or correlation heatmaps.
        </p>
      </div>
    );
  }

  const activeTab = chartType === "auto" ? (hasMetrics ? "metrics" : "scatter") : chartType;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12, color: "#f1f5f9", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>📈</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#f8fafc" }}>Interactive EDA & Metrics</span>
        </div>
        <button
          onClick={fetchChartData}
          disabled={loading}
          style={{
            background: "rgba(255, 0, 113, 0.12)",
            color: "#ff85be",
            border: "1px solid rgba(255, 0, 113, 0.35)",
            padding: "4px 10px",
            borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {loading ? "⏳ Loading…" : "🔄 Refresh"}
        </button>
      </div>

      {/* Chart Selector Pills */}
      <div style={{ display: "grid", gridTemplateColumns: hasMetrics ? "repeat(3, 1fr)" : "repeat(3, 1fr)", gap: 6 }}>
        {hasMetrics && (
          <button
            onClick={() => setChartType("metrics")}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              textAlign: "center",
              background: activeTab === "metrics" ? "linear-gradient(135deg, rgba(255,0,113,0.3), rgba(139,92,246,0.3))" : "rgba(255, 255, 255, 0.03)",
              border: activeTab === "metrics" ? "1px solid #ff0071" : "1px solid rgba(255, 255, 255, 0.08)",
              color: activeTab === "metrics" ? "#ff85be" : "#94a3b8",
            }}
          >
            🎯 Model Metrics
          </button>
        )}
        {[
          { id: "scatter", label: "Scatter Plot" },
          { id: "histogram", label: "Distribution" },
          { id: "line", label: "Line Chart" },
          { id: "bar", label: "Bar Chart" },
          { id: "heatmap", label: "Heatmap" },
        ].map((type) => (
          <button
            key={type.id}
            onClick={() => setChartType(type.id)}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "center",
              background: activeTab === type.id ? "rgba(255, 0, 113, 0.2)" : "rgba(255, 255, 255, 0.03)",
              border: activeTab === type.id ? "1px solid #ff0071" : "1px solid rgba(255, 255, 255, 0.08)",
              color: activeTab === type.id ? "#ff85be" : "#94a3b8",
            }}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Dynamic Axis Filter Controls */}
      {columns.length > 0 && ["scatter", "line", "bar", "histogram"].includes(activeTab) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(10, 15, 26, 0.6)", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
          {["scatter", "line", "bar"].includes(activeTab) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#64748b", marginBottom: 4, letterSpacing: 0.3 }}>
                  X AXIS
                </label>
                <select value={xAxis} onChange={(e) => setXAxis(e.target.value)} style={selectStyle}>
                  {columns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#64748b", marginBottom: 4, letterSpacing: 0.3 }}>
                  Y AXIS
                </label>
                <select value={yAxis} onChange={(e) => setYAxis(e.target.value)} style={selectStyle}>
                  {columns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeTab === "histogram" && (
            <div>
              <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#64748b", marginBottom: 4, letterSpacing: 0.3 }}>
                TARGET FEATURE FOR DISTRIBUTION
              </label>
              <select value={histCol} onChange={(e) => setHistCol(e.target.value)} style={selectStyle}>
                {(numericCols.length ? numericCols : columns).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Main Visual Render Area */}
      <div style={{
        width: "100%",
        minHeight: 260,
        background: "rgba(10, 15, 26, 0.95)",
        borderRadius: 10,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        padding: 12,
        display: "flex",
        flexDirection: "column",
      }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
            <div style={{ fontSize: 24, marginBottom: 8, animation: "pulse-pink 1.5s infinite" }}>⏳</div>
            <span>Fetching data and generating visualizations…</span>
          </div>
        )}

        {!loading && errorMsg && (
          <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
            <div style={{ fontSize: 12.5, color: "#fca5a5", marginBottom: 4 }}>{errorMsg}</div>
            <div style={{ fontSize: 11, color: "#475569" }}>Execute this block or the full DAG to inspect outputs.</div>
          </div>
        )}

        {!loading && !errorMsg && (
          <div>
            {/* 🎯 MODEL METRICS TAB */}
            {activeTab === "metrics" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Metric Summary Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "rgba(255, 255, 255, 0.03)", borderRadius: 6, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isRegression ? "#86efac" : "#ff85be" }}>
                    {isRegression ? "📈 Regression Model Performance" : "🎯 Classification Model Performance"}
                  </span>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: isRegression ? "rgba(34, 197, 94, 0.15)" : "rgba(255, 0, 113, 0.15)", color: isRegression ? "#86efac" : "#ff85be", fontWeight: 700 }}>
                    {isRegression ? "REGRESSION" : "CLASSIFICATION"}
                  </span>
                </div>

                {/* Metric Summary Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {/* Classification Metrics */}
                  {isClassification && (
                    <>
                      {accuracy !== undefined && (
                        <div style={metricCardStyle}>
                          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>ACCURACY</span>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#86efac" }}>
                            {(accuracy * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                      {f1 !== undefined && (
                        <div style={metricCardStyle}>
                          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>F1 SCORE</span>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#ff85be" }}>
                            {typeof f1 === "number" ? f1.toFixed(3) : f1}
                          </span>
                        </div>
                      )}
                      {precision !== undefined && (
                        <div style={metricCardStyle}>
                          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>PRECISION</span>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#06b6d4" }}>
                            {typeof precision === "number" ? precision.toFixed(3) : precision}
                          </span>
                        </div>
                      )}
                      {recall !== undefined && (
                        <div style={metricCardStyle}>
                          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>RECALL</span>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#a855f7" }}>
                            {typeof recall === "number" ? recall.toFixed(3) : recall}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Regression Metrics */}
                  {isRegression && (
                    <>
                      {r2 !== undefined && (
                        <div style={metricCardStyle}>
                          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>R² SCORE</span>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#86efac" }}>
                            {typeof r2 === "number" ? r2.toFixed(4) : r2}
                          </span>
                        </div>
                      )}
                      {rmse !== undefined && (
                        <div style={metricCardStyle}>
                          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>RMSE (ROOT MSE)</span>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#38bdf8" }}>
                            {typeof rmse === "number" ? rmse.toFixed(4) : rmse}
                          </span>
                        </div>
                      )}
                      {mae !== undefined && (
                        <div style={metricCardStyle}>
                          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>MAE (MEAN ABS ERROR)</span>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#f59e0b" }}>
                            {typeof mae === "number" ? mae.toFixed(4) : mae}
                          </span>
                        </div>
                      )}
                      {mse !== undefined && (
                        <div style={metricCardStyle}>
                          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>MSE (MEAN SQ ERROR)</span>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#fca5a5" }}>
                            {typeof mse === "number" ? mse.toFixed(4) : mse}
                          </span>
                        </div>
                      )}
                      {mape !== undefined && mape > 0 && (
                        <div style={metricCardStyle}>
                          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>MAPE</span>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#c084fc" }}>
                            {typeof mape === "number" ? `${mape.toFixed(2)}%` : mape}
                          </span>
                        </div>
                      )}
                      {explainedVariance !== undefined && (
                        <div style={metricCardStyle}>
                          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>EXPLAINED VARIANCE</span>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#a7f3d0" }}>
                            {typeof explainedVariance === "number" ? explainedVariance.toFixed(4) : explainedVariance}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Confusion Matrix Visualizer */}
                {isClassification && confusionMatrix && Array.isArray(confusionMatrix) && (
                  <div style={{ background: "#080c14", padding: 10, borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#ff85be", marginBottom: 8 }}>
                      🎯 Confusion Matrix
                    </div>
                    <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", textAlign: "center" }}>
                      <thead>
                        <tr>
                          <th style={{ color: "#64748b", fontSize: 9.5, padding: 4 }}>Actual \ Pred</th>
                          {confusionMatrix[0].map((_, i) => (
                            <th key={i} style={{ color: "#94a3b8", padding: 4 }}>Class {i}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {confusionMatrix.map((row, rIdx) => (
                          <tr key={rIdx}>
                            <td style={{ color: "#94a3b8", fontWeight: 700, padding: 4 }}>Class {rIdx}</td>
                            {row.map((val, cIdx) => {
                              const isDiagonal = rIdx === cIdx;
                              return (
                                <td
                                  key={cIdx}
                                  style={{
                                    padding: "8px 6px",
                                    fontWeight: 700,
                                    background: isDiagonal ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.18)",
                                    color: isDiagonal ? "#86efac" : "#fca5a5",
                                    border: "1px solid rgba(255, 255, 255, 0.06)",
                                    borderRadius: 4,
                                  }}
                                >
                                  {val}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Classification Report Bar Chart */}
                {isClassification && classReportData.length > 0 && (
                  <div style={{ height: 190, marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#06b6d4", marginBottom: 6 }}>
                      📊 Per-Class Precision / Recall / F1 (%)
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={classReportData} margin={{ top: 5, right: 10, bottom: 20, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
                        <XAxis dataKey="class" stroke="#64748b" fontSize={10} />
                        <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                        <Tooltip contentStyle={{ background: "#111726", border: "1px solid #ff0071", borderRadius: 8, fontSize: 11 }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="precision" fill="#06b6d4" name="Precision" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="recall" fill="#a855f7" name="Recall" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="f1" fill="#ff0071" name="F1 Score" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Regression Actual vs Predicted Scatter */}
                {isRegression && regressionScatterData.length > 0 && (
                  <div style={{ height: 210, marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#86efac", marginBottom: 6 }}>
                      📈 Actual vs Predicted Values (Regression Fit)
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <ScatterChart margin={{ top: 5, right: 10, bottom: 20, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
                        <XAxis dataKey="actual" name="Actual" stroke="#64748b" fontSize={10} />
                        <YAxis dataKey="predicted" name="Predicted" stroke="#64748b" fontSize={10} />
                        <Tooltip contentStyle={{ background: "#111726", border: "1px solid #22c55e", borderRadius: 8, fontSize: 11 }} />
                        <Scatter data={regressionScatterData.slice(0, 100)} fill="#22c55e" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* SCATTER PLOT */}
            {activeTab === "scatter" && (
              <ResponsiveContainer width="100%" height={240}>
                <ScatterChart margin={{ top: 10, right: 15, bottom: 20, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
                  <XAxis dataKey={xAxis} name={xAxis} stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis dataKey={yAxis} name={yAxis} stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#111726", border: "1px solid #ff0071", borderRadius: 8, fontSize: 11, color: "#f8fafc" }} />
                  <Scatter data={chartData} fill="#ff0071" />
                </ScatterChart>
              </ResponsiveContainer>
            )}

            {/* HISTOGRAM DISTRIBUTION */}
            {activeTab === "histogram" && (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={histogramData} margin={{ top: 10, right: 15, bottom: 25, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
                  <XAxis dataKey="bin" stroke="#64748b" fontSize={9.5} interval={0} angle={-20} textAnchor="end" />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#111726", border: "1px solid #8b5cf6", borderRadius: 8, fontSize: 11, color: "#f8fafc" }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* LINE CHART */}
            {activeTab === "line" && (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 10, right: 15, bottom: 20, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
                  <XAxis dataKey={xAxis} stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#111726", border: "1px solid #06b6d4", borderRadius: 8, fontSize: 11, color: "#f8fafc" }} />
                  <Line type="monotone" dataKey={yAxis} stroke="#06b6d4" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}

            {/* BAR CHART */}
            {activeTab === "bar" && (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData.slice(0, 30)} margin={{ top: 10, right: 15, bottom: 20, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
                  <XAxis dataKey={xAxis} stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#111726", border: "1px solid #ff0071", borderRadius: 8, fontSize: 11, color: "#f8fafc" }} />
                  <Bar dataKey={yAxis} fill="#ff0071" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* CORRELATION HEATMAP */}
            {activeTab === "heatmap" && correlationMatrix && (
              <div style={{ overflowX: "auto", maxHeight: 230, padding: 4 }}>
                <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse", textAlign: "center" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: 4 }}></th>
                      {correlationMatrix.cols.map((col) => (
                        <th key={col} style={{ padding: 4, color: "#ff85be", fontWeight: 700 }}>
                          {col.length > 8 ? col.slice(0, 7) + "…" : col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {correlationMatrix.matrix.map((row) => (
                      <tr key={row.col}>
                        <td style={{ fontWeight: 700, padding: 4, color: "#cbd5e1", textAlign: "left", whiteSpace: "nowrap" }}>
                          {row.col.length > 8 ? row.col.slice(0, 7) + "…" : row.col}
                        </td>
                        {correlationMatrix.cols.map((c2) => {
                          const val = row[c2];
                          const bg = val > 0
                            ? `rgba(255, 0, 113, ${Math.min(Math.abs(val), 0.9)})`
                            : `rgba(99, 102, 241, ${Math.min(Math.abs(val), 0.9)})`;
                          return (
                            <td key={c2} style={{ background: bg, color: "#fff", padding: "4px 2px", borderRadius: 3, fontSize: 9.5 }}>
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const selectStyle = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid rgba(255, 255, 255, 0.1)",
  background: "#111726",
  color: "#f1f5f9",
  fontSize: 11.5,
  outline: "none",
  fontFamily: "Inter, sans-serif",
};

const metricCardStyle = {
  background: "#080c14",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: 8,
  padding: "8px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};
