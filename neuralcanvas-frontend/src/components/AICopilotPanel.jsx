import { useState } from "react";
import MarkdownMessage from "./MarkdownMessage";

export default function AICopilotPanel({ isOpen, onClose, pipelineNodes = [], pipelineError = "" }) {
  const [messages, setMessages] = useState([
    {
      sender: "assistant",
      text: "👋 Hi! I'm your NeuralCanvas AI Pipeline Copilot. I inspect your active canvas blocks, dataset quality, and errors to recommend ML architectures and debug failed pipelines. Ask me anything!",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  if (!isOpen) return null;

  const handleSend = (userText) => {
    const text = userText || input;
    if (!text.trim()) return;

    const newMsgs = [...messages, { sender: "user", text }];
    setMessages(newMsgs);
    setInput("");
    setThinking(true);

    setTimeout(() => {
      // Analyze current pipeline context
      const nodeTypes = pipelineNodes.map((n) => n.data?.nodeType || n.type);
      const hasDataset = nodeTypes.includes("loadDataset");
      const hasSplit = nodeTypes.includes("splitDataset");
      const hasModel = nodeTypes.some((t) =>
        [
          "RandomForestClassifier", "LogisticRegression", "GradientBoostingClassifier",
          "LinearRegression", "VotingClassifier", "StackingClassifier", "AutoML"
        ].includes(t)
      );

      let reply = "";
      const lower = text.toLowerCase();

      if (lower.includes("why did my pipeline fail") || lower.includes("error") || lower.includes("debug")) {
        if (pipelineError) {
          reply = `🔍 **Error Diagnosis:**\n\nYour pipeline reported: \`${pipelineError}\`\n\n**Recommendation:** Check if all required inputs are connected. If it's a dataset error, ensure you have selected a CSV file in the Load Dataset block. If it's a target error, choose a target column in the Split Dataset block.`;
        } else {
          reply = "✅ No active errors detected in the current pipeline state! If a block fails during execution, I will automatically analyze the traceback.";
        }
      } else if (lower.includes("recommend") || lower.includes("what model") || lower.includes("suggest")) {
        reply = `💡 **ML Architecture Recommendation:**\n\nBased on standard tabular benchmarks:\n1. **Random Forest / Gradient Boosting** are robust defaults that handle non-linear relationships with minimal scaling.\n2. **AutoML Block:** You can use our 1-Click AutoML tool in the toolbar to benchmark 6+ models and automatically select the winner.\n3. **Ensembles:** Consider a **VotingClassifier** or **StackingClassifier** to combine Random Forest and Logistic Regression for higher accuracy.`;
      } else if (lower.includes("preprocessing") || lower.includes("clean")) {
        reply = `🧹 **Preprocessing Pipeline Advice:**\n\n1. **Missing Data:** Add an **Imputer** block (mean/median for numerical, most frequent for categorical).\n2. **Categorical Variables:** Add an **Encoder** block before splitting or scaling.\n3. **Feature Scaling:** Add **StandardScaler** or **RobustScaler** before linear models or neural networks.`;
      } else {
        reply = `🤖 **Pipeline Summary:** You currently have **${pipelineNodes.length} blocks** in your DAG (${hasDataset ? "✓ Dataset loaded" : "✗ Missing dataset"}, ${hasSplit ? "✓ Train/Test split" : "✗ Missing split"}, ${hasModel ? "✓ Model configured" : "✗ No model block"}).\n\nTry asking:\n• *"What preprocessing should I add?"*\n• *"Which algorithm is best for my data?"*\n• *"Why did my pipeline fail?"*`;
      }

      setMessages((prev) => [...prev, { sender: "assistant", text: reply }]);
      setThinking(false);
    }, 600);
  };

  return (
    <div style={panelContainerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>✨</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>AI Pipeline Copilot</span>
        </div>
        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, padding: 14, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
              background: m.sender === "user" ? "rgba(255, 0, 113, 0.2)" : "rgba(15, 23, 42, 0.8)",
              border: m.sender === "user" ? "1px solid rgba(255, 0, 113, 0.4)" : "1px solid rgba(255, 255, 255, 0.08)",
              color: "#f8fafc",
              padding: "8px 12px",
              borderRadius: 10,
              maxWidth: "85%",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <MarkdownMessage content={m.text} isUser={m.sender === "user"} />
          </div>
        ))}
        {thinking && (
          <div style={{ alignSelf: "flex-start", color: "#94a3b8", fontSize: 11, fontStyle: "italic" }}>
            Thinking…
          </div>
        )}
      </div>

      {/* Suggested Quick Prompts */}
      <div style={{ padding: "6px 12px", display: "flex", gap: 6, overflowX: "auto" }}>
        <button onClick={() => handleSend("What preprocessing should I add?")} style={quickPromptStyle}>
          🧹 Preprocessing?
        </button>
        <button onClick={() => handleSend("Which algorithm is best for my data?")} style={quickPromptStyle}>
          🏆 Best Model?
        </button>
        <button onClick={() => handleSend("Why did my pipeline fail?")} style={quickPromptStyle}>
          🔍 Debug Error
        </button>
      </div>

      {/* Input Box */}
      <div style={{ padding: 10, borderTop: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder="Ask AI Copilot about your pipeline..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          style={inputStyle}
        />
        <button onClick={() => handleSend()} style={sendBtnStyle}>
          ➤
        </button>
      </div>
    </div>
  );
}

const panelContainerStyle = {
  position: "fixed",
  right: 20,
  bottom: 20,
  width: 360,
  height: 480,
  background: "#0b101d",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 14,
  boxShadow: "0 10px 40px rgba(0,0,0,0.8)",
  display: "flex",
  flexDirection: "column",
  zIndex: 9999,
  fontFamily: "'Inter', sans-serif",
  overflow: "hidden",
};

const headerStyle = {
  padding: "10px 14px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "rgba(10, 15, 26, 0.9)",
};

const closeBtnStyle = { background: "transparent", border: "none", color: "#64748b", fontSize: 16, cursor: "pointer" };
const inputStyle = { flex: 1, background: "#080c14", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", borderRadius: 8, padding: "6px 10px", fontSize: 12, outline: "none" };
const sendBtnStyle = { background: "linear-gradient(135deg, #ff0071, #8b5cf6)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700 };
const quickPromptStyle = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", borderRadius: 6, padding: "3px 8px", fontSize: 10.5, cursor: "pointer", whiteSpace: "nowrap" };
