import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ResponsiveContainer, ScatterChart, Scatter, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell, ReferenceLine, Area, AreaChart
} from "recharts";
import api from "../api/axios";

// ─── Gradient definitions injected once ────────────────────────────────────
const GRADIENT_SVG = (
  <svg width="0" height="0" style={{ position: "absolute" }}>
    <defs>
      <linearGradient id="barGrad1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ff0071" stopOpacity={0.95} />
        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.7} />
      </linearGradient>
      <linearGradient id="barGrad2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
      </linearGradient>
      <linearGradient id="barGrad3" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.9} />
        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6} />
      </linearGradient>
      <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="scatterGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ff0071" />
        <stop offset="100%" stopColor="#8b5cf6" />
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  </svg>
);

// ─── Custom Tooltip ─────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, borderColor = "#ff0071" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(8,12,20,0.96)",
      border: `1px solid ${borderColor}`,
      borderRadius: 10,
      padding: "8px 14px",
      fontSize: 11.5,
      color: "#f1f5f9",
      boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 12px ${borderColor}33`,
      backdropFilter: "blur(10px)",
    }}>
      {label && <div style={{ color: "#94a3b8", marginBottom: 4, fontWeight: 600 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "#f1f5f9", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0, display: "inline-block" }} />
          <span style={{ color: "#94a3b8" }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{typeof p.value === "number" ? p.value.toFixed(3) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Metric Card ─────────────────────────────────────────────────────────────
const MetricCard = ({ label, value, color, icon, subtitle }) => (
  <div style={{
    background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
    border: `1px solid ${color}33`,
    borderRadius: 12,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    position: "relative",
    overflow: "hidden",
    boxShadow: `0 2px 20px ${color}18, inset 0 1px 0 rgba(255,255,255,0.04)`,
    backdropFilter: "blur(8px)",
    transition: "transform 0.2s, box-shadow 0.2s",
  }}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 32px ${color}30, inset 0 1px 0 rgba(255,255,255,0.06)` }}
    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 2px 20px ${color}18, inset 0 1px 0 rgba(255,255,255,0.04)` }}
  >
    {/* Glowing top border */}
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.8 }} />
    {/* Background glow blob */}
    <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: color, opacity: 0.06, filter: "blur(20px)", pointerEvents: "none" }} />

    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.2, color: "#64748b", textTransform: "uppercase" }}>{label}</span>
    </div>
    <span style={{
      fontSize: 26,
      fontWeight: 900,
      color,
      lineHeight: 1,
      fontVariantNumeric: "tabular-nums",
      textShadow: `0 0 20px ${color}60`,
    }}>
      {value}
    </span>
    {subtitle && <span style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{subtitle}</span>}
  </div>
);

// ─── Error State ─────────────────────────────────────────────────────────────
const ErrorState = ({ message, hint }) => (
  <div style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
    textAlign: "center",
    gap: 12,
  }}>
    <div style={{
      width: 64,
      height: 64,
      borderRadius: "50%",
      background: "rgba(239,68,68,0.1)",
      border: "1.5px solid rgba(239,68,68,0.3)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 28,
      boxShadow: "0 0 30px rgba(239,68,68,0.15)",
    }}>⚠️</div>
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#fca5a5", marginBottom: 6 }}>{message}</div>
      {hint && <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.6, maxWidth: 300 }}>{hint}</div>}
    </div>
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 14px",
      borderRadius: 20,
      background: "rgba(239,68,68,0.08)",
      border: "1px solid rgba(239,68,68,0.2)",
      fontSize: 11,
      color: "#f87171",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
      Execute the block or full pipeline first
    </div>
  </div>
);

// ─── Empty State ─────────────────────────────────────────────────────────────
const EmptyState = () => (
  <div style={{ padding: "36px 16px", textAlign: "center", color: "#64748b", fontFamily: "Inter, sans-serif" }}>
    <div style={{
      width: 72,
      height: 72,
      borderRadius: "50%",
      background: "rgba(255,0,113,0.06)",
      border: "1.5px solid rgba(255,0,113,0.15)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 30,
      margin: "0 auto 16px",
      boxShadow: "0 0 40px rgba(255,0,113,0.08)",
    }}>📊</div>
    <h4 style={{ fontSize: 13.5, fontWeight: 700, color: "#94a3b8", marginBottom: 8, margin: "0 0 8px" }}>
      No Node Selected
    </h4>
    <p style={{ fontSize: 11.5, color: "#475569", maxWidth: 260, margin: "0 auto", lineHeight: 1.6 }}>
      Click any block on the canvas to visualize its data, metrics, and distributions.
    </p>
  </div>
);

// ─── Tab Button ───────────────────────────────────────────────────────────────
const TabBtn = ({ id, label, icon, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    style={{
      padding: "6px 10px",
      borderRadius: 8,
      fontSize: 10.5,
      fontWeight: 700,
      cursor: "pointer",
      textAlign: "center",
      display: "flex",
      alignItems: "center",
      gap: 4,
      justifyContent: "center",
      transition: "all 0.18s",
      background: active
        ? "linear-gradient(135deg, rgba(255,0,113,0.28), rgba(139,92,246,0.28))"
        : "rgba(255,255,255,0.03)",
      border: active ? "1px solid rgba(255,0,113,0.7)" : "1px solid rgba(255,255,255,0.07)",
      color: active ? "#ff85be" : "#64748b",
      boxShadow: active ? "0 0 12px rgba(255,0,113,0.18)" : "none",
    }}
  >
    <span>{icon}</span>
    <span>{label}</span>
  </button>
);

// ─── Download helpers ─────────────────────────────────────────────────────────
function downloadSVG(svgRef, filename = "chart.svg") {
  try {
    const svg = svgRef.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  } catch {}
}

// ─── Chart container with download ───────────────────────────────────────────
const ChartContainer = ({ title, color = "#ff0071", children, chartRef }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      ref={chartRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "rgba(8,12,20,0.7)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.07)",
        padding: "14px 14px 10px",
        position: "relative",
        transition: "border-color 0.2s",
        borderColor: hovered ? `${color}44` : "rgba(255,255,255,0.07)",
        boxShadow: hovered ? `0 4px 32px ${color}18` : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 0.3 }}>{title}</span>
        <button
          onClick={() => chartRef && downloadSVG(chartRef, `${title.replace(/\s+/g, "_")}.svg`)}
          style={{
            padding: "3px 8px",
            fontSize: 10,
            borderRadius: 6,
            background: `${color}18`,
            border: `1px solid ${color}40`,
            color,
            cursor: "pointer",
            fontWeight: 600,
            opacity: hovered ? 1 : 0,
            transition: "opacity 0.18s",
          }}
        >
          ⬇ SVG
        </button>
      </div>
      {children}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN CHART PANEL
// ════════════════════════════════════════════════════════════════════════════
export default function ChartPanel({ pipelineId, selectedNodeId, isDark = true }) {
  const [chartType, setChartType] = useState("auto");
  const [xAxis, setXAxis] = useState("");
  const [yAxis, setYAxis] = useState("");
  const [histCol, setHistCol] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [autoUpdate, setAutoUpdate] = useState(true);

  const chartRef1 = useRef(null);
  const chartRef2 = useRef(null);
  const chartRef3 = useRef(null);

  const fetchChartData = useCallback(async () => {
    if (!pipelineId || !selectedNodeId) { setData(null); setErrorMsg(""); return; }
    setLoading(true);
    setErrorMsg("");
    try {
      const url = `/pipelines/${pipelineId}/nodes/${selectedNodeId}/preview/?page=1&page_size=250`;
      const { data: res } = await api.get(url);
      if (res && (Array.isArray(res.rows) || res.metrics || res.confusion_matrix || res.plots)) {
        setData(res);
        if (res.columns?.length > 0) {
          const numCols = res.columns.filter(c => res.column_types?.[c] === "numerical");
          const dX = numCols[0] || res.columns[0] || "";
          const dY = numCols[1] || numCols[0] || res.columns[1] || res.columns[0] || "";
          setXAxis(prev => res.columns.includes(prev) ? prev : dX);
          setYAxis(prev => res.columns.includes(prev) ? prev : dY);
          setHistCol(prev => numCols.includes(prev) ? prev : dX);
        }
        const hasM = res.metrics || res.confusion_matrix || res.accuracy !== undefined || res.r2 !== undefined;
        if (hasM) { if (chartType === "auto") setChartType("metrics"); }
        else if (chartType === "auto") setChartType("scatter");
      } else {
        setData(null);
        setErrorMsg(res?.error || "No data returned for this node.");
      }
    } catch (err) {
      setData(null);
      if (err.response?.status === 404)
        setErrorMsg("Node has not produced outputs yet.");
      else
        setErrorMsg(err.response?.data?.error || "Unable to fetch chart data.");
    } finally {
      setLoading(false);
    }
  }, [pipelineId, selectedNodeId]);

  useEffect(() => {
    if (autoUpdate && selectedNodeId) fetchChartData();
  }, [pipelineId, selectedNodeId, autoUpdate, fetchChartData]);

  // ── Derived data ──────────────────────────────────────────────────────────
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

  const isRegression = metrics?.task_type === "regression" || (r2 !== undefined && accuracy === undefined) || (mse !== undefined && accuracy === undefined);
  const isClassification = metrics?.task_type === "classification" || accuracy !== undefined || f1 !== undefined || Boolean(confusionMatrix) || Boolean(classificationReport);
  const hasMetrics = isRegression || isClassification;

  const numericCols = useMemo(() => columns.filter(col => {
    const t = columnTypes[col];
    if (t === "numerical") return true;
    if (rows.length > 0 && typeof rows[0][col] === "number") return true;
    return false;
  }), [columns, columnTypes, rows]);

  const chartData = useMemo(() => {
    if (!rows.length || !xAxis) return [];
    return rows.slice(0, 150).map((r, i) => {
      const numX = typeof r[xAxis] === "number" ? r[xAxis] : parseFloat(r[xAxis]);
      const numY = typeof r[yAxis] === "number" ? r[yAxis] : parseFloat(r[yAxis]);
      return { id: i, [xAxis]: isNaN(numX) ? String(r[xAxis] ?? "") : numX, [yAxis]: isNaN(numY) ? 0 : numY };
    });
  }, [rows, xAxis, yAxis]);

  const regressionScatterData = useMemo(() => {
    if (plots?.actual && plots?.predicted)
      return plots.actual.map((act, i) => ({ actual: act, predicted: plots.predicted[i], residual: plots.residuals ? plots.residuals[i] : act - plots.predicted[i] }));
    if (rows.length && "actual" in rows[0] && "predictions" in rows[0])
      return rows.map(r => ({ actual: Number(r.actual) || 0, predicted: Number(r.predictions) || 0 }));
    return [];
  }, [plots, rows]);

  const classReportData = useMemo(() => {
    if (!classificationReport || typeof classificationReport !== "object") return [];
    return Object.entries(classificationReport)
      .filter(([k, v]) => typeof v === "object" && v !== null && !["accuracy", "macro avg", "weighted avg"].includes(k))
      .map(([k, v]) => ({
        class: `C${k}`,
        precision: Math.round((v.precision || 0) * 100),
        recall: Math.round((v.recall || 0) * 100),
        f1: Math.round((v["f1-score"] || 0) * 100),
      }));
  }, [classificationReport]);

  const histogramData = useMemo(() => {
    const target = histCol || numericCols[0] || xAxis;
    if (!rows.length || !target) return [];
    const values = rows.map(r => Number(r[target])).filter(v => !isNaN(v) && isFinite(v));
    if (!values.length) return [];
    const min = Math.min(...values), max = Math.max(...values);
    if (min === max) return [{ bin: `${min}`, count: values.length }];
    const binCount = 10;
    const step = (max - min) / binCount;
    const bins = Array.from({ length: binCount }, (_, i) => ({
      bin: `${(min + i * step).toFixed(1)}`,
      count: 0,
    }));
    values.forEach(v => {
      let idx = Math.floor((v - min) / step);
      if (idx >= binCount) idx = binCount - 1;
      if (idx >= 0) bins[idx].count += 1;
    });
    return bins;
  }, [rows, histCol, numericCols, xAxis]);

  const correlationMatrix = useMemo(() => {
    if (!rows.length || numericCols.length < 2) return null;
    const targetCols = numericCols.slice(0, 8);
    const matrix = targetCols.map(c1 => {
      const row = { col: c1 };
      const v1 = rows.map(r => Number(r[c1]) || 0);
      const mean1 = v1.reduce((a, b) => a + b, 0) / (v1.length || 1);
      targetCols.forEach(c2 => {
        const v2 = rows.map(r => Number(r[c2]) || 0);
        const mean2 = v2.reduce((a, b) => a + b, 0) / (v2.length || 1);
        const num = v1.reduce((acc, val, i) => acc + (val - mean1) * (v2[i] - mean2), 0);
        const den = Math.sqrt(v1.reduce((a, v) => a + (v - mean1) ** 2, 0) * v2.reduce((a, v) => a + (v - mean2) ** 2, 0));
        row[c2] = den !== 0 ? Math.round((num / den) * 100) / 100 : 1;
      });
      return row;
    });
    return { cols: targetCols, matrix };
  }, [rows, numericCols]);

  if (!selectedNodeId) return <EmptyState />;

  const activeTab = chartType === "auto" ? (hasMetrics ? "metrics" : "scatter") : chartType;

  const tabs = [
    ...(hasMetrics ? [{ id: "metrics", label: "Metrics", icon: "🎯" }] : []),
    { id: "scatter", label: "Scatter", icon: "⚬" },
    { id: "histogram", label: "Dist", icon: "📊" },
    { id: "line", label: "Line", icon: "📈" },
    { id: "bar", label: "Bar", icon: "▊" },
    { id: "heatmap", label: "Heatmap", icon: "🔥" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12, color: "#f1f5f9", fontFamily: "Inter, sans-serif" }}>
      {GRADIENT_SVG}

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, rgba(255,0,113,0.25), rgba(139,92,246,0.25))",
            border: "1px solid rgba(255,0,113,0.3)",
            fontSize: 14,
          }}>📈</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: "#f8fafc", lineHeight: 1 }}>EDA &amp; Metrics</div>
            <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>Interactive analysis panel</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={() => setAutoUpdate(v => !v)}
            title={autoUpdate ? "Auto-refresh ON" : "Auto-refresh OFF"}
            style={{
              padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer",
              background: autoUpdate ? "rgba(255,0,113,0.1)" : "rgba(255,255,255,0.04)",
              border: autoUpdate ? "1px solid rgba(255,0,113,0.4)" : "1px solid rgba(255,255,255,0.08)",
              color: autoUpdate ? "#ff85be" : "#475569",
            }}
          >
            {autoUpdate ? "⚡ Auto" : "⏸ Paused"}
          </button>
          <button
            onClick={fetchChartData}
            disabled={loading}
            style={{
              background: loading ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg, rgba(255,0,113,0.18), rgba(139,92,246,0.18))",
              color: loading ? "#475569" : "#ff85be",
              border: "1px solid rgba(255,0,113,0.35)",
              padding: "4px 12px",
              borderRadius: 8,
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {loading ? "⏳ Loading…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <TabBtn key={t.id} {...t} active={activeTab === t.id} onClick={setChartType} />
        ))}
      </div>

      {/* ── Axis Controls ── */}
      {columns.length > 0 && ["scatter", "line", "bar", "histogram"].includes(activeTab) && (
        <div style={{
          display: "flex", flexDirection: "column", gap: 8,
          background: "rgba(255,255,255,0.02)",
          padding: "10px 12px", borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.05)",
        }}>
          {["scatter", "line", "bar"].includes(activeTab) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["X AXIS", xAxis, setXAxis], ["Y AXIS", yAxis, setYAxis]].map(([lbl, val, setter]) => (
                <div key={lbl}>
                  <label style={{ display: "block", fontSize: 9.5, fontWeight: 800, color: "#475569", marginBottom: 4, letterSpacing: 1 }}>{lbl}</label>
                  <select value={val} onChange={e => setter(e.target.value)} style={selectStyle}>
                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
          {activeTab === "histogram" && (
            <div>
              <label style={{ display: "block", fontSize: 9.5, fontWeight: 800, color: "#475569", marginBottom: 4, letterSpacing: 1 }}>DISTRIBUTION FEATURE</label>
              <select value={histCol} onChange={e => setHistCol(e.target.value)} style={selectStyle}>
                {(numericCols.length ? numericCols : columns).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── Main Render Area ── */}
      <div style={{
        width: "100%",
        background: "rgba(5,8,16,0.9)",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.07)",
        padding: "14px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 220,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}>

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "50px 20px", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              border: "3px solid rgba(255,0,113,0.15)",
              borderTop: "3px solid #ff0071",
              animation: "spin 0.9s linear infinite",
            }} />
            <div style={{ color: "#475569", fontSize: 12 }}>Fetching data &amp; building charts…</div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error state */}
        {!loading && errorMsg && (
          <ErrorState
            message={errorMsg}
            hint={errorMsg.includes("404") || errorMsg.includes("not produced") ? undefined : "Try refreshing after running the pipeline."}
          />
        )}

        {/* Chart content */}
        {!loading && !errorMsg && (
          <>
            {/* ══ METRICS TAB ══ */}
            {activeTab === "metrics" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Model Type Badge */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 14px",
                  background: isRegression
                    ? "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(16,185,129,0.05))"
                    : "linear-gradient(135deg, rgba(255,0,113,0.1), rgba(139,92,246,0.05))",
                  borderRadius: 10,
                  border: `1px solid ${isRegression ? "rgba(34,197,94,0.25)" : "rgba(255,0,113,0.25)"}`,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isRegression ? "#4ade80" : "#ff85be" }}>
                    {isRegression ? "📈 Regression Model Performance" : "🎯 Classification Model Performance"}
                  </span>
                  <span style={{
                    fontSize: 9.5, padding: "3px 10px", borderRadius: 20, fontWeight: 800,
                    background: isRegression ? "rgba(34,197,94,0.18)" : "rgba(255,0,113,0.18)",
                    color: isRegression ? "#4ade80" : "#ff85be",
                    letterSpacing: 0.8,
                  }}>
                    {isRegression ? "REGRESSION" : "CLASSIFICATION"}
                  </span>
                </div>

                {/* Metric Cards Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {isClassification && <>
                    {accuracy !== undefined && <MetricCard label="Accuracy" value={`${(accuracy * 100).toFixed(1)}%`} color="#4ade80" icon="✓" subtitle="Overall correct predictions" />}
                    {f1 !== undefined && <MetricCard label="F1 Score" value={typeof f1 === "number" ? f1.toFixed(3) : f1} color="#ff85be" icon="⚖" subtitle="Harmonic mean of P&R" />}
                    {precision !== undefined && <MetricCard label="Precision" value={typeof precision === "number" ? precision.toFixed(3) : precision} color="#38bdf8" icon="🎯" subtitle="True positive rate" />}
                    {recall !== undefined && <MetricCard label="Recall" value={typeof recall === "number" ? recall.toFixed(3) : recall} color="#c084fc" icon="🔍" subtitle="Sensitivity" />}
                  </>}
                  {isRegression && <>
                    {r2 !== undefined && <MetricCard label="R² Score" value={typeof r2 === "number" ? r2.toFixed(4) : r2} color="#4ade80" icon="📐" subtitle="Variance explained" />}
                    {rmse !== undefined && <MetricCard label="RMSE" value={typeof rmse === "number" ? rmse.toFixed(4) : rmse} color="#38bdf8" icon="⚡" subtitle="Root mean sq error" />}
                    {mae !== undefined && <MetricCard label="MAE" value={typeof mae === "number" ? mae.toFixed(4) : mae} color="#fbbf24" icon="📏" subtitle="Mean absolute error" />}
                    {mse !== undefined && <MetricCard label="MSE" value={typeof mse === "number" ? mse.toFixed(4) : mse} color="#fca5a5" icon="Σ" subtitle="Mean squared error" />}
                    {mape !== undefined && mape > 0 && <MetricCard label="MAPE" value={typeof mape === "number" ? `${mape.toFixed(2)}%` : mape} color="#c084fc" icon="%" subtitle="Mean abs % error" />}
                    {explainedVariance !== undefined && <MetricCard label="Explained Var." value={typeof explainedVariance === "number" ? explainedVariance.toFixed(4) : explainedVariance} color="#a7f3d0" icon="🔬" subtitle="Variance score" />}
                  </>}
                </div>

                {/* Confusion Matrix */}
                {isClassification && confusionMatrix && Array.isArray(confusionMatrix) && (
                  <div style={{
                    background: "rgba(8,12,20,0.8)",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,0,113,0.18)",
                    boxShadow: "0 0 24px rgba(255,0,113,0.06)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#ff85be", letterSpacing: 0.5 }}>🎯 CONFUSION MATRIX</span>
                      <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(255,0,113,0.3), transparent)" }} />
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", fontSize: 11, borderCollapse: "separate", borderSpacing: 3, textAlign: "center" }}>
                        <thead>
                          <tr>
                            <th style={{ color: "#475569", fontSize: 9.5, padding: "4px 6px", textAlign: "left" }}>Actual↓ Pred→</th>
                            {confusionMatrix[0].map((_, i) => (
                              <th key={i} style={{ color: "#94a3b8", padding: "4px 8px", fontWeight: 700, fontSize: 10.5 }}>Cls {i}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {confusionMatrix.map((row, rIdx) => {
                            const rowSum = row.reduce((a, b) => a + b, 0);
                            return (
                              <tr key={rIdx}>
                                <td style={{ color: "#94a3b8", fontWeight: 700, padding: "4px 6px", textAlign: "left", fontSize: 10.5 }}>Cls {rIdx}</td>
                                {row.map((val, cIdx) => {
                                  const isDiag = rIdx === cIdx;
                                  const intensity = rowSum > 0 ? val / rowSum : 0;
                                  return (
                                    <td key={cIdx} style={{
                                      padding: "8px 10px",
                                      fontWeight: 800,
                                      fontSize: 12,
                                      background: isDiag
                                        ? `rgba(34,197,94,${0.1 + intensity * 0.5})`
                                        : `rgba(239,68,68,${intensity * 0.4})`,
                                      color: isDiag ? "#4ade80" : (val > 0 ? "#fca5a5" : "#475569"),
                                      border: isDiag ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.04)",
                                      borderRadius: 6,
                                      minWidth: 40,
                                      transition: "transform 0.15s",
                                    }}>
                                      {val}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(34,197,94,0.5)", display: "inline-block" }} />
                        <span style={{ fontSize: 9.5, color: "#64748b" }}>Correct predictions</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(239,68,68,0.4)", display: "inline-block" }} />
                        <span style={{ fontSize: 9.5, color: "#64748b" }}>Misclassifications</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Per-class report bar chart */}
                {isClassification && classReportData.length > 0 && (
                  <ChartContainer title="📊 Per-Class Precision / Recall / F1 (%)" color="#06b6d4" chartRef={chartRef1}>
                    <ResponsiveContainer width="100%" height={170}>
                      <BarChart data={classReportData} margin={{ top: 4, right: 8, bottom: 16, left: -22 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="class" stroke="#475569" fontSize={10} tickLine={false} />
                        <YAxis stroke="#475569" fontSize={10} domain={[0, 100]} tickLine={false} />
                        <Tooltip content={<CustomTooltip borderColor="#06b6d4" />} />
                        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                        <Bar dataKey="precision" name="Precision" fill="url(#barGrad2)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="recall" name="Recall" fill="url(#barGrad3)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="f1" name="F1 Score" fill="url(#barGrad1)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                )}

                {/* Regression scatter */}
                {isRegression && regressionScatterData.length > 0 && (
                  <ChartContainer title="📈 Actual vs Predicted" color="#4ade80" chartRef={chartRef2}>
                    <ResponsiveContainer width="100%" height={185}>
                      <ScatterChart margin={{ top: 4, right: 8, bottom: 20, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="actual" name="Actual" stroke="#475569" fontSize={10} tickLine={false} />
                        <YAxis dataKey="predicted" name="Predicted" stroke="#475569" fontSize={10} tickLine={false} />
                        <Tooltip content={<CustomTooltip borderColor="#4ade80" />} />
                        <Scatter data={regressionScatterData.slice(0, 150)} fill="#4ade80" opacity={0.75} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                )}
              </div>
            )}

            {/* ══ SCATTER PLOT ══ */}
            {activeTab === "scatter" && (
              <ChartContainer title={`⚬ ${xAxis} vs ${yAxis}`} color="#ff0071" chartRef={chartRef1}>
                <ResponsiveContainer width="100%" height={240}>
                  <ScatterChart margin={{ top: 8, right: 12, bottom: 20, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey={xAxis} name={xAxis} stroke="#475569" fontSize={10} tickLine={false} />
                    <YAxis dataKey={yAxis} name={yAxis} stroke="#475569" fontSize={10} tickLine={false} />
                    <Tooltip content={<CustomTooltip borderColor="#ff0071" />} />
                    <Scatter data={chartData} fill="url(#scatterGrad)" opacity={0.8} />
                  </ScatterChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}

            {/* ══ HISTOGRAM ══ */}
            {activeTab === "histogram" && (
              <ChartContainer title={`📊 Distribution — ${histCol || xAxis}`} color="#8b5cf6" chartRef={chartRef1}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={histogramData} margin={{ top: 8, right: 12, bottom: 28, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="bin" stroke="#475569" fontSize={9} interval={0} angle={-20} textAnchor="end" tickLine={false} />
                    <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                    <Tooltip content={<CustomTooltip borderColor="#8b5cf6" />} />
                    <Bar dataKey="count" name="Count" fill="url(#barGrad3)" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}

            {/* ══ LINE CHART ══ */}
            {activeTab === "line" && (
              <ChartContainer title={`📈 ${yAxis} over ${xAxis}`} color="#06b6d4" chartRef={chartRef1}>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 20, left: -12 }}>
                    <defs>
                      <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey={xAxis} stroke="#475569" fontSize={10} tickLine={false} />
                    <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                    <Tooltip content={<CustomTooltip borderColor="#06b6d4" />} />
                    <Area type="monotone" dataKey={yAxis} stroke="#06b6d4" strokeWidth={2.5} fill="url(#areaFill)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}

            {/* ══ BAR CHART ══ */}
            {activeTab === "bar" && (
              <ChartContainer title={`▊ ${yAxis} by ${xAxis}`} color="#ff0071" chartRef={chartRef1}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData.slice(0, 30)} margin={{ top: 8, right: 12, bottom: 20, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey={xAxis} stroke="#475569" fontSize={10} tickLine={false} />
                    <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                    <Tooltip content={<CustomTooltip borderColor="#ff0071" />} />
                    <Bar dataKey={yAxis} fill="url(#barGrad1)" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}

            {/* ══ HEATMAP ══ */}
            {activeTab === "heatmap" && correlationMatrix && (
              <ChartContainer title="🔥 Correlation Heatmap" color="#ff85be" chartRef={chartRef1}>
                <div style={{ overflowX: "auto", maxHeight: 240 }}>
                  <table style={{ width: "100%", fontSize: 10, borderCollapse: "separate", borderSpacing: 3, textAlign: "center" }}>
                    <thead>
                      <tr>
                        <th style={{ padding: 4 }} />
                        {correlationMatrix.cols.map(col => (
                          <th key={col} style={{ padding: "4px 6px", color: "#ff85be", fontWeight: 700, fontSize: 9.5 }}>
                            {col.length > 7 ? col.slice(0, 6) + "…" : col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {correlationMatrix.matrix.map(row => (
                        <tr key={row.col}>
                          <td style={{ fontWeight: 700, padding: "4px 6px", color: "#cbd5e1", textAlign: "left", whiteSpace: "nowrap", fontSize: 9.5 }}>
                            {row.col.length > 7 ? row.col.slice(0, 6) + "…" : row.col}
                          </td>
                          {correlationMatrix.cols.map(c2 => {
                            const val = row[c2];
                            const absV = Math.abs(val);
                            const bg = val > 0
                              ? `rgba(255,0,113,${Math.min(absV * 0.9, 0.85)})`
                              : `rgba(99,102,241,${Math.min(absV * 0.9, 0.85)})`;
                            return (
                              <td key={c2} title={`${row.col} ↔ ${c2}: ${val}`} style={{
                                background: bg, color: absV > 0.5 ? "#fff" : "#94a3b8",
                                padding: "6px 4px", borderRadius: 5, fontWeight: absV > 0.6 ? 800 : 500,
                                fontSize: 10, transition: "transform 0.15s", cursor: "default",
                              }}
                                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.15)"}
                                onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
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
              </ChartContainer>
            )}

            {/* No data message */}
            {["scatter", "histogram", "line", "bar"].includes(activeTab) && !rows.length && !loading && (
              <div style={{ textAlign: "center", padding: "32px 20px", color: "#475569" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🗄️</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>No tabular data available</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Run this block to populate data for visualization.</div>
              </div>
            )}
            {activeTab === "heatmap" && !correlationMatrix && !loading && (
              <div style={{ textAlign: "center", padding: "32px 20px", color: "#475569" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔥</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Insufficient numeric columns for heatmap</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Need at least 2 numeric columns.</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const selectStyle = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: 7,
  border: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(8,12,20,0.8)",
  color: "#f1f5f9",
  fontSize: 11.5,
  outline: "none",
  fontFamily: "Inter, sans-serif",
  cursor: "pointer",
};
