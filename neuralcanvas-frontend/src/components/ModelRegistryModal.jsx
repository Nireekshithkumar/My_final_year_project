import { useState, useEffect } from "react";
import api from "../api/axios";
import ApiTestModal from "./ApiTestModal";

export default function ModelRegistryModal({ isOpen, onClose }) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTestModel, setActiveTestModel] = useState(null);

  const fetchModels = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/pipelines/models/");
      setModels(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load model registry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchModels();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this model version from the registry?")) return;
    try {
      await api.delete(`/pipelines/models/${id}/`);
      fetchModels();
    } catch (err) {
      alert("Failed to delete model.");
    }
  };

  const handleDownload = (pipelineId) => {
    if (!pipelineId) {
      alert("Pipeline ID associated with this model is unavailable.");
      return;
    }
    window.location.href = `/api/pipelines/${pipelineId}/download/`;
  };

  return (
    <>
      <div style={overlayStyle}>
        <div style={modalBoxStyle}>
          <div style={headerStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>📦</span>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                  Model Registry & Artifact Repository
                </h2>
                <p style={{ fontSize: 11.5, color: "#64748b", margin: "2px 0 0" }}>
                  Manage versions, metrics, downloadable packages, and live REST inference endpoints.
                </p>
              </div>
            </div>
            <button onClick={onClose} style={closeBtnStyle}>✕</button>
          </div>

          <div style={{ padding: 20, overflowY: "auto", maxHeight: "calc(85vh - 120px)" }}>
            {loading && <div style={{ textAlign: "center", padding: "30px 0", color: "#94a3b8" }}>Loading registered models…</div>}
            {error && <div style={errorStyle}>⚠️ {error}</div>}

            {!loading && models.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                No models registered yet. Successfully train a model in a pipeline to register it automatically.
              </div>
            )}

            {!loading && models.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)", color: "#94a3b8", textAlign: "left" }}>
                    <th style={thStyle}>Model Name</th>
                    <th style={thStyle}>Version</th>
                    <th style={thStyle}>Algorithm</th>
                    <th style={thStyle}>Primary Metric</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Registered Date</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => {
                    const primaryMetric = m.metrics?.accuracy
                      ? `Acc: ${(m.metrics.accuracy * 100).toFixed(1)}%`
                      : m.metrics?.r2
                      ? `R²: ${m.metrics.r2}`
                      : "Trained";

                    return (
                      <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={tdStyle}>
                          <strong style={{ color: "#f8fafc" }}>{m.name}</strong>
                          <div style={{ fontSize: 10.5, color: "#64748b" }}>{m.dataset_name}</div>
                        </td>
                        <td style={tdStyle}>
                          <span style={versionBadgeStyle}>v{m.version}</span>
                        </td>
                        <td style={{ ...tdStyle, color: "#ff85be", fontWeight: 600 }}>{m.algorithm}</td>
                        <td style={{ ...tdStyle, color: "#86efac", fontWeight: 700 }}>{primaryMetric}</td>
                        <td style={tdStyle}>
                          <span style={statusBadgeStyle(m.status)}>{m.status?.toUpperCase()}</span>
                        </td>
                        <td style={{ ...tdStyle, color: "#64748b", fontSize: 11 }}>{m.created_at}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button
                              onClick={() => setActiveTestModel(m)}
                              style={btnActionStyle("#3b82f6")}
                              title="Test API Endpoint"
                            >
                              ⚡ Test API
                            </button>
                            <button
                              onClick={() => handleDownload(m.pipeline_id)}
                              style={btnActionStyle("#10b981")}
                              title="Download Model ZIP Bundle"
                            >
                              ⬇ ZIP
                            </button>
                            <button
                              onClick={() => handleDelete(m.id)}
                              style={btnActionStyle("#ef4444")}
                              title="Delete Model"
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {activeTestModel && (
        <ApiTestModal
          isOpen={true}
          onClose={() => setActiveTestModel(null)}
          model={activeTestModel}
        />
      )}
    </>
  );
}

const overlayStyle = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0, 0, 0, 0.75)",
  backdropFilter: "blur(8px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 9999, padding: 20,
};

const modalBoxStyle = {
  background: "#0d1322",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 16,
  width: "100%", maxWidth: 900,
  maxHeight: "85vh",
  boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
  display: "flex", flexDirection: "column",
  overflow: "hidden",
  fontFamily: "'Inter', sans-serif",
};

const headerStyle = {
  padding: "16px 20px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  background: "rgba(10, 15, 26, 0.8)",
};

const closeBtnStyle = { background: "transparent", border: "none", color: "#64748b", fontSize: 18, cursor: "pointer" };
const thStyle = { padding: "8px 10px", fontSize: 11, fontWeight: 700 };
const tdStyle = { padding: "8px 10px", color: "#e2e8f0" };

const versionBadgeStyle = {
  background: "rgba(139, 92, 246, 0.15)",
  color: "#c4b5fd",
  border: "1px solid rgba(139, 92, 246, 0.3)",
  padding: "2px 6px",
  borderRadius: 4,
  fontWeight: 700,
  fontSize: 10,
};

const statusBadgeStyle = (st) => ({
  background: st === "active" ? "rgba(34, 197, 94, 0.15)" : "rgba(100, 116, 139, 0.2)",
  color: st === "active" ? "#86efac" : "#94a3b8",
  padding: "2px 6px",
  borderRadius: 4,
  fontWeight: 700,
  fontSize: 9.5,
});

const btnActionStyle = (color) => ({
  background: "transparent",
  border: `1px solid ${color}`,
  color: color,
  borderRadius: 6,
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
});

const errorStyle = { background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 12, marginBottom: 14 };
