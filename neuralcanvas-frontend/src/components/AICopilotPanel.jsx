import { useState, useEffect, useRef } from "react";
import MarkdownMessage from "./MarkdownMessage";
import api from "../api/axios";

export default function AICopilotPanel({
  isOpen,
  onClose,
  pipelineId,
  datasetId,
  pipelineNodes = [],
  pipelineError = "",
  onApplyPipeline,
}) {
  const [messages, setMessages] = useState([
    {
      sender: "assistant",
      text: "👋 Hi! I'm your **NeuralCanvas AI Pipeline Copilot**.\n\nI can automatically design full ML pipelines, debug DAG execution errors, recommend optimal models, and explain complex hyperparameters. Ask me anything or choose a quick action below!",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [provider, setProvider] = useState("RuleEngine");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    api.get("/ai/status/")
      .then(({ data }) => {
        if (data?.active_provider) setProvider(data.active_provider);
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  if (!isOpen) return null;

  const normalizeAiNodesToCanvas = (rawNodes) => {
    if (!Array.isArray(rawNodes)) return [];
    return rawNodes.map((n) => {
      const nodeType = n.node_type || n.data?.nodeType || n.type || "start";
      const title = n.label || n.data?.title || nodeType;
      return {
        id: String(n.id || `node_${Math.floor(Math.random() * 10000)}`),
        type: "taskNode",
        position: n.position || { x: 100, y: 100 },
        data: {
          title: title,
          nodeType: nodeType,
          icon: n.icon || n.data?.icon || "⚡",
          iconColor: n.iconColor || n.data?.iconColor || "#ff0071",
          outputs: n.outputs || n.data?.outputs || [{ id: "next", label: "Connection Task", color: "#22c55e" }],
          params: n.params || n.data?.params || {},
          status: "idle",
        },
      };
    });
  };

  const generateAutoEdges = (canvasNodes) => {
    const edges = [];
    for (let i = 0; i < canvasNodes.length - 1; i++) {
      const source = canvasNodes[i];
      const target = canvasNodes[i + 1];
      const sourceHandle = source.data?.outputs?.[0]?.id || "next";
      edges.push({
        id: `e_${source.id}_${target.id}`,
        source: source.id,
        target: target.id,
        sourceHandle: sourceHandle,
        targetHandle: "input",
        type: "smoothstep",
        animated: true,
        style: { stroke: "#ff0071", strokeWidth: 2 },
      });
    }
    return edges;
  };

  const handleApplyGeneratedDAG = (rawNodes, rawEdges) => {
    if (!onApplyPipeline) return;
    const canvasNodes = normalizeAiNodesToCanvas(rawNodes);
    const canvasEdges = rawEdges && rawEdges.length > 0 ? rawEdges : generateAutoEdges(canvasNodes);
    onApplyPipeline(canvasNodes, canvasEdges);
    setMessages((prev) => [
      ...prev,
      {
        sender: "assistant",
        text: `✅ **Applied AI Pipeline to Canvas!** Added **${canvasNodes.length} connected blocks** with auto-configured hyperparameters. You can now click **Save** or **Run** in the toolbar.`,
      },
    ]);
  };

  const handleSend = async (userText) => {
    const text = userText || input;
    if (!text.trim()) return;

    const newMsgs = [...messages, { sender: "user", text }];
    setMessages(newMsgs);
    setInput("");
    setThinking(true);

    try {
      // Build conversation history for multi-turn chat
      const history = messages
        .filter((m) => m.text)
        .map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text,
        }));

      const { data } = await api.post("/ai/chat/", {
        message: text,
        dataset_id: datasetId,
        pipeline_id: pipelineId,
        history: history.slice(-6),
      });

      const replyText = data.text || data.response || "I have analyzed your request.";
      const actionType = data.action_type;
      const payload = data.payload;

      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: replyText,
          actionType: actionType,
          payload: payload,
        },
      ]);
    } catch (err) {
      // Local intelligent fallback if backend AI error occurs
      const nodeTypes = pipelineNodes.map((n) => n.data?.nodeType || n.type);
      const hasDataset = nodeTypes.includes("loadDataset");
      const hasSplit = nodeTypes.includes("splitDataset");

      let fallbackReply = "";
      const lower = text.toLowerCase();

      if (lower.includes("debug") || lower.includes("error") || lower.includes("fail")) {
        fallbackReply = pipelineError
          ? `🔍 **Error Diagnosis:**\n\nYour pipeline reported: \`${pipelineError}\`\n\n**Recommendation:** Verify all upstream nodes are connected. Ensure you selected a CSV file in Load Dataset and specified a target column in Split Dataset.`
          : "✅ No active errors detected in the current pipeline state!";
      } else if (lower.includes("recommend") || lower.includes("model")) {
        fallbackReply = `💡 **ML Architecture Recommendation:**\n\n1. **Random Forest / Gradient Boosting:** Robust defaults for tabular datasets.\n2. **AutoML:** Use the 1-Click AutoML tool in the toolbar to benchmark 6+ models automatically.\n3. **Ensembles:** Combine tree models using Voting or Stacking for maximum accuracy.`;
      } else {
        fallbackReply = `🤖 **Pipeline Status:** Currently configured with **${pipelineNodes.length} blocks** (${hasDataset ? "✓ Dataset loaded" : "✗ Missing dataset"}, ${hasSplit ? "✓ Train/Test split" : "✗ Missing split"}).`;
      }

      setMessages((prev) => [...prev, { sender: "assistant", text: fallbackReply }]);
    } finally {
      setThinking(false);
    }
  };

  const handleQuickAction = async (actionType) => {
    setThinking(true);
    try {
      let endpoint = "/ai/chat/";
      let payload = { dataset_id: datasetId, pipeline_id: pipelineId };

      if (actionType === "generate") endpoint = "/ai/generate-pipeline/";
      else if (actionType === "debug") endpoint = "/ai/debug-pipeline/";
      else if (actionType === "recommend") endpoint = "/ai/recommend-model/";
      else if (actionType === "analyze") endpoint = "/ai/analyze-dataset/";

      const { data } = await api.post(endpoint, payload);

      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: data.text || "Action executed successfully.",
          actionType: data.action_type || actionType,
          payload: data.payload,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: `⚠️ Could not complete action: ${err.response?.data?.error || err.message}`,
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div style={panelContainerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>✨</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>AI Pipeline Copilot</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>
              Engine: <span style={{ color: "#ff85be", fontWeight: 600 }}>{provider}</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, padding: 14, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
              background: m.sender === "user" ? "rgba(255, 0, 113, 0.2)" : "rgba(15, 23, 42, 0.85)",
              border: m.sender === "user" ? "1px solid rgba(255, 0, 113, 0.4)" : "1px solid rgba(255, 255, 255, 0.08)",
              color: "#f8fafc",
              padding: "10px 14px",
              borderRadius: 12,
              maxWidth: "90%",
              fontSize: 12,
              lineHeight: 1.55,
            }}
          >
            <MarkdownMessage content={m.text} isUser={m.sender === "user"} />

            {/* Render One-Click Action Card if pipeline generated */}
            {(m.actionType === "generate_pipeline" || m.payload?.nodes) && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  background: "rgba(99, 102, 241, 0.12)",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  borderRadius: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc" }}>
                  ⚡ Proposed DAG: {m.payload?.nodes?.length || 5} Blocks Configured
                </div>
                <button
                  onClick={() => handleApplyGeneratedDAG(m.payload?.nodes, m.payload?.edges)}
                  style={{
                    background: "linear-gradient(135deg, #ff0071 0%, #d90368 100%)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 12px",
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(255,0,113,0.3)",
                  }}
                >
                  ⚡ Apply Pipeline to Canvas
                </button>
              </div>
            )}
          </div>
        ))}

        {thinking && (
          <div style={{ alignSelf: "flex-start", color: "#ff85be", fontSize: 11, fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ animation: "pulse-pink 1.5s infinite" }}>⚡</span> Copilot is thinking & generating…
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Actions */}
      <div style={{ padding: "6px 12px", display: "flex", gap: 6, overflowX: "auto", borderTop: "1px solid rgba(255, 255, 255, 0.04)" }}>
        <button onClick={() => handleQuickAction("generate")} style={quickPromptStyle} title="Generate full DAG">
          ✨ Auto-DAG
        </button>
        <button onClick={() => handleQuickAction("recommend")} style={quickPromptStyle} title="Get model recommendation">
          🏆 Recommend Model
        </button>
        <button onClick={() => handleQuickAction("debug")} style={quickPromptStyle} title="Diagnose pipeline errors">
          🔍 Debug Error
        </button>
        <button onClick={() => handleQuickAction("analyze")} style={quickPromptStyle} title="Inspect dataset quality">
          📊 Dataset EDA
        </button>
      </div>

      {/* Input Box */}
      <div style={{ padding: 10, borderTop: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", gap: 8, background: "rgba(10, 15, 26, 0.95)" }}>
        <input
          type="text"
          placeholder="Ask AI Copilot (e.g. 'Build a classifier for churn')..."
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
  width: 380,
  height: 520,
  background: "#0b101d",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 14,
  boxShadow: "0 14px 50px rgba(0,0,0,0.85)",
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
  background: "rgba(10, 15, 26, 0.95)",
};

const closeBtnStyle = { background: "transparent", border: "none", color: "#64748b", fontSize: 16, cursor: "pointer" };
const inputStyle = { flex: 1, background: "#080c14", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", borderRadius: 8, padding: "7px 11px", fontSize: 12, outline: "none" };
const sendBtnStyle = { background: "linear-gradient(135deg, #ff0071, #8b5cf6)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 700 };
const quickPromptStyle = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", borderRadius: 6, padding: "4px 9px", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600 };
