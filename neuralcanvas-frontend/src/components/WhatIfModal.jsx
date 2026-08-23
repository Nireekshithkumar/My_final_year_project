import { useState, useEffect } from "react";
import api from "../api/axios";

export default function WhatIfModal({ isOpen, onClose, pipelineId, initialFeatures = [] }) {
  const [featureValues, setFeatureValues] = useState({});
  const [features, setFeatures] = useState(initialFeatures);
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [latency, setLatency] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialFeatures && initialFeatures.length > 0) {
      setFeatures(initialFeatures);
      const initVals = {};
      initialFeatures.forEach((f) => {
        initVals[f] = 0;
      });
      setFeatureValues(initVals);
    }
  }, [initialFeatures]);

  if (!isOpen) return null;

  const handleValueChange = (feat, val) => {
    setFeatureValues((prev) => ({
      ...prev,
      [feat]: parseFloat(val) || 0,
    }));
  };

  const handlePredict = async () => {
    setLoading(true);
    setError("");

    try {
      const { data } = await api.post(`/pipelines/${pipelineId}/predict/`, featureValues);
      setPrediction(data.prediction);
      setConfidence(data.confidence);
      setLatency(data.latency_ms);
    } catch (err) {
      setError(err.response?.data?.detail || "Prediction simulation failed. Train the model first.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalBoxStyle}>
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔮</span>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                What-If Scenario Simulation Studio
              </h2>
              <p style={{ fontSize: 11.5, color: "#64748b", margin: "2px 0 0" }}>
                Tweak feature inputs dynamically to simulate model predictions in real-time.
              </p>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        <div style={{ padding: 20, overflowY: "auto", maxHeight: "calc(85vh - 120px)" }}>
          {error && <div style={errorStyle}>⚠️ {error}</div>}

          {/* Prediction Result Box */}
          <div style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(99, 102, 241, 0.3)", borderRadius: 12, padding: 16, marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>SIMULATED PREDICTION OUTPUT</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#ff85be", marginTop: 4 }}>
                {prediction !== null ? String(prediction) : "—"}
              </div>
            </div>
            {confidence !== null && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>CONFIDENCE</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#86efac", marginTop: 4 }}>
                  {typeof confidence === "number" ? `${(confidence * 100).toFixed(1)}%` : JSON.stringify(confidence)}
                </div>
              </div>
            )}
            {latency !== null && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>LATENCY</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", marginTop: 4 }}>
                  {latency} ms
                </div>
              </div>
            )}
            <button
              onClick={handlePredict}
              disabled={loading}
              style={{
                background: "linear-gradient(135deg, #ff0071, #8b5cf6)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {loading ? "Simulating…" : "⚡ Predict Now"}
            </button>
          </div>

          {/* Feature Inputs Grid */}
          <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 10 }}>ADJUST INPUT VALUES:</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {features.map((feat) => (
              <div key={feat} style={featCardStyle}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                  {feat}
                </label>
                <input
                  type="number"
                  step="any"
                  value={featureValues[feat] ?? 0}
                  onChange={(e) => handleValueChange(feat, e.target.value)}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>

          {features.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#64748b" }}>
              No trained features detected. Please train a model in the canvas first.
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
  width: "100%", maxWidth: 820,
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
const featCardStyle = { background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: 10 };
const inputStyle = { width: "100%", background: "#080c14", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", borderRadius: 6, padding: "5px 8px", fontSize: 12, outline: "none", boxSizing: "border-box" };
const errorStyle = { background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 12, marginBottom: 14 };
