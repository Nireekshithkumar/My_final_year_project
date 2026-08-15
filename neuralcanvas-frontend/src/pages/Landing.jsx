import { useNavigate } from "react-router-dom";

const FEATURES = [
  {
    icon: "🧩",
    title: "Drag-and-Drop Pipeline Builder",
    desc: "Visually chain preprocessing, text vectorization, classical ML and deep neural nets with real-time topological execution checks.",
    color: "#ff0071",
  },
  {
    icon: "🛡",
    title: "Data-Leakage Safe Transforms",
    desc: "Scalers and encoders enforce fit-on-train-only discipline, preventing statistical leakage into evaluation test splits.",
    color: "#8b5cf6",
  },
  {
    icon: "⚡",
    title: "Real-Time WebSocket Progress",
    desc: "Stream live execution logs, node status updates, column transformation metrics, and prediction results directly on the canvas.",
    color: "#06b6d4",
  },
  {
    icon: "📊",
    title: "Dataset Viewer & EDA Analytics",
    desc: "Inspect paginated dataframe slices, summary statistics, correlation heatmaps, histograms, boxplots, and confusion matrices.",
    color: "#ec4899",
  },
  {
    icon: "🎛",
    title: "Hyperparameter Tuning & CV",
    desc: "Automate model selection via Grid Search or Random Search cross-validation to find optimal hyperparameter combos.",
    color: "#f59e0b",
  },
  {
    icon: "📦",
    title: "Downloadable Model Bundles",
    desc: "Export fitted model artifacts (scikit-learn pickles or Keras H5), transform JSONs, and Python integration guides.",
    color: "#22c55e",
  },
];

const PIPELINE_NODES = [
  { label: "📂 Load Dataset", color: "#ff0071" },
  { label: "🔠 Encoder", color: "#a855f7" },
  { label: "✂ Split Data", color: "#f59e0b" },
  { label: "📏 Scaler", color: "#06b6d4" },
  { label: "🌲 Random Forest", color: "#6366f1" },
  { label: "🎯 Predict", color: "#22c55e" },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#090d16", color: "#f1f5f9", fontFamily: "'Inter', sans-serif", overflowX: "hidden", position: "relative" }}>
      {/* Background Orbs */}
      <div className="orb orb-pink" style={{ width: 600, height: 600, top: -100, left: -200, zIndex: 0, opacity: 0.35 }} />
      <div className="orb orb-purple" style={{ width: 500, height: 500, top: 200, right: -150, zIndex: 0, opacity: 0.3 }} />
      <div className="orb orb-pink" style={{ width: 400, height: 400, bottom: 100, left: "30%", zIndex: 0, opacity: 0.25 }} />

      {/* Nav */}
      <nav style={{ position: "relative", zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 48px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(9, 13, 22, 0.8)", backdropFilter: "blur(16px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => navigate("/")}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #ff0071, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: "0 0 16px rgba(255,0,113,0.4)" }}>🧠</div>
          <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.5, fontFamily: "'Space Grotesk', sans-serif" }}>
            Neural <span style={{ background: "linear-gradient(135deg, #ff0071, #ff85be)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Canvas</span>
          </span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn-secondary" onClick={() => navigate("/login")}>Sign In</button>
          <button className="btn-primary" onClick={() => navigate("/register")}>Get Started →</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "90px 20px 60px", maxWidth: 940, margin: "0 auto" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255, 0, 113, 0.1)", border: "1px solid rgba(255, 0, 113, 0.3)", borderRadius: 20, padding: "6px 18px", fontSize: 12, fontWeight: 700, color: "#ff85be", marginBottom: 28 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff0071", display: "inline-block", boxShadow: "0 0 10px #ff0071" }} />
          Next-Gen Visual Machine Learning Platform
        </div>

        <h1 style={{ fontSize: "clamp(42px, 6vw, 70px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: -2, fontFamily: "'Space Grotesk', sans-serif" }}>
          Build, Train & Deploy<br />
          <span style={{ background: "linear-gradient(135deg, #ff0071 0%, #a855f7 50%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            ML Pipelines
          </span> Visually
        </h1>

        <p style={{ fontSize: 17, color: "#94a3b8", marginTop: 24, lineHeight: 1.7, maxWidth: 660, margin: "24px auto 0" }}>
          Assemble end-to-end machine learning workflows with an interactive drag-and-drop canvas. Real-time execution, data-leakage-safe transforms, and instant inference.
        </p>

        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 38 }}>
          <button
            className="btn-primary"
            onClick={() => navigate("/register")}
            style={{ padding: "14px 34px", fontSize: 15, borderRadius: 12 }}
          >
            Start Building Free →
          </button>
          <button
            className="btn-secondary"
            onClick={() => navigate("/login")}
            style={{ padding: "14px 26px", fontSize: 15, borderRadius: 12 }}
          >
            Sign In to Canvas
          </button>
        </div>
      </section>

      {/* Pipeline Preview */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto 80px", padding: "0 24px" }}>
        <div className="glass-card animate-float" style={{ overflow: "hidden", boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255, 0, 113, 0.25)" }}>
          {/* Window chrome */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(10, 15, 26, 0.95)" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["#ef4444", "#f59e0b", "#22c55e"].map((c) => (
                <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
              ))}
            </div>
            <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>neural_canvas — pipeline_dag.nc</span>
          </div>

          {/* Canvas area */}
          <div style={{ padding: "40px 30px", background: "#090d16", display: "flex", alignItems: "center", gap: 0, overflowX: "auto", backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255, 0, 113, 0.12) 1.2px, transparent 0)", backgroundSize: "22px 22px" }}>
            {PIPELINE_NODES.map((node, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center" }}>
                <div style={{
                  background: "rgba(17, 24, 39, 0.95)",
                  border: `1.5px solid ${node.color}55`,
                  borderRadius: 12,
                  padding: "12px 16px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#f8fafc",
                  whiteSpace: "nowrap",
                  boxShadow: `0 8px 24px ${node.color}25`,
                  minWidth: 135,
                  textAlign: "center",
                  transition: "all 0.2s",
                }}>
                  {node.label}
                  <div style={{ marginTop: 8, height: 2.5, borderRadius: 2, background: `linear-gradient(90deg, ${node.color}, transparent)` }} />
                </div>
                {i < PIPELINE_NODES.length - 1 && (
                  <div style={{ display: "flex", alignItems: "center", padding: "0 8px" }}>
                    <div style={{ width: 22, height: 2, background: "rgba(255, 0, 113, 0.6)", borderStyle: "dashed" }} />
                    <div style={{ width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: "6px solid #ff0071" }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Status bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(10, 15, 26, 0.95)", fontSize: 11.5, color: "#64748b" }}>
            <span className="badge badge-success">● Pipeline Ready</span>
            <span>6 nodes • 5 connections • Execution: 100% DAG Verified</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto 100px", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <h2 style={{ fontSize: 38, fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -1 }}>
            Everything to <span style={{ background: "linear-gradient(135deg, #ff0071, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Scale AI Workflows</span>
          </h2>
          <p style={{ color: "#64748b", marginTop: 12, fontSize: 15 }}>From data ingestion to production model inference, all on a single canvas.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="glass-card" style={{ padding: 28 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: `${f.color}18`,
                border: `1px solid ${f.color}33`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, marginBottom: 16,
                boxShadow: `0 0 20px ${f.color}22`,
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#f1f5f9" }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "80px 20px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
        <div style={{ display: "inline-block", borderRadius: 24, padding: "50px 60px", background: "rgba(17, 24, 39, 0.8)", border: "1px solid rgba(255, 0, 113, 0.3)", boxShadow: "0 0 40px rgba(255, 0, 113, 0.15)" }}>
          <h2 style={{ fontSize: 34, fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -1, marginBottom: 14 }}>
            Ready to build your first <span style={{ color: "#ff0071" }}>pipeline?</span>
          </h2>
          <p style={{ color: "#64748b", marginBottom: 28, fontSize: 15 }}>Free to use. No configuration needed.</p>
          <button className="btn-primary" onClick={() => navigate("/register")} style={{ padding: "14px 36px", fontSize: 15, borderRadius: 12 }}>
            Start Building Now →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "24px", borderTop: "1px solid rgba(255, 255, 255, 0.06)", fontSize: 12, color: "#475569" }}>
        © 2026 Neural Canvas · Built for Next-Gen Machine Learning Engineering
      </footer>
    </div>
  );
}

