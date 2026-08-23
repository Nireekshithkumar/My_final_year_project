import { useState } from "react";
import api from "../api/axios";

export default function ApiTestModal({ isOpen, onClose, model }) {
  const [inputJson, setInputJson] = useState("");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !model) return null;

  // Initialize placeholder JSON based on features
  const getInitialPayload = () => {
    if (inputJson) return inputJson;
    const obj = {};
    if (model.features && model.features.length > 0) {
      model.features.forEach((f) => {
        obj[f] = 0.0;
      });
    } else {
      obj["feature_1"] = 1.0;
      obj["feature_2"] = 2.0;
    }
    return JSON.stringify(obj, null, 2);
  };

  const handleTestApi = async () => {
    setLoading(true);
    setError("");
    setResponse(null);

    try {
      const parsed = JSON.parse(inputJson || getInitialPayload());
      const { data } = await api.post(`/pipelines/models/${model.id}/predict/`, parsed);
      setResponse(data);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("Invalid JSON format in Request Body.");
      } else {
        setError(err.response?.data?.detail || "Prediction request failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalBoxStyle}>
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                Live Prediction REST API Console
              </h2>
              <p style={{ fontSize: 11.5, color: "#64748b", margin: "2px 0 0" }}>
                Test deployed model <strong style={{ color: "#ff85be" }}>{model.name} (v{model.version})</strong> endpoint.
              </p>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        <div style={{ padding: 20, overflowY: "auto", maxHeight: "calc(85vh - 120px)" }}>
          {/* Endpoint URL display */}
          <div style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ background: "#22c55e", color: "#000", fontWeight: 800, fontSize: 11, padding: "2px 8px", borderRadius: 4 }}>POST</span>
            <code style={{ fontSize: 12, color: "#93c5fd", fontFamily: "monospace" }}>
              /api/pipelines/models/{model.id}/predict/
            </code>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Request Pane */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#94a3b8" }}>REQUEST BODY (JSON)</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>{model.features?.length || 0} features</span>
              </div>
              <textarea
                rows={12}
                value={inputJson || getInitialPayload()}
                onChange={(e) => setInputJson(e.target.value)}
                style={codeAreaStyle}
              />
              <button
                onClick={handleTestApi}
                disabled={loading}
                style={btnSendStyle(loading)}
              >
                {loading ? "Sending Request…" : "🚀 Send Request"}
              </button>
            </div>

            {/* Response Pane */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#94a3b8" }}>RESPONSE</span>
                {response && (
                  <span style={{ fontSize: 11, color: "#86efac", fontWeight: 700 }}>
                    200 OK ({response.latency_ms} ms)
                  </span>
                )}
              </div>
              <pre style={codeResponseStyle}>
                {response ? JSON.stringify(response, null, 2) : error ? `Error: ${error}` : "// Response JSON will appear here..."}
              </pre>
            </div>
          </div>
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
  zIndex: 99999, padding: 20,
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

const codeAreaStyle = {
  width: "100%",
  background: "#080c14",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  color: "#93c5fd",
  borderRadius: 8,
  padding: 10,
  fontSize: 12,
  fontFamily: "monospace",
  outline: "none",
  boxSizing: "border-box",
  resize: "vertical",
};

const codeResponseStyle = {
  width: "100%",
  minHeight: 250,
  maxHeight: 250,
  background: "#080c14",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  color: "#86efac",
  borderRadius: 8,
  padding: 10,
  fontSize: 12,
  fontFamily: "monospace",
  overflowY: "auto",
  boxSizing: "border-box",
  margin: 0,
};

const btnSendStyle = (loading) => ({
  marginTop: 10,
  width: "100%",
  background: loading ? "#475569" : "linear-gradient(135deg, #22c55e, #16a34a)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12.5,
  fontWeight: 700,
  cursor: loading ? "not-allowed" : "pointer",
});
