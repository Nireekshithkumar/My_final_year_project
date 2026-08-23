import { useState } from "react";
import api from "../api/axios";

const CLASSIFICATION_ALGOS = [
  "LogisticRegression", "RandomForestClassifier", "GradientBoostingClassifier",
  "DecisionTreeClassifier", "ExtraTreesClassifier", "AdaBoostClassifier",
  "BaggingClassifier", "SVC", "KNeighborsClassifier", "GaussianNB"
];

const REGRESSION_ALGOS = [
  "LinearRegression", "Ridge", "Lasso", "ElasticNet",
  "RandomForestRegressor", "GradientBoostingRegressor",
  "DecisionTreeRegressor", "ExtraTreesRegressor", "SVR", "KNeighborsRegressor"
];

export default function ModelCompareModal({ isOpen, onClose, pipelineId }) {
  const [taskType, setTaskType] = useState("classification");
  const [selectedAlgos, setSelectedAlgos] = useState([
    "LogisticRegression", "RandomForestClassifier", "DecisionTreeClassifier"
  ]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const toggleAlgo = (name) => {
    if (selectedAlgos.includes(name)) {
      if (selectedAlgos.length > 1) {
        setSelectedAlgos(selectedAlgos.filter((a) => a !== name));
      }
    } else {
      setSelectedAlgos([...selectedAlgos, name]);
    }
  };

  const handleRunComparison = async () => {
    setRunning(true);
    setError("");
    setResults(null);

    try {
      const { data } = await api.post(`/pipelines/${pipelineId}/nodes/preview/`, {
        algorithm_type: "ModelComparison",
        params: { algorithms: selectedAlgos }
      });
      setResults(data?.result || data);
    } catch (err) {
      setError(err.response?.data?.detail || "Model comparison requires a connected dataset split.");
    } finally {
      setRunning(false);
    }
  };

  const currentList = taskType === "classification" ? CLASSIFICATION_ALGOS : REGRESSION_ALGOS;

  return (
    <div style={overlayStyle}>
      <div style={modalBoxStyle}>
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚖️</span>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                Multi-Model Comparison Studio
              </h2>
              <p style={{ fontSize: 11.5, color: "#64748b", margin: "2px 0 0" }}>
                Train and compare multiple algorithms side-by-side on identical test splits.
              </p>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        <div style={{ padding: 20, overflowY: "auto", maxHeight: "calc(85vh - 120px)" }}>
          {/* Task Type Switcher */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <button
              onClick={() => {
                setTaskType("classification");
                setSelectedAlgos(["LogisticRegression", "RandomForestClassifier", "DecisionTreeClassifier"]);
              }}
              style={tabBtnStyle(taskType === "classification")}
            >
              🏷️ Classification
            </button>
            <button
              onClick={() => {
                setTaskType("regression");
                setSelectedAlgos(["LinearRegression", "RandomForestRegressor", "Ridge"]);
              }}
              style={tabBtnStyle(taskType === "regression")}
            >
              📈 Regression
            </button>
          </div>

          {/* Algorithm Selection Checkboxes */}
          <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "#94a3b8", marginBottom: 8 }}>SELECT ALGORITHMS TO BENCHMARK:</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
              {currentList.map((algo) => {
                const checked = selectedAlgos.includes(algo);
                return (
                  <label key={algo} style={algoCheckboxLabel(checked)}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAlgo(algo)}
                      style={{ accentColor: "#ff0071" }}
                    />
                    <span style={{ fontSize: 12, color: checked ? "#f8fafc" : "#94a3b8", fontWeight: checked ? 600 : 400 }}>{algo}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleRunComparison}
            disabled={running}
            style={{
              background: running ? "#64748b" : "linear-gradient(135deg, #06b6d4, #3b82f6)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 18px",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: running ? "not-allowed" : "pointer",
              boxShadow: "0 2px 14px rgba(6, 182, 212, 0.4)",
              marginBottom: 16,
            }}
          >
            {running ? "⏳ Benchmarking Selected Models…" : "⚡ Run Model Comparison"}
          </button>

          {error && <div style={errorStyle}>⚠️ {error}</div>}

          {/* Results Table */}
          {results && results.comparison_table && (
            <div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)", color: "#94a3b8", textAlign: "left" }}>
                    <th style={thStyle}>Algorithm</th>
                    {results.task_type === "regression" ? (
                      <>
                        <th style={thStyle}>R² Score</th>
                        <th style={thStyle}>MSE</th>
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
                  {results.comparison_table.map((item, idx) => (
                    <tr
                      key={item.algorithm}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        background: idx === 0 ? "rgba(6, 182, 212, 0.08)" : "transparent",
                      }}
                    >
                      <td style={tdStyle}>
                        <strong>{item.algorithm}</strong>
                        {idx === 0 && <span style={bestBadgeStyle}>BEST</span>}
                      </td>
                      {results.task_type === "regression" ? (
                        <>
                          <td style={{ ...tdStyle, color: idx === 0 ? "#67e8f9" : "#f1f5f9", fontWeight: 700 }}>{item.r2}</td>
                          <td style={tdStyle}>{item.mse}</td>
                          <td style={tdStyle}>{item.rmse}</td>
                          <td style={tdStyle}>{item.mae}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ ...tdStyle, color: idx === 0 ? "#67e8f9" : "#f1f5f9", fontWeight: 700 }}>{item.accuracy}</td>
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
const tabBtnStyle = (active) => ({
  background: active ? "rgba(6, 182, 212, 0.2)" : "rgba(255, 255, 255, 0.04)",
  border: active ? "1px solid #06b6d4" : "1px solid rgba(255, 255, 255, 0.08)",
  color: active ? "#67e8f9" : "#94a3b8",
  padding: "6px 14px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
});

const algoCheckboxLabel = (checked) => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 8px",
  borderRadius: 6,
  background: checked ? "rgba(255, 0, 113, 0.1)" : "rgba(255, 255, 255, 0.02)",
  border: checked ? "1px solid rgba(255, 0, 113, 0.3)" : "1px solid rgba(255, 255, 255, 0.04)",
  cursor: "pointer",
});

const thStyle = { padding: "8px 10px", fontSize: 11, fontWeight: 700 };
const tdStyle = { padding: "8px 10px", color: "#e2e8f0" };
const bestBadgeStyle = { background: "rgba(6, 182, 212, 0.2)", color: "#67e8f9", fontSize: 9, padding: "1px 5px", borderRadius: 4, marginLeft: 6, fontWeight: 700 };
const statusBadge = (st) => ({ background: st === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: st === "success" ? "#86efac" : "#fca5a5", padding: "2px 6px", borderRadius: 4, fontSize: 9.5, fontWeight: 700 });
const errorStyle = { background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 12, marginBottom: 14 };
