const SECTIONS = [
  {
    title: "Flow Control",
    items: [
      { type: "start", label: "Start Task", sub: "Begin workflow", icon: "▶", color: "#22c55e" },
      { type: "end", label: "End Task", sub: "Finish workflow", icon: "■", color: "#ef4444" },
    ],
  },
  {
    title: "Data & EDA",
    items: [
      { type: "loadDataset", label: "Load Dataset", sub: "Import data", icon: "📂", color: "#6366f1" },
      { type: "splitDataset", label: "Split Dataset", sub: "Train/test split", icon: "✂", color: "#f59e0b" },
      { type: "DescribeStats", label: "Describe", sub: "Summary statistics", icon: "📋", color: "#06b6d4" },
      { type: "Correlation", label: "Correlation", sub: "Feature correlation matrix", icon: "🔗", color: "#06b6d4" },
      { type: "MissingValues", label: "Missing Values", sub: "Detect & handle nulls", icon: "🕳", color: "#06b6d4" },
      { type: "Histogram", label: "Histogram", sub: "Distribution plot", icon: "📊", color: "#06b6d4" },
      { type: "Boxplot", label: "Boxplot", sub: "Outlier detection", icon: "📦", color: "#06b6d4" },
    ],
  },
  {
    title: "Preprocessing",
    items: [
      { type: "Encoder", label: "Encoder", sub: "Categorical → numeric", icon: "🔠", color: "#06b6d4" },
      { type: "Vectorizer", label: "Vectorizer", sub: "TF-IDF / Count NLP", icon: "📝", color: "#06b6d4" },
      { type: "StandardScaler", label: "Standard Scaler", sub: "Z-score normalize", icon: "📏", color: "#06b6d4" },
      { type: "MinMaxScaler", label: "MinMax Scaler", sub: "Scale to [0,1]", icon: "📐", color: "#06b6d4" },
      { type: "RobustScaler", label: "Robust Scaler", sub: "Outlier-robust scale", icon: "🛡", color: "#06b6d4" },
      { type: "MaxAbsScaler", label: "MaxAbs Scaler", sub: "Scale to [-1, 1]", icon: "📊", color: "#06b6d4" },
      { type: "Normalizer", label: "Normalizer", sub: "Unit norm vector", icon: "⚖", color: "#06b6d4" },
      { type: "PCA", label: "PCA", sub: "Reduce dimensions", icon: "🔻", color: "#06b6d4" },
      { type: "LabelEncoder", label: "Label Encoder", sub: "Encode categories", icon: "🏷", color: "#06b6d4" },
    ],
  },
  {
    title: "Classical ML",
    items: [
      { type: "LogisticRegression", label: "Logistic Regression", sub: "Classification", icon: "📉", color: "#8b5cf6" },
      { type: "KNeighborsClassifier", label: "KNN", sub: "K-Nearest Neighbors", icon: "🔵", color: "#8b5cf6" },
      { type: "DecisionTreeClassifier", label: "Decision Tree", sub: "Classification", icon: "🌳", color: "#8b5cf6" },
      { type: "RandomForestClassifier", label: "Random Forest", sub: "Ensemble", icon: "🌲", color: "#8b5cf6" },
      { type: "HyperparamTuning", label: "Hyperparam Tuning", sub: "Grid / Random Search", icon: "🎛", color: "#8b5cf6" },
      { type: "SVC", label: "SVM", sub: "Support Vector Machine", icon: "➗", color: "#8b5cf6" },
      { type: "GaussianNB", label: "Naive Bayes", sub: "Probabilistic", icon: "🎲", color: "#8b5cf6" },
      { type: "LinearRegression", label: "Linear Regression", sub: "Regression", icon: "📈", color: "#a855f7" },
    ],
  },
  {
    title: "Deep Learning",
    items: [
      { type: "DenseNN", label: "ANN", sub: "Dense Neural Net", icon: "🧠", color: "#ec4899" },
      { type: "CNN", label: "CNN", sub: "Convolutional Net", icon: "🖼", color: "#ec4899" },
      { type: "RNN", label: "RNN", sub: "Recurrent Net", icon: "🔁", color: "#ec4899" },
      { type: "LSTM", label: "LSTM", sub: "Long Short-Term Memory", icon: "🧬", color: "#ec4899" },
      { type: "GRU", label: "GRU", sub: "Gated Recurrent Unit", icon: "⚙", color: "#ec4899" },
      { type: "Autoencoder", label: "Autoencoder", sub: "Reconstruction", icon: "♻", color: "#ec4899" },
    ],
  },
  {
    title: "Evaluation & Output",
    items: [
      { type: "evaluate", label: "Evaluate", sub: "Metrics & scoring", icon: "📊", color: "#0ea5e9" },
      { type: "predict", label: "Predict", sub: "Run inference", icon: "🎯", color: "#22c55e" },
      { type: "plot", label: "Plot", sub: "Visualize results", icon: "📈", color: "#eab308" },
      { type: "SaveModel", label: "Save Model", sub: "Export & download", icon: "💾", color: "#3b82f6" },
    ],
  },
];

export default function NodePalette() {
  const onDragStart = (e, item) => {
    e.dataTransfer.setData("application/reactflow-type", item.type);
    e.dataTransfer.setData("application/reactflow-label", item.label);
    e.dataTransfer.setData("application/reactflow-color", item.color);
    e.dataTransfer.setData("application/reactflow-icon", item.icon);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside style={{
      width: 200,
      background: "rgba(8,12,20,0.95)",
      borderRight: "1px solid rgba(99,102,241,0.12)",
      padding: "14px 10px",
      overflowY: "auto",
      height: "100%",
      backdropFilter: "blur(10px)",
    }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: "#f1f5f9", fontFamily: "'Space Grotesk', sans-serif", marginBottom: 2 }}>
        Node Library
      </div>
      <div style={{ fontSize: 10.5, color: "#475569", marginBottom: 14 }}>Drag nodes onto the canvas</div>

      {SECTIONS.map((section) => (
        <div key={section.title} style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 9.5, fontWeight: 700, color: "#475569",
            textTransform: "uppercase", letterSpacing: 0.8,
            marginBottom: 7, paddingLeft: 4,
          }}>
            {section.title}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {section.items.map((item) => (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => onDragStart(e, item)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 9px",
                  border: `1px solid ${item.color}20`,
                  borderRadius: 8, cursor: "grab",
                  background: `${item.color}08`,
                  userSelect: "none",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${item.color}18`;
                  e.currentTarget.style.borderColor = `${item.color}40`;
                  e.currentTarget.style.transform = "translateX(2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `${item.color}08`;
                  e.currentTarget.style.borderColor = `${item.color}20`;
                  e.currentTarget.style.transform = "translateX(0)";
                }}
              >
                <span style={{ fontSize: 15, lineHeight: 1 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.2 }}>{item.label}</div>
                  <div style={{ fontSize: 9.5, color: "#475569", lineHeight: 1.3 }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}