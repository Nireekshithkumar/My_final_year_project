const SECTIONS = [
  {
    title: "Flow Control",
    items: [
      { type: "start", label: "Start Task", sub: "Begin workflow", icon: "▶", color: "#16a34a" },
      { type: "end", label: "End Task", sub: "Finish workflow", icon: "■", color: "#dc2626" },
    ],
  },
  {
    title: "Data & EDA",
    items: [
      { type: "loadDataset", label: "Load Dataset", sub: "Import data", icon: "📂", color: "#2563eb" },
      { type: "splitDataset", label: "Split Dataset", sub: "Train/test split", icon: "✂", color: "#f59e0b" },
      { type: "DescribeStats", label: "Describe", sub: "Summary statistics", icon: "📋", color: "#0891b2" },
      { type: "Correlation", label: "Correlation", sub: "Feature correlation matrix", icon: "🔗", color: "#0891b2" },
      { type: "MissingValues", label: "Missing Values", sub: "Detect & handle nulls", icon: "🕳", color: "#0891b2" },
      { type: "Histogram", label: "Histogram", sub: "Distribution plot", icon: "📊", color: "#0891b2" },
      { type: "Boxplot", label: "Boxplot", sub: "Outlier detection", icon: "📦", color: "#0891b2" },
    ],
  },
  {
    title: "Preprocessing",
    items: [
      { type: "Encoder", label: "Encoder", sub: "Categorical → numeric", icon: "🔠", color: "#0891b2" },
      { type: "StandardScaler", label: "Standard Scaler", sub: "Z-score normalize", icon: "📏", color: "#0891b2" },
      { type: "MinMaxScaler", label: "MinMax Scaler", sub: "Scale to [0,1]", icon: "📐", color: "#0891b2" },
      { type: "PCA", label: "PCA", sub: "Reduce dimensions", icon: "🔻", color: "#0891b2" },
      { type: "LabelEncoder", label: "Label Encoder", sub: "Encode categories", icon: "🏷", color: "#0891b2" },
    ],
  },
  {
    title: "Classical ML",
    items: [
      { type: "LogisticRegression", label: "Logistic Regression", sub: "Classification", icon: "📉", color: "#8b5cf6" },
      { type: "KNeighborsClassifier", label: "KNN", sub: "K-Nearest Neighbors", icon: "🔵", color: "#8b5cf6" },
      { type: "DecisionTreeClassifier", label: "Decision Tree", sub: "Classification", icon: "🌳", color: "#8b5cf6" },
      { type: "RandomForestClassifier", label: "Random Forest", sub: "Ensemble", icon: "🌲", color: "#8b5cf6" },
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
      { type: "predict", label: "Predict", sub: "Run inference", icon: "🎯", color: "#16a34a" },
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
    <aside style={s.sidebar}>
      <div style={s.header}>Node Library</div>
      <div style={s.subheader}>Drag nodes onto the canvas</div>

      {SECTIONS.map((section) => (
        <div key={section.title} style={{ marginBottom: 16 }}>
          <div style={s.sectionTitle}>{section.title}</div>
          <div style={s.list}>
            {section.items.map((item) => (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => onDragStart(e, item)}
                style={s.card}
              >
                <div style={{ ...s.iconWrap, color: item.color }}>{item.icon}</div>
                <div>
                  <div style={s.label}>{item.label}</div>
                  <div style={s.sub}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}

const s = {
  sidebar: { width: 210, background: "#fff", borderRight: "1px solid #e2e8f0", padding: 14, overflowY: "auto", height: "100%" },
  header: { fontWeight: 700, fontSize: 14, color: "#1e293b" },
  subheader: { fontSize: 11, color: "#94a3b8", marginBottom: 14 },
  sectionTitle: { fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  card: { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "grab", background: "#fff", userSelect: "none" },
  iconWrap: { fontSize: 18 },
  label: { fontSize: 12.5, fontWeight: 600, color: "#334155" },
  sub: { fontSize: 10.5, color: "#94a3b8" },
};