import { useNavigate } from "react-router-dom";
import useStore from "../store/useStore";

const FEATURES = [
  {
    icon: "🧩",
    title: "Drag-and-Drop Pipeline Builder",
    desc: "Visually chain preprocessing, text vectorization, classical ML and deep neural nets with real-time topological execution checks.",
    color: "#6366f1",
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
    title: "Dataset Viewer & Column Stats",
    desc: "Inspect paginated dataframe slices, detected types, mean/median/quartile statistics, and interactive EDA charts.",
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
  { label: "📂 Load Dataset", color: "#6366f1" },
  { label: "🔠 Encoder", color: "#8b5cf6" },
  { label: "✂ Split Data", color: "#f59e0b" },
  { label: "📏 Scaler", color: "#06b6d4" },
  { label: "🌲 Random Forest", color: "#a855f7" },
  { label: "🎯 Predict", color: "#22c55e" },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#e2e8f0", fontFamily: "'Inter', sans-serif", overflowX: "hidden", position: "relative" }}>
      {/* Background Orbs */}
      <div className="orb orb-purple" style={{ width: 600, height: 600, top: -100, left: -200, zIndex: 0 }} />
      <div className="orb orb-blue" style={{ width: 500, height: 500, top: 200, right: -150, zIndex: 0 }} />
      <div className="orb orb-pink" style={{ width: 400, height: 400, bottom: 100, left: "30%", zIndex: 0 }} />

      {/* Nav */}
      <nav style={{ position: "relative", zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 48px", borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🧠</div>
          <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.5, fontFamily: "'Space Grotesk', sans-serif" }}>
            Neural <span className="gradient-text">Canvas</span>
          </span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn-secondary" onClick={() => navigate("/login")}>Sign In</button>
          <button className="btn-primary" onClick={() => navigate("/register")}>Get Started →</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "100px 20px 60px", maxWidth: 900, margin: "0 auto" }}>
        <div className="animate-fade-in-up" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#a5b4fc", marginBottom: 28 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", display: "inline-block", animation: "pulse-glow 1.5s ease infinite" }} />
          Next-Gen Visual Machine Learning Platform
        </div>

        <h1 className="animate-fade-in-up" style={{ fontSize: "clamp(42px, 6vw, 72px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: -2, fontFamily: "'Space Grotesk', sans-serif", animationDelay: "0.1s" }}>
          Build, Train & Deploy<br />
          <span className="gradient-text">ML Pipelines</span> Visually
        </h1>

        <p className="animate-fade-in-up" style={{ fontSize: 17, color: "#94a3b8", marginTop: 24, lineHeight: 1.7, maxWidth: 640, margin: "24px auto 0", animationDelay: "0.2s" }}>
          Assemble end-to-end machine learning workflows with a fluid drag-and-drop canvas. Real-time execution, data-leakage-safe transforms, and instant inference.
        </p>

        <div className="animate-fade-in-up" style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 40, animationDelay: "0.3s" }}>
          <button
            className="btn-primary"
            onClick={() => navigate("/register")}
            style={{ padding: "14px 32px", fontSize: 16, borderRadius: 12, boxShadow: "0 8px 32px rgba(99,102,241,0.5)" }}
          >
            Start Building Free →
          </button>
          <button
            className="btn-secondary"
            onClick={() => navigate("/login")}
            style={{ padding: "14px 24px", fontSize: 16, borderRadius: 12 }}
          >
            Explore Canvas
          </button>
        </div>
      </section>

      {/* Pipeline Preview */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto 80px", padding: "0 24px" }}>
        <div className="glass-card animate-float" style={{ overflow: "hidden", boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.2)" }}>
          {/* Window chrome */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid rgba(99,102,241,0.1)", background: "rgba(8,12,20,0.8)" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["#ef4444", "#f59e0b", "#22c55e"].map((c) => (
                <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
              ))}
            </div>
            <span style={{ fontSize: 12, color: "#475569", fontFamily: "monospace" }}>neural_canvas — churn_prediction.nc</span>
          </div>

          {/* Canvas area */}
          <div style={{ padding: "40px 30px", background: "rgba(8,12,20,0.9)", display: "flex", alignItems: "center", gap: 0, overflowX: "auto", backgroundImage: "radial-gradient(circle at 1px 1px, rgba(99,102,241,0.07) 1px, transparent 0)", backgroundSize: "24px 24px" }}>
            {PIPELINE_NODES.map((node, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center" }}>
                <div style={{
                  background: `rgba(${node.color === '#6366f1' ? '99,102,241' : node.color === '#8b5cf6' ? '139,92,246' : node.color === '#f59e0b' ? '245,158,11' : node.color === '#06b6d4' ? '6,182,212' : node.color === '#a855f7' ? '168,85,247' : '34,197,94'}, 0.12)`,
                  border: `1px solid ${node.color}44`,
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#e2e8f0",
                  whiteSpace: "nowrap",
                  boxShadow: `0 4px 20px ${node.color}22`,
                  minWidth: 130,
                  textAlign: "center",
                  transition: "all 0.2s",
                }}>
                  {node.label}
                  <div style={{ marginTop: 6, height: 2, borderRadius: 1, background: `linear-gradient(90deg, ${node.color}, transparent)` }} />
                </div>
                {i < PIPELINE_NODES.length - 1 && (
                  <div style={{ display: "flex", alignItems: "center", padding: "0 6px" }}>
                    <div style={{ width: 20, height: 1, background: "rgba(99,102,241,0.4)" }} />
                    <div style={{ width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: "6px solid rgba(99,102,241,0.6)" }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Status bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: "1px solid rgba(99,102,241,0.1)", background: "rgba(8,12,20,0.8)", fontSize: 11, color: "#475569" }}>
            <span className="badge badge-success">● Pipeline Ready</span>
            <span>6 nodes • 5 connections • Last run: 4.9s</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto 100px", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <h2 style={{ fontSize: 38, fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -1 }}>
            Everything to <span className="gradient-text">Scale AI Workflows</span>
          </h2>
          <p style={{ color: "#64748b", marginTop: 12, fontSize: 15 }}>From data to deployed model, all in one canvas.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="glass-card" style={{ padding: 28, animationDelay: `${i * 0.08}s` }}>
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
      <section style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "80px 20px", borderTop: "1px solid rgba(99,102,241,0.1)" }}>
        <div className="animate-pulse-glow" style={{ display: "inline-block", borderRadius: 24, padding: "60px 60px", background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -1, marginBottom: 16 }}>
            Ready to build your first <span className="gradient-text">pipeline?</span>
          </h2>
          <p style={{ color: "#64748b", marginBottom: 32, fontSize: 15 }}>Free to use. No credit card required.</p>
          <button className="btn-primary" onClick={() => navigate("/register")} style={{ padding: "14px 36px", fontSize: 16, borderRadius: 12 }}>
            Start Building Now →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "24px", borderTop: "1px solid rgba(99,102,241,0.08)", fontSize: 12, color: "#334155" }}>
        © 2026 Neural Canvas · Built for Next-Gen Machine Learning Engineering
      </footer>
    </div>
  );
}
