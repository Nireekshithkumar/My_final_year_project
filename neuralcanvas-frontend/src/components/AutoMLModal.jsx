import { useState } from "react";
import api from "../api/axios";

export default function AutoMLModal({ isOpen, onClose, pipelineId, onAutoMLComplete }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleRunAutoML = async () => {
    setRunning(true);
    setError("");
    setResult(null);

    try {
      // Execute AutoML directly through pipeline execution preview or fast execute endpoint
      const { data } = await api.post(`/pipelines/${pipelineId}/nodes/preview/`, {
        algorithm_type: "AutoML",
      });
      setResult(data?.result || data);
      if (onAutoMLComplete) onAutoMLComplete(data?.result || data);
    } catch (err) {
      // If endpoint requires executing single node, try node run or show friendly message
      const msg = err.response?.data?.detail || "AutoML search requires a connected 'Split Dataset' block with valid data.";
      setError(msg);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalBoxStyle}>
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🤖</span>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                AutoML Engine & Model Leaderboard
              </h2>
              <p style={{ fontSize: 11.5, color: "#64748b", margin: "2px 0 0" }}>
                Automatically trains, benchmarks, and selects the winning ML model.
              </p>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        <div style={{ padding: 20, overflowY: "auto", maxHeight: "calc(85vh - 120px)" }}>
          <div style={{ background: "rgba(255, 0, 113, 0.06)", border: "1px solid rgba(255, 0, 113, 0.2)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, color: "#ff85be", fontWeight: 600 }}>🚀 1-Click AutoML Workflow:</div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 4, lineHeight: 1.5 }}>
              1. Ingests train/test split data • 2. Identifies classification vs regression • 3. Trains 6+ compatible candidate models in parallel • 4. Evaluates test metrics • 5. Ranks winner.
            </div>
            <button
              onClick={handleRunAutoML}
              disabled={running}
              style={{
                marginTop: 12,
                background: running ? "#64748b" : "linear-gradient(135deg, #ff0071, #8b5cf6)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 18px",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: running ? "not-allowed" : "pointer",
                boxShadow: "0 2px 14px rgba(255, 0, 113, 0.4)",
              }}
            >
              {running ? "⏳ Training Candidate Models…" : "⚡ Run AutoML Search"}
            </button>
          </div>

          {error && <div style={errorStyle}>⚠️ {error}</div>}

          {result && result.leaderboard && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>Winning Model: </span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#86efac", background: "rgba(34,197,94,0.15)", padding: "3px 8px", borderRadius: 6 }}>
                    🏆 {result.best_algorithm}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  Primary Score: <strong>{result.best_score}</strong>
                </span>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)", color: "#94a3b8", textAlign: "left" }}>
                    <th style={thStyle}>Rank</th>
                    <th style={thStyle}>Algorithm</th>
                    {result.task_type === "regression" ? (
                      <>
                        <th style={thStyle}>R² Score</th>
                        <th style={thStyle}>RMSE</th>
                        <th style={thStyle}>MAE</th>
                      </>
                    ) : (
                      <>
                        <th style={thStyle}>Accuracy</th>
                        <th style={thStyle}>Precision</th>
                        <th style={thStyle}>Recall</th>
                        <th style={thStyle}>F1 Score</th>
                      </>
                    )}
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.leaderboard.map((item, idx) => (
                    <tr
                      key={item.algorithm}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        background: idx === 0 ? "rgba(34,197,94,0.06)" : "transparent",
                      }}
                    >
                      <td style={tdStyle}>#{idx + 1}</td>
                      <td style={tdStyle}>
                        <strong>{item.algorithm}</strong>
                        {idx === 0 && <span style={winnerBadgeStyle}>WINNER</span>}
                      </td>
                      {result.task_type === "regression" ? (
                        <>
                          <td style={{ ...tdStyle, color: idx === 0 ? "#86efac" : "#f1f5f9", fontWeight: 700 }}>{item.r2}</td>
                          <td style={tdStyle}>{item.rmse}</td>
                          <td style={tdStyle}>{item.mae}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ ...tdStyle, color: idx === 0 ? "#86efac" : "#f1f5f9", fontWeight: 700 }}>{item.accuracy}</td>
                          <td style={tdStyle}>{item.precision}</td>
                          <td style={tdStyle}>{item.recall}</td>
                          <td style={{ ...tdStyle, color: "#ff85be", fontWeight: 700 }}>{item.f1}</td>
                        </>
                      )}
                      <td style={tdStyle}>
                        <span style={statusBadge(item.status)}>{item.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
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
  width: "100%", maxWidth: 840,
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
const winnerBadgeStyle = { background: "rgba(34,197,94,0.2)", color: "#86efac", fontSize: 9, padding: "1px 5px", borderRadius: 4, marginLeft: 6, fontWeight: 700 };
const statusBadge = (st) => ({ background: st === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: st === "success" ? "#86efac" : "#fca5a5", padding: "2px 6px", borderRadius: 4, fontSize: 9.5, fontWeight: 700 });
const errorStyle = { background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 12, marginBottom: 14 };
