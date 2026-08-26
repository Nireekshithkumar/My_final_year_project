import { useState } from "react";

export const STARTER_TEMPLATES = [
  {
    id: "churn_classifier",
    title: "Customer Churn Classifier",
    category: "Classification",
    difficulty: "Beginner",
    icon: "👥",
    color: "#ff0071",
    description: "End-to-end classification pipeline for predicting customer churn. Handles missing values, encodes categories, splits data 80/20, trains Random Forest, and outputs evaluation metrics + live API.",
    nodes: [
      {
        id: "node_1",
        type: "taskNode",
        position: { x: 60, y: 220 },
        data: {
          title: "Start Pipeline",
          nodeType: "start",
          icon: "▶",
          iconColor: "#22c55e",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_2",
        type: "taskNode",
        position: { x: 300, y: 220 },
        data: {
          title: "Load Dataset",
          nodeType: "loadDataset",
          icon: "📂",
          iconColor: "#ff0071",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_3",
        type: "taskNode",
        position: { x: 540, y: 220 },
        data: {
          title: "Missing Imputer",
          nodeType: "Imputer",
          icon: "🩹",
          iconColor: "#06b6d4",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: { strategy: "mean" },
          status: "idle",
        },
      },
      {
        id: "node_4",
        type: "taskNode",
        position: { x: 780, y: 220 },
        data: {
          title: "Categorical Encoder",
          nodeType: "Encoder",
          icon: "🔠",
          iconColor: "#a855f7",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: { method: "label" },
          status: "idle",
        },
      },
      {
        id: "node_5",
        type: "taskNode",
        position: { x: 1020, y: 220 },
        data: {
          title: "Split Dataset (80/20)",
          nodeType: "splitDataset",
          icon: "✂",
          iconColor: "#f59e0b",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: { test_size: 0.2, target: "churn" },
          status: "idle",
        },
      },
      {
        id: "node_6",
        type: "taskNode",
        position: { x: 1260, y: 220 },
        data: {
          title: "Random Forest",
          nodeType: "RandomForestClassifier",
          icon: "🌲",
          iconColor: "#6366f1",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: { n_estimators: 100, max_depth: 10 },
          status: "idle",
        },
      },
      {
        id: "node_7",
        type: "taskNode",
        position: { x: 1500, y: 220 },
        data: {
          title: "Evaluate Metrics",
          nodeType: "evaluate",
          icon: "📊",
          iconColor: "#ff85be",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_8",
        type: "taskNode",
        position: { x: 1740, y: 220 },
        data: {
          title: "Live Predict API",
          nodeType: "predict",
          icon: "🎯",
          iconColor: "#22c55e",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: { mode: "test_split" },
          status: "idle",
        },
      },
      {
        id: "node_9",
        type: "taskNode",
        position: { x: 1980, y: 220 },
        data: {
          title: "End Workflow",
          nodeType: "end",
          icon: "■",
          iconColor: "#ef4444",
          outputs: [],
          params: {},
          status: "idle",
        },
      },
    ],
  },
  {
    id: "price_regressor",
    title: "House Price Regressor",
    category: "Regression",
    difficulty: "Intermediate",
    icon: "🏠",
    color: "#06b6d4",
    description: "Regression architecture for numerical forecasting. Standardizes feature distributions, removes outliers, trains a Gradient Boosting Regressor, and generates R²/RMSE evaluation curves.",
    nodes: [
      {
        id: "node_1",
        type: "taskNode",
        position: { x: 60, y: 220 },
        data: {
          title: "Start Pipeline",
          nodeType: "start",
          icon: "▶",
          iconColor: "#22c55e",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_2",
        type: "taskNode",
        position: { x: 300, y: 220 },
        data: {
          title: "Load Dataset",
          nodeType: "loadDataset",
          icon: "📂",
          iconColor: "#ff0071",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_3",
        type: "taskNode",
        position: { x: 540, y: 220 },
        data: {
          title: "Standard Scaler",
          nodeType: "StandardScaler",
          icon: "📏",
          iconColor: "#3b82f6",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_4",
        type: "taskNode",
        position: { x: 780, y: 220 },
        data: {
          title: "Split Dataset (80/20)",
          nodeType: "splitDataset",
          icon: "✂",
          iconColor: "#f59e0b",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: { test_size: 0.2, target: "price" },
          status: "idle",
        },
      },
      {
        id: "node_5",
        type: "taskNode",
        position: { x: 1020, y: 220 },
        data: {
          title: "Gradient Boosting",
          nodeType: "GradientBoostingRegressor",
          icon: "⚡",
          iconColor: "#0ea5e9",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: { n_estimators: 100, learning_rate: 0.1 },
          status: "idle",
        },
      },
      {
        id: "node_6",
        type: "taskNode",
        position: { x: 1260, y: 220 },
        data: {
          title: "Evaluate Metrics",
          nodeType: "evaluate",
          icon: "📊",
          iconColor: "#ff85be",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_7",
        type: "taskNode",
        position: { x: 1500, y: 220 },
        data: {
          title: "End Workflow",
          nodeType: "end",
          icon: "■",
          iconColor: "#ef4444",
          outputs: [],
          params: {},
          status: "idle",
        },
      },
    ],
  },
  {
    id: "automl_benchmark",
    title: "1-Click AutoML Benchmark Suite",
    category: "AutoML",
    difficulty: "Advanced",
    icon: "⚡",
    color: "#a855f7",
    description: "Automated Machine Learning pipeline that trains and benchmarks multiple algorithms simultaneously (RandomForest, XGBoost, LightGBM, GradientBoosting) to select the champion model.",
    nodes: [
      {
        id: "node_1",
        type: "taskNode",
        position: { x: 60, y: 220 },
        data: {
          title: "Start Pipeline",
          nodeType: "start",
          icon: "▶",
          iconColor: "#22c55e",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_2",
        type: "taskNode",
        position: { x: 300, y: 220 },
        data: {
          title: "Load Dataset",
          nodeType: "loadDataset",
          icon: "📂",
          iconColor: "#ff0071",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_3",
        type: "taskNode",
        position: { x: 540, y: 220 },
        data: {
          title: "Categorical Encoder",
          nodeType: "Encoder",
          icon: "🔠",
          iconColor: "#a855f7",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: { method: "label" },
          status: "idle",
        },
      },
      {
        id: "node_4",
        type: "taskNode",
        position: { x: 780, y: 220 },
        data: {
          title: "Standard Scaler",
          nodeType: "StandardScaler",
          icon: "📏",
          iconColor: "#3b82f6",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_5",
        type: "taskNode",
        position: { x: 1020, y: 220 },
        data: {
          title: "Split Dataset",
          nodeType: "splitDataset",
          icon: "✂",
          iconColor: "#f59e0b",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: { test_size: 0.2 },
          status: "idle",
        },
      },
      {
        id: "node_6",
        type: "taskNode",
        position: { x: 1260, y: 220 },
        data: {
          title: "AutoML Engine",
          nodeType: "AutoML",
          icon: "🤖",
          iconColor: "#ec4899",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: { task: "classification", time_budget: 30 },
          status: "idle",
        },
      },
      {
        id: "node_7",
        type: "taskNode",
        position: { x: 1500, y: 220 },
        data: {
          title: "Evaluate Metrics",
          nodeType: "evaluate",
          icon: "📊",
          iconColor: "#ff85be",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_8",
        type: "taskNode",
        position: { x: 1740, y: 220 },
        data: {
          title: "End Workflow",
          nodeType: "end",
          icon: "■",
          iconColor: "#ef4444",
          outputs: [],
          params: {},
          status: "idle",
        },
      },
    ],
  },
  {
    id: "clustering_segmentation",
    title: "Customer Segmentation (K-Means)",
    category: "Clustering",
    difficulty: "Beginner",
    icon: "🎯",
    color: "#10b981",
    description: "Unsupervised clustering workflow that scales numeric features with RobustScaler, identifies optimal clusters using KMeans, and plots cluster distributions.",
    nodes: [
      {
        id: "node_1",
        type: "taskNode",
        position: { x: 60, y: 220 },
        data: {
          title: "Start Pipeline",
          nodeType: "start",
          icon: "▶",
          iconColor: "#22c55e",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_2",
        type: "taskNode",
        position: { x: 300, y: 220 },
        data: {
          title: "Load Dataset",
          nodeType: "loadDataset",
          icon: "📂",
          iconColor: "#ff0071",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_3",
        type: "taskNode",
        position: { x: 540, y: 220 },
        data: {
          title: "Robust Scaler",
          nodeType: "RobustScaler",
          icon: "🛡️",
          iconColor: "#059669",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_4",
        type: "taskNode",
        position: { x: 780, y: 220 },
        data: {
          title: "K-Means Clustering",
          nodeType: "KMeans",
          icon: "🔵",
          iconColor: "#10b981",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: { n_clusters: 3 },
          status: "idle",
        },
      },
      {
        id: "node_5",
        type: "taskNode",
        position: { x: 1020, y: 220 },
        data: {
          title: "Correlation Matrix",
          nodeType: "Correlation",
          icon: "📈",
          iconColor: "#f59e0b",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_6",
        type: "taskNode",
        position: { x: 1260, y: 220 },
        data: {
          title: "End Workflow",
          nodeType: "end",
          icon: "■",
          iconColor: "#ef4444",
          outputs: [],
          params: {},
          status: "idle",
        },
      },
    ],
  },
  {
    id: "ensemble_stacking",
    title: "Ensemble Stacking Classifier",
    category: "Ensemble",
    difficulty: "Advanced",
    icon: "🥞",
    color: "#6366f1",
    description: "High-accuracy meta-learning pipeline. Combines predictions from Random Forest, Gradient Boosting, and Logistic Regression via Stacking to minimize bias and variance.",
    nodes: [
      {
        id: "node_1",
        type: "taskNode",
        position: { x: 60, y: 220 },
        data: {
          title: "Start Pipeline",
          nodeType: "start",
          icon: "▶",
          iconColor: "#22c55e",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_2",
        type: "taskNode",
        position: { x: 300, y: 220 },
        data: {
          title: "Load Dataset",
          nodeType: "loadDataset",
          icon: "📂",
          iconColor: "#ff0071",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_3",
        type: "taskNode",
        position: { x: 540, y: 220 },
        data: {
          title: "Categorical Encoder",
          nodeType: "Encoder",
          icon: "🔠",
          iconColor: "#a855f7",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: { method: "label" },
          status: "idle",
        },
      },
      {
        id: "node_4",
        type: "taskNode",
        position: { x: 780, y: 220 },
        data: {
          title: "Standard Scaler",
          nodeType: "StandardScaler",
          icon: "📏",
          iconColor: "#3b82f6",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_5",
        type: "taskNode",
        position: { x: 1020, y: 220 },
        data: {
          title: "Split Dataset (80/20)",
          nodeType: "splitDataset",
          icon: "✂",
          iconColor: "#f59e0b",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: { test_size: 0.2 },
          status: "idle",
        },
      },
      {
        id: "node_6",
        type: "taskNode",
        position: { x: 1260, y: 220 },
        data: {
          title: "Stacking Classifier",
          nodeType: "StackingClassifier",
          icon: "🥞",
          iconColor: "#6366f1",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_7",
        type: "taskNode",
        position: { x: 1500, y: 220 },
        data: {
          title: "Evaluate Metrics",
          nodeType: "evaluate",
          icon: "📊",
          iconColor: "#ff85be",
          outputs: [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: {},
          status: "idle",
        },
      },
      {
        id: "node_8",
        type: "taskNode",
        position: { x: 1740, y: 220 },
        data: {
          title: "End Workflow",
          nodeType: "end",
          icon: "■",
          iconColor: "#ef4444",
          outputs: [],
          params: {},
          status: "idle",
        },
      },
    ],
  },
];

function generateSequentialEdges(nodes) {
  const edges = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const src = nodes[i];
    const tgt = nodes[i + 1];
    edges.push({
      id: `e_${src.id}_${tgt.id}`,
      source: src.id,
      target: tgt.id,
      sourceHandle: src.data?.outputs?.[0]?.id || "next",
      targetHandle: "input",
      type: "smoothstep",
      animated: true,
      style: { stroke: "#ff0071", strokeWidth: 2 },
    });
  }
  return edges;
}

export default function TemplatesModal({ isOpen, onClose, onSelectTemplate }) {
  const [selectedCategory, setSelectedCategory] = useState("All");

  if (!isOpen) return null;

  const categories = ["All", "Classification", "Regression", "AutoML", "Clustering", "Ensemble"];
  const filtered = selectedCategory === "All"
    ? STARTER_TEMPLATES
    : STARTER_TEMPLATES.filter((t) => t.category === selectedCategory);

  const handleApply = (template) => {
    const nodes = JSON.parse(JSON.stringify(template.nodes));
    const edges = generateSequentialEdges(nodes);
    if (onSelectTemplate) {
      onSelectTemplate(nodes, edges, template.title);
    }
    onClose();
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        {/* Header */}
        <div style={modalHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>📚</span>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                Pipeline Starter Templates
              </h2>
              <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                1-Click production-grade ML architectures ready to train and deploy
              </p>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Category Filters */}
        <div style={{ display: "flex", gap: 8, padding: "10px 20px", background: "rgba(15, 23, 42, 0.6)", borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: selectedCategory === cat ? 700 : 500,
                background: selectedCategory === cat ? "rgba(255, 0, 113, 0.18)" : "transparent",
                color: selectedCategory === cat ? "#ff85be" : "#94a3b8",
                border: selectedCategory === cat ? "1px solid rgba(255, 0, 113, 0.35)" : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div style={{ padding: 20, overflowY: "auto", maxHeight: "calc(85vh - 140px)", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              style={{
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 12,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
                transition: "border 0.2s, transform 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = tpl.color;
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 24 }}>{tpl.icon}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ ...badgeStyle, background: `${tpl.color}22`, color: tpl.color, border: `1px solid ${tpl.color}44` }}>
                      {tpl.category}
                    </span>
                    <span style={{ ...badgeStyle, background: "rgba(255,255,255,0.06)", color: "#94a3b8" }}>
                      {tpl.difficulty}
                    </span>
                  </div>
                </div>

                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc", margin: "10px 0 6px" }}>
                  {tpl.title}
                </h3>
                <p style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
                  {tpl.description}
                </p>

                {/* Node Sequence Preview */}
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                  {tpl.nodes.map((n, idx) => (
                    <span key={n.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span
                        style={{
                          background: "rgba(255, 255, 255, 0.04)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: 4,
                          padding: "2px 6px",
                          fontSize: 10,
                          color: "#cbd5e1",
                          fontWeight: 600,
                        }}
                      >
                        {n.data.icon} {n.data.nodeType}
                      </span>
                      {idx < tpl.nodes.length - 1 && (
                        <span style={{ color: "#64748b", fontSize: 9 }}>→</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleApply(tpl)}
                style={{
                  background: `linear-gradient(135deg, ${tpl.color} 0%, #ff0071 100%)`,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  boxShadow: `0 2px 10px ${tpl.color}40`,
                }}
              >
                ⚡ Load Template onto Canvas
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.75)",
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 20,
};

const modalContentStyle = {
  background: "#0d1322",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 16,
  width: "100%",
  maxWidth: 880,
  maxHeight: "85vh",
  boxShadow: "0 20px 60px rgba(0,0,0,0.85)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  fontFamily: "'Inter', sans-serif",
};

const modalHeaderStyle = {
  padding: "16px 20px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "rgba(10, 15, 26, 0.8)",
};

const closeBtnStyle = {
  background: "transparent",
  border: "none",
  color: "#64748b",
  fontSize: 18,
  cursor: "pointer",
  padding: "4px 8px",
};

const badgeStyle = {
  padding: "2px 8px",
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.3,
};
