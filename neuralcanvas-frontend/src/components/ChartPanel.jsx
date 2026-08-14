import { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer, ScatterChart, Scatter, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import api from "../api/axios";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export default function ChartPanel({ pipelineId, selectedNodeId, isDark }) {
  const [chartType, setChartType] = useState("scatter");
  const [xAxis, setXAxis] = useState("");
  const [yAxis, setYAxis] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);

  const fetchChartData = async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const url = selectedNodeId
        ? `/pipelines/${pipelineId}/nodes/${selectedNodeId}/preview/?page=1&page_size=300`
        : `/pipelines/${pipelineId}/nodes/preview/?page=1&page_size=300`;
      const { data: res } = await api.get(url);
      setData(res);
      if (res.columns && res.columns.length > 0) {
        if (!xAxis) setXAxis(res.columns[0]);
        if (!yAxis) setYAxis(res.columns[1] || res.columns[0]);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoUpdate) fetchChartData();
  }, [pipelineId, selectedNodeId, autoUpdate]);

  const columns = data?.columns || [];
  const rows = data?.rows || [];

  const chartData = useMemo(() => {
    if (!rows.length || !xAxis) return [];
    return rows.map((r) => ({
      [xAxis]: typeof r[xAxis] === "number" ? r[xAxis] : String(r[xAxis]),
      [yAxis]: typeof r[yAxis] === "number" ? r[yAxis] : parseFloat(r[yAxis]) || 0,
    }));
  }, [rows, xAxis, yAxis]);

  // Compute correlation matrix for Heatmap view
  const correlationMatrix = useMemo(() => {
    if (!rows.length || columns.length < 2) return null;
    const numericCols = columns.filter((c) => data?.column_types?.[c] === "numerical");
    if (numericCols.length < 2) return null;

    const matrix = [];
    numericCols.forEach((c1) => {
      const row = { col: c1 };
      numericCols.forEach((c2) => {
        const v1 = rows.map((r) => Number(r[c1]) || 0);
        const v2 = rows.map((r) => Number(r[c2]) || 0);
        const mean1 = v1.reduce((a, b) => a + b, 0) / v1.length;
        const mean2 = v2.reduce((a, b) => a + b, 0) / v2.length;
        const num = v1.reduce((acc, val, i) => acc + (val - mean1) * (v2[i] - mean2), 0);
        const den = Math.sqrt(v1.reduce((acc, val) => acc + (val - mean1) ** 2, 0) * v2.reduce((acc, val) => acc + (val - mean2) ** 2, 0));
        row[c2] = den !== 0 ? Math.round((num / den) * 100) / 100 : 1;
      });
      matrix.push(row);
    });
    return { cols: numericCols, matrix };
  }, [rows, columns, data]);

  const c = isDark ? darkColors : lightColors;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12.5, color: c.text, fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>📈 Interactive Charts & EDA</h4>
        <button onClick={fetchChartData} style={c.btn}>🔄 Refresh</button>
      </div>

      {/* Options Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <label style={c.label}>Chart Type</label>
          <select value={chartType} onChange={(e) => setChartType(e.target.value)} style={c.input}>
            <option value="scatter">Scatter Plot</option>
            <option value="line">Line Chart</option>
            <option value="bar">Bar Chart</option>
            <option value="area">Area Chart</option>
            <option value="pie">Pie Chart</option>
            <option value="heatmap">Correlation Heatmap</option>
          </select>
        </div>

        {chartType !== "heatmap" && (
          <>
            <div>
              <label style={c.label}>X Axis Column</label>
              <select value={xAxis} onChange={(e) => setXAxis(e.target.value)} style={c.input}>
                {columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={c.label}>Y Axis Column</label>
              <select value={yAxis} onChange={(e) => setYAxis(e.target.value)} style={c.input}>
                {columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: c.label }}>
          <input type="checkbox" checked={autoUpdate} onChange={(e) => setAutoUpdate(e.target.checked)} />
          Auto-update chart on node selection
        </label>
      </div>

      {/* Render Chart Container */}
      <div style={{ width: "100%", height: 240, marginTop: 8, background: c.chartBg, borderRadius: 8, border: `1px solid ${c.border}`, padding: 8 }}>
        {loading && <div style={{ textAlign: "center", padding: 80, color: c.label }}>Loading chart data…</div>}
        {!loading && !rows.length && <div style={{ textAlign: "center", padding: 80, color: c.label }}>No cached data to render chart.</div>}

        {!loading && rows.length > 0 && (
          <>
            {chartType === "scatter" && (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
                  <XAxis dataKey={xAxis} name={xAxis} stroke={c.label} />
                  <YAxis dataKey={yAxis} name={yAxis} stroke={c.label} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={chartData} fill="#3b82f6" />
                </ScatterChart>
              </ResponsiveContainer>
            )}

            {chartType === "line" && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
                  <XAxis dataKey={xAxis} stroke={c.label} />
                  <YAxis stroke={c.label} />
                  <Tooltip />
                  <Line type="monotone" dataKey={yAxis} stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            )}

            {chartType === "bar" && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.slice(0, 30)} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
                  <XAxis dataKey={xAxis} stroke={c.label} />
                  <YAxis stroke={c.label} />
                  <Tooltip />
                  <Bar dataKey={yAxis} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartType === "area" && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
                  <XAxis dataKey={xAxis} stroke={c.label} />
                  <YAxis stroke={c.label} />
                  <Tooltip />
                  <Area type="monotone" dataKey={yAxis} stroke="#f59e0b" fill="#fcf6e5" />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {chartType === "pie" && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData.slice(0, 10)} dataKey={yAxis} nameKey={xAxis} cx="50%" cy="50%" outerRadius={70} label>
                    {chartData.slice(0, 10).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}

            {chartType === "heatmap" && correlationMatrix && (
              <div style={{ overflowX: "auto", maxHeight: 220, padding: 4 }}>
                <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse", textAlign: "center" }}>
                  <thead>
                    <tr>
                      <th></th>
                      {correlationMatrix.cols.map((c) => (
                        <th key={c} style={{ padding: 4, color: c.text }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {correlationMatrix.matrix.map((row) => (
                      <tr key={row.col}>
                        <td style={{ fontWeight: 600, padding: 4 }}>{row.col}</td>
                        {correlationMatrix.cols.map((c2) => {
                          const val = row[c2];
                          const bg = val > 0 ? `rgba(37, 99, 235, ${Math.abs(val)})` : `rgba(239, 68, 68, ${Math.abs(val)})`;
                          return (
                            <td key={c2} style={{ background: bg, color: "#fff", padding: 6, borderRadius: 2 }}>
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
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle = (c) => ({
  width: "100%", padding: "6px 10px", borderRadius: 6,
  border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: 12,
});

const darkColors = {
  label: "#94a3b8", border: "#334155", inputBg: "#0f172a", text: "#f1f5f9", chartBg: "#0f172a",
  btn: { background: "#1e293b", color: "#f1f5f9", border: "1px solid #334155", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 11 }
};

const lightColors = {
  label: "#475569", border: "#cbd5e1", inputBg: "#fff", text: "#1e293b", chartBg: "#fafafa",
  btn: { background: "#f8fafc", color: "#0f172a", border: "1px solid #cbd5e1", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 11 }
};
