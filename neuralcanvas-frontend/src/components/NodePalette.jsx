import { useState, useMemo } from "react";

const SECTIONS = [
  {
    title: "Flow Control",
    items: [
      { type: "start", label: "Start Task", sub: "Begin workflow", icon: "▶", color: "#22c55e" },
      { type: "end", label: "End Task", sub: "Finish workflow", icon: "■", color: "#ef4444" },
    ],
  },
  {
    title: "Data Ingestion",
    items: [
      { type: "loadDataset", label: "Load Dataset", sub: "Import CSV dataset", icon: "📂", color: "#ff0071" },
      { type: "splitDataset", label: "Split Dataset", sub: "Train / Test split", icon: "✂", color: "#f59e0b" },
    ],
  },
  {
    title: "EDA & Analytics",
    items: [
      { type: "DescribeStats", label: "Describe Stats", sub: "Mean, std, quartiles", icon: "📋", color: "#06b6d4" },
      { type: "Correlation", label: "Correlation Matrix", sub: "Pearson heatmap", icon: "🔗", color: "#06b6d4" },
      { type: "Histogram", label: "Histogram", sub: "Feature distribution", icon: "📊", color: "#06b6d4" },
      { type: "Boxplot", label: "Boxplot", sub: "Outlier analysis", icon: "📦", color: "#06b6d4" },
      { type: "MissingValues", label: "Missing Values", sub: "Impute null values", icon: "🕳", color: "#06b6d4" },
    ],
  },
  {
    title: "Preprocessing & NLP",
    items: [
      { type: "Encoder", label: "Encoder", sub: "One-Hot / Target encode", icon: "🔠", color: "#a855f7" },
      { type: "StandardScaler", label: "Standard Scaler", sub: "Z-score normalization", icon: "📏", color: "#a855f7" },
      { type: "MinMaxScaler", label: "MinMax Scaler", sub: "Scale range [0, 1]", icon: "📐", color: "#a855f7" },
      { type: "RobustScaler", label: "Robust Scaler", sub: "Median / IQR scaling", icon: "🛡", color: "#a855f7" },
      { type: "Vectorizer", label: "Vectorizer", sub: "TF-IDF / Count NLP", icon: "📝", color: "#a855f7" },
      { type: "Embeddings", label: "Embeddings", sub: "Dense word vectors", icon: "🧬", color: "#a855f7" },
    ],
  },
  {
    title: "ML Classification",
    items: [
      { type: "RandomForestClassifier", label: "Random Forest", sub: "Ensemble tree classifier", icon: "🌲", color: "#6366f1" },
      { type: "GradientBoostingClassifier", label: "Gradient Boosting", sub: "Boosted decision trees", icon: "⚡", color: "#6366f1" },
      { type: "LogisticRegression", label: "Logistic Regression", sub: "Linear classifier", icon: "📉", color: "#6366f1" },
      { type: "DecisionTreeClassifier", label: "Decision Tree", sub: "Single tree model", icon: "🌳", color: "#6366f1" },
      { type: "KNeighborsClassifier", label: "KNN Classifier", sub: "K-nearest neighbors", icon: "🔵", color: "#6366f1" },
      { type: "SVC", label: "SVM Classifier", sub: "Kernel hyperplanes", icon: "➗", color: "#6366f1" },
    ],
  },
  {
    title: "ML Regression",
    items: [
      { type: "LinearRegression", label: "Linear Regression", sub: "Ordinary least squares", icon: "📈", color: "#0ea5e9" },
      { type: "RandomForestRegressor", label: "RF Regressor", sub: "Random forest regression", icon: "🌲", color: "#0ea5e9" },
      { type: "GradientBoostingRegressor", label: "GB Regressor", sub: "Boosted regression", icon: "⚡", color: "#0ea5e9" },
    ],
  },
  {
    title: "Evaluation & Tuning",
    items: [
      { type: "evaluate", label: "Evaluate Metrics", sub: "Accuracy, F1, Confusion Matrix", icon: "📊", color: "#ff85be" },
      { type: "HyperparamTuning", label: "Auto Tuning", sub: "Grid / Random CV search", icon: "🎛", color: "#ec4899" },
      { type: "predict", label: "Live Predict", sub: "Inference endpoint", icon: "🎯", color: "#22c55e" },
    ],
  },
];

export default function NodePalette() {
  const [search, setSearch] = useState("");

  const onDragStart = (e, item) => {
    e.dataTransfer.setData("application/reactflow-type", item.type);
    e.dataTransfer.setData("application/reactflow-label", item.label);
    e.dataTransfer.setData("application/reactflow-color", item.color);
    e.dataTransfer.setData("application/reactflow-icon", item.icon);
    e.dataTransfer.effectAllowed = "move";
  };

  const filteredSections = useMemo(() => {
    if (!search.trim()) return SECTIONS;
    const q = search.toLowerCase();
    return SECTIONS.map((sec) => ({
      ...sec,
      items: sec.items.filter(
        (it) => it.label.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q) || it.type.toLowerCase().includes(q)
      ),
    })).filter((sec) => sec.items.length > 0);
  }, [search]);

  return (
    <aside style={{
      width: 220,
      background: "rgba(10, 15, 26, 0.95)",
      borderRight: "1px solid rgba(255, 255, 255, 0.08)",
      padding: "16px 12px",
      overflowY: "auto",
      height: "100%",
      backdropFilter: "blur(16px)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Brand Header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#ff0071",
            boxShadow: "0 0 10px #ff0071",
          }} />
          <span style={{
            fontWeight: 800,
            fontSize: 13,
            color: "#f8fafc",
            fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: 0.2,
          }}>
            Node Library
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#64748b" }}>Drag blocks to canvas</div>
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: 14 }}>
        <input
          type="text"
          placeholder="Filter nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            background: "rgba(17, 24, 39, 0.9)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            color: "#f1f5f9",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 11.5,
            outline: "none",
            transition: "all 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#ff0071")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255, 255, 255, 0.08)")}
        />
      </div>

      {/* Sections */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
        {filteredSections.map((section) => (
          <div key={section.title}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 6,
              paddingLeft: 4,
            }}>
              {section.title}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {section.items.map((item) => (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, item)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "7px 9px",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: 8,
                    cursor: "grab",
                    background: "rgba(17, 24, 39, 0.6)",
                    userSelect: "none",
                    transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 0, 113, 0.1)";
                    e.currentTarget.style.borderColor = "rgba(255, 0, 113, 0.4)";
                    e.currentTarget.style.transform = "translateX(3px)";
                    e.currentTarget.style.boxShadow = "0 4px 14px rgba(255, 0, 113, 0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(17, 24, 39, 0.6)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
                    e.currentTarget.style.transform = "translateX(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <span style={{
                    fontSize: 13,
                    width: 20,
                    height: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 5,
                    background: `${item.color}20`,
                    color: item.color,
                    flexShrink: 0,
                  }}>
                    {item.icon}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "#f1f5f9",
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {item.label}
                    </div>
                    <div style={{
                      fontSize: 9.5,
                      color: "#64748b",
                      lineHeight: 1.3,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {item.sub}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}