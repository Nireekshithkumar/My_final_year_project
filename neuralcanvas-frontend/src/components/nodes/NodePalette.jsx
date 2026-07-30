// src/components/NodePalette.jsx
const PALETTE = [
  { type: "start", label: "Start Task", icon: "▶", color: "#16a34a" },
  { type: "end", label: "End Task", icon: "■", color: "#dc2626" },
  { type: "user", label: "User Task", icon: "👤", color: "#2563eb" },
  { type: "approval", label: "Approval Task", icon: "✔", color: "#0ea5e9" },
  { type: "invoice", label: "Invoice Task", icon: "🧾", color: "#f59e0b" },
  { type: "ai", label: "AI Task", icon: "✨", color: "#8b5cf6" },
  { type: "decision", label: "Decision Task", icon: "⤨", color: "#f97316" },
  { type: "decisionTable", label: "Decision Table", icon: "▦", color: "#64748b" },
  { type: "webService", label: "Web Service Task", icon: "🌐", color: "#0891b2" },
  { type: "email", label: "Email Task", icon: "✉", color: "#eab308" },
  { type: "emailStatus", label: "Email Status", icon: "✓", color: "#22c55e" },
  { type: "delay", label: "Delay Timer", icon: "⏱", color: "#f59e0b" },
  { type: "db", label: "DB Task", icon: "🗄", color: "#3b82f6" },
  { type: "callWorkflow", label: "Call Another Workflow", icon: "⇄", color: "#475569" },
  { type: "compute", label: "Compute task", icon: "⊕", color: "#16a34a" },
  { type: "sms", label: "SMS Task", icon: "💬", color: "#eab308" },
];

export default function NodePalette({ onAdd }) {
  return (
    <aside style={styles.sidebar}>
      <div style={styles.grid}>
        {PALETTE.map((item) => (
          <button
            key={item.type}
            style={styles.card}
            onClick={() => onAdd(item)}
            title={item.label}
          >
            <div style={{ ...styles.iconWrap, color: item.color }}>{item.icon}</div>
            <span style={styles.label}>{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: 170, background: "#fff", borderRight: "1px solid #e2e8f0",
    padding: 10, overflowY: "auto",
  },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  card: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 6, padding: "10px 4px", background: "#fff",
    border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer",
    fontFamily: "Inter, sans-serif",
  },
  iconWrap: { fontSize: 20 },
  label: { fontSize: 10.5, color: "#334155", textAlign: "center" },
};