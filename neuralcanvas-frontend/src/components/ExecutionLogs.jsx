import { useEffect, useRef, useState } from "react";

// ─── Log row classifier ───────────────────────────────────────────────────────
function classifyLog(message) {
  const m = message.toLowerCase();
  if (m.includes("error") || m.includes("failed") || m.includes("exception") || m.includes("traceback")) return "error";
  if (m.includes("warning") || m.includes("warn")) return "warning";
  if (m.includes("success") || m.includes("completed") || m.includes("finished") || m.includes("done")) return "success";
  if (m.includes("accuracy") || m.includes("r2") || m.includes("f1") || m.includes("precision") || m.includes("recall") || m.includes("rmse") || m.includes("mae")) return "metric";
  if (m.includes("running") || m.includes("starting") || m.includes("processing") || m.includes("executing")) return "running";
  if (m.includes("info") || m.includes("→") || m.includes("block")) return "info";
  return "default";
}

const LOG_STYLES = {
  error:   { color: "#fca5a5", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   icon: "✕", label: "ERROR",   labelColor: "#ef4444" },
  warning: { color: "#fcd34d", bg: "rgba(234,179,8,0.07)",   border: "rgba(234,179,8,0.2)",    icon: "⚠", label: "WARN",    labelColor: "#eab308" },
  success: { color: "#86efac", bg: "rgba(34,197,94,0.06)",   border: "rgba(34,197,94,0.2)",    icon: "✓", label: "OK",      labelColor: "#22c55e" },
  metric:  { color: "#ff85be", bg: "rgba(255,0,113,0.08)",   border: "rgba(255,0,113,0.22)",   icon: "◈", label: "METRIC",  labelColor: "#ff0071" },
  running: { color: "#38bdf8", bg: "rgba(6,182,212,0.06)",   border: "rgba(6,182,212,0.18)",   icon: "▶", label: "RUN",     labelColor: "#06b6d4" },
  info:    { color: "#c084fc", bg: "rgba(168,85,247,0.06)",  border: "rgba(168,85,247,0.18)",  icon: "ℹ", label: "INFO",    labelColor: "#a855f7" },
  default: { color: "#94a3b8", bg: "transparent",             border: "transparent",             icon: "·", label: "",        labelColor: "#475569" },
};

// ─── Error banner component ────────────────────────────────────────────────────
function ErrorBanner({ message }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = message.length > 160;
  const displayMsg = isLong && !expanded ? message.slice(0, 160) + "…" : message;

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(185,28,28,0.08))",
      border: "1px solid rgba(239,68,68,0.35)",
      borderLeft: "3px solid #ef4444",
      borderRadius: 10,
      padding: "12px 14px",
      margin: "6px 0",
      boxShadow: "0 2px 16px rgba(239,68,68,0.12)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "rgba(239,68,68,0.2)",
          border: "1px solid rgba(239,68,68,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, fontSize: 14, marginTop: 1,
        }}>⚠</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#fca5a5", marginBottom: 4, letterSpacing: 0.3 }}>
            EXECUTION ERROR
          </div>
          <div style={{
            fontSize: 11.5, color: "#fca5a5", lineHeight: 1.65,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            wordBreak: "break-word",
          }}>
            {displayMsg}
          </div>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                marginTop: 6, padding: "3px 8px", fontSize: 10, borderRadius: 5, cursor: "pointer",
                background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                color: "#fca5a5", fontWeight: 600,
              }}
            >
              {expanded ? "Show less" : "Show full error"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Log Row ──────────────────────────────────────────────────────────────────
function LogRow({ log, index }) {
  const isObj = typeof log === "object" && log !== null;
  const message = isObj ? (log.message || JSON.stringify(log)) : String(log);
  const timestamp = isObj && log.timestamp ? log.timestamp : "";
  const stage = isObj && log.stage ? log.stage : "";
  const kind = classifyLog(message);
  const s = LOG_STYLES[kind];
  const isError = kind === "error";

  if (isError) return <ErrorBanner key={index} message={message} />;

  return (
    <div style={{
      display: "flex",
      gap: 8,
      marginBottom: 3,
      padding: "3px 6px",
      borderRadius: 5,
      background: s.bg,
      border: `1px solid ${s.border}`,
      wordBreak: "break-word",
      alignItems: "flex-start",
      transition: "background 0.15s",
    }}>
      {/* Icon */}
      <span style={{ color: s.labelColor, flexShrink: 0, fontWeight: 700, fontSize: 11, width: 12, textAlign: "center", marginTop: 1 }}>
        {s.icon}
      </span>
      {/* Timestamp */}
      {timestamp && (
        <span style={{ color: "#334155", flexShrink: 0, fontSize: 10, whiteSpace: "nowrap", marginTop: 1 }}>
          {timestamp}
        </span>
      )}
      {/* Stage badge */}
      {stage && (
        <span style={{
          padding: "1px 5px", borderRadius: 4, fontSize: 9.5, fontWeight: 800,
          background: `${s.labelColor}22`, color: s.labelColor,
          flexShrink: 0, letterSpacing: 0.5, marginTop: 1, whiteSpace: "nowrap",
        }}>
          {stage}
        </span>
      )}
      {/* Message */}
      <span style={{ color: s.color, fontSize: 11.5, lineHeight: 1.6 }}>{message}</span>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ExecutionLogs({ logs = [], isRunning = false, progress = 0, onClearLogs, pipelineId }) {
  const [filter, setFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const logEndRef = useRef(null);

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter(log => {
    const isObj = typeof log === "object" && log !== null;
    const text = isObj ? `${log.message || ""} ${log.stage || ""}` : String(log);
    const textLower = text.toLowerCase();

    // Level filter
    if (levelFilter !== "all") {
      const kind = classifyLog(text);
      if (kind !== levelFilter) return false;
    }

    // Text filter
    if (filter.trim() && !textLower.includes(filter.toLowerCase())) return false;

    return true;
  });

  const errorCount = logs.filter(l => {
    const m = typeof l === "object" ? l.message || "" : String(l);
    return classifyLog(m) === "error";
  }).length;

  const handleCopy = () => {
    const rawText = logs
      .map(l => (typeof l === "string" ? l : `[${l.timestamp || ""}] [${l.stage || "INFO"}] ${l.message || ""}`))
      .join("\n");
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "Inter, sans-serif", fontSize: 12, color: "#f1f5f9" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: 7,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            fontSize: 13,
          }}>📋</span>
          <span style={{ fontWeight: 800, fontSize: 13, color: "#f8fafc" }}>Live Execution Logs</span>
          {isRunning && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "2px 9px", borderRadius: 20,
              background: "rgba(255,0,113,0.15)", color: "#ff85be",
              fontSize: 9.5, fontWeight: 800,
              border: "1px solid rgba(255,0,113,0.35)",
              letterSpacing: 0.8,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff0071", animation: "pulseLog 1.4s infinite" }} />
              STREAMING
            </span>
          )}
          {errorCount > 0 && !isRunning && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "2px 9px", borderRadius: 20,
              background: "rgba(239,68,68,0.12)", color: "#fca5a5",
              fontSize: 9.5, fontWeight: 800,
              border: "1px solid rgba(239,68,68,0.3)",
            }}>
              ⚠ {errorCount} error{errorCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={handleCopy} style={btnStyle("rgba(255,255,255,0.05)", "rgba(255,255,255,0.1)", "#cbd5e1")}>
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
          <button onClick={onClearLogs} style={btnStyle("rgba(239,68,68,0.08)", "rgba(239,68,68,0.22)", "#fca5a5")}>
            🗑 Clear
          </button>
        </div>
      </div>

      {/* ── Progress Bar ── */}
      {isRunning && (
        <div style={{ marginTop: 10, marginBottom: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b", marginBottom: 5 }}>
            <span>Pipeline DAG Execution</span>
            <span style={{ color: "#ff85be", fontWeight: 700 }}>{progress}%</span>
          </div>
          <div style={{ width: "100%", height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
            <div style={{
              width: `${Math.min(Math.max(progress, 5), 100)}%`,
              height: "100%",
              background: "linear-gradient(90deg, #ff0071, #8b5cf6, #06b6d4)",
              borderRadius: 3,
              transition: "width 0.35s ease",
              position: "relative",
            }}>
              <div style={{
                position: "absolute", right: 0, top: 0, bottom: 0, width: 30,
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3))",
                animation: "shimmer 1.5s infinite",
              }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div style={{ display: "flex", gap: 7, margin: "10px 0 8px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search logs…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            flex: 1, minWidth: 120,
            padding: "5px 10px",
            background: "rgba(8,12,20,0.8)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 7,
            color: "#f1f5f9",
            fontSize: 11.5,
            outline: "none",
            fontFamily: "Inter, sans-serif",
          }}
        />

        {/* Level filter pills */}
        <div style={{ display: "flex", gap: 4 }}>
          {["all", "error", "success", "metric", "running"].map(lv => (
            <button
              key={lv}
              onClick={() => setLevelFilter(lv)}
              style={{
                padding: "4px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                cursor: "pointer", textTransform: "capitalize", letterSpacing: 0.3,
                background: levelFilter === lv
                  ? lv === "error" ? "rgba(239,68,68,0.2)" : lv === "success" ? "rgba(34,197,94,0.15)" : lv === "metric" ? "rgba(255,0,113,0.15)" : "rgba(255,255,255,0.1)"
                  : "rgba(255,255,255,0.03)",
                border: levelFilter === lv ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.07)",
                color: levelFilter === lv
                  ? lv === "error" ? "#fca5a5" : lv === "success" ? "#86efac" : lv === "metric" ? "#ff85be" : "#f1f5f9"
                  : "#475569",
              }}
            >
              {lv === "all" ? "All" : lv.charAt(0).toUpperCase() + lv.slice(1)}
            </button>
          ))}
        </div>

        <button
          onClick={() => setAutoScroll(!autoScroll)}
          style={{
            padding: "4px 10px",
            background: autoScroll ? "rgba(255,0,113,0.12)" : "rgba(255,255,255,0.03)",
            border: autoScroll ? "1px solid rgba(255,0,113,0.4)" : "1px solid rgba(255,255,255,0.08)",
            color: autoScroll ? "#ff85be" : "#475569",
            borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          {autoScroll ? "⬇ Auto" : "⏸ Paused"}
        </button>
      </div>

      {/* ── Terminal View ── */}
      <div style={{
        flex: 1,
        minHeight: 260,
        background: "rgba(5,8,16,0.95)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 10,
        padding: "10px 12px",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 11.5,
        overflowY: "auto",
        lineHeight: 1.6,
        boxShadow: "inset 0 2px 8px rgba(0,0,0,0.3)",
      }}>
        {filteredLogs.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, padding: "40px 20px" }}>
            {isRunning ? (
              <>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  border: "3px solid rgba(255,0,113,0.15)",
                  borderTop: "3px solid #ff0071",
                  animation: "spinLog 0.9s linear infinite",
                }} />
                <span style={{ color: "#475569", fontSize: 12 }}>Listening for events…</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 24 }}>📋</span>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#334155", fontSize: 12, fontWeight: 600 }}>No logs yet</div>
                  <div style={{ color: "#1e293b", fontSize: 11, marginTop: 4 }}>
                    {filter || levelFilter !== "all" ? "No logs match current filter" : "Run a block or the pipeline to see logs here."}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          filteredLogs.map((log, idx) => <LogRow key={idx} log={log} index={idx} />)
        )}
        <div ref={logEndRef} />
      </div>

      {/* ── Stats Footer ── */}
      {logs.length > 0 && (
        <div style={{ display: "flex", gap: 12, paddingTop: 7, borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 2 }}>
          <span style={{ fontSize: 10, color: "#334155" }}>
            <span style={{ color: "#64748b", fontWeight: 700 }}>{logs.length}</span> total
          </span>
          <span style={{ fontSize: 10, color: "#334155" }}>
            <span style={{ color: "#86efac", fontWeight: 700 }}>{logs.filter(l => classifyLog(typeof l === "object" ? l.message || "" : String(l)) === "success").length}</span> success
          </span>
          {errorCount > 0 && (
            <span style={{ fontSize: 10, color: "#334155" }}>
              <span style={{ color: "#fca5a5", fontWeight: 700 }}>{errorCount}</span> error{errorCount !== 1 ? "s" : ""}
            </span>
          )}
          {filteredLogs.length !== logs.length && (
            <span style={{ fontSize: 10, color: "#475569" }}>
              showing <span style={{ color: "#94a3b8", fontWeight: 700 }}>{filteredLogs.length}</span>
            </span>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulseLog { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(0.8); } }
        @keyframes spinLog  { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes shimmer  { 0% { opacity:0; } 50% { opacity:1; } 100% { opacity:0; } }
      `}</style>
    </div>
  );
}

function btnStyle(bg, border, color) {
  return {
    padding: "4px 10px",
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 7,
    color,
    fontSize: 11,
    cursor: "pointer",
    fontWeight: 600,
    fontFamily: "Inter, sans-serif",
  };
}
