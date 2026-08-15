import { useEffect, useRef, useState } from "react";

export default function ExecutionLogs({ logs = [], isRunning = false, progress = 0, onClearLogs, pipelineId }) {
  const [filter, setFilter] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const logEndRef = useRef(null);

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    const text = typeof log === "string" ? log : `${log.message || ""} ${log.stage || ""}`;
    return text.toLowerCase().includes(q);
  });

  const handleCopy = () => {
    const rawText = logs
      .map((l) => (typeof l === "string" ? l : `[${l.timestamp || ""}] [${l.stage || "INFO"}] ${l.message || ""}`))
      .join("\n");
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "Inter, sans-serif", fontSize: 12, color: "#f1f5f9" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>📋</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#f8fafc" }}>Live Execution Logs</span>
          {isRunning && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 12, background: "rgba(255, 0, 113, 0.15)", color: "#ff85be", fontSize: 10, fontWeight: 700, border: "1px solid rgba(255, 0, 113, 0.3)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff0071", animation: "pulse-pink 1.5s infinite" }} />
              STREAMING
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={handleCopy}
            style={{
              padding: "4px 9px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 6,
              color: "#cbd5e1",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
          <button
            onClick={onClearLogs}
            style={{
              padding: "4px 9px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: 6,
              color: "#fca5a5",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            🗑 Clear
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {isRunning && (
        <div style={{ marginTop: 10, marginBottom: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#94a3b8", marginBottom: 4 }}>
            <span>DAG Pipeline Execution</span>
            <span style={{ color: "#ff85be", fontWeight: 700 }}>{progress}%</span>
          </div>
          <div style={{ width: "100%", height: 5, background: "rgba(255, 255, 255, 0.08)", borderRadius: 3, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(Math.max(progress, 5), 100)}%`,
                height: "100%",
                background: "linear-gradient(90deg, #ff0071, #8b5cf6)",
                borderRadius: 3,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Search / Filter Bar */}
      <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
        <input
          type="text"
          placeholder="Filter logs (e.g. node, error, metric)…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            flex: 1,
            padding: "5px 10px",
            background: "#111726",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 6,
            color: "#f1f5f9",
            fontSize: 11.5,
            outline: "none",
          }}
        />
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          style={{
            padding: "5px 10px",
            background: autoScroll ? "rgba(255, 0, 113, 0.15)" : "rgba(255, 255, 255, 0.04)",
            border: autoScroll ? "1px solid #ff0071" : "1px solid rgba(255, 255, 255, 0.1)",
            color: autoScroll ? "#ff85be" : "#64748b",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {autoScroll ? "⬇ Auto-scroll ON" : "⏸ Pause Scroll"}
        </button>
      </div>

      {/* Terminal View */}
      <div style={{
        flex: 1,
        minHeight: 260,
        background: "#080c14",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 8,
        padding: "10px 12px",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 11.5,
        overflowY: "auto",
        lineHeight: 1.6,
      }}>
        {filteredLogs.length === 0 ? (
          <div style={{ color: "#475569", textAlign: "center", padding: "40px 10px" }}>
            {isRunning ? "Listening for execution events…" : "No execution logs yet. Run a single block or the full pipeline to view output."}
          </div>
        ) : (
          filteredLogs.map((log, idx) => {
            const isObj = typeof log === "object" && log !== null;
            const message = isObj ? log.message || JSON.stringify(log) : String(log);
            const timestamp = isObj && log.timestamp ? log.timestamp : "";
            const stage = isObj && log.stage ? log.stage : "";

            const isError = message.toLowerCase().includes("failed") || message.toLowerCase().includes("error");
            const isSuccess = message.toLowerCase().includes("success") || message.toLowerCase().includes("completed") || message.toLowerCase().includes("finished");
            const isMetric = message.toLowerCase().includes("accuracy") || message.toLowerCase().includes("r2") || message.toLowerCase().includes("f1");

            let color = "#cbd5e1";
            if (isError) color = "#fca5a5";
            else if (isSuccess) color = "#86efac";
            else if (isMetric) color = "#ff85be";

            return (
              <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 4, wordBreak: "break-word" }}>
                {timestamp && (
                  <span style={{ color: "#475569", flexShrink: 0 }}>[{timestamp}]</span>
                )}
                {stage && (
                  <span style={{ color: "#8b5cf6", fontWeight: 600, flexShrink: 0 }}>[{stage}]</span>
                )}
                <span style={{ color }}>{message}</span>
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
