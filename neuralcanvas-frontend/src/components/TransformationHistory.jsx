import { useMemo } from "react";

export default function TransformationHistory({ nodes = [], edges = [], selectedNodeId, onSelectNode, isDark }) {
  const historyPath = useMemo(() => {
    if (!selectedNodeId || nodes.length === 0) return [];

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const path = [];
    let currentId = selectedNodeId;

    while (currentId && nodeMap.has(currentId)) {
      const node = nodeMap.get(currentId);
      path.unshift(node);

      const parentEdge = edges.find((e) => e.target === currentId);
      currentId = parentEdge ? parentEdge.source : null;
    }

    return path;
  }, [nodes, edges, selectedNodeId]);

  if (historyPath.length === 0) return null;

  const bg = isDark ? "#1e293b" : "#f8fafc";
  const border = isDark ? "#334155" : "#e2e8f0";
  const text = isDark ? "#f1f5f9" : "#0f172a";

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8, overflowX: "auto",
        padding: "6px 16px", background: bg, borderBottom: `1px solid ${border}`,
        fontSize: 12, fontFamily: "Inter, sans-serif",
      }}
    >
      <span style={{ fontWeight: 700, color: isDark ? "#94a3b8" : "#475569" }}>Path:</span>
      {historyPath.map((node, i) => {
        const isSelected = node.id === selectedNodeId;
        const status = node.data?.status || "ready";
        const isDone = status === "success";

        return (
          <div key={node.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {i > 0 && <span style={{ color: isDark ? "#475569" : "#cbd5e1" }}>→</span>}
            <button
              onClick={() => onSelectNode(node.id)}
              style={{
                background: isSelected ? "#2563eb" : isDark ? "#0f172a" : "#fff",
                color: isSelected ? "#fff" : text,
                border: `1px solid ${isSelected ? "#2563eb" : border}`,
                borderRadius: 14, padding: "3px 10px", fontSize: 11.5,
                fontWeight: isSelected ? 600 : 400, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span>{node.data?.title || node.id}</span>
              {isDone && <span style={{ color: isSelected ? "#fff" : "#22c55e" }}>✓</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}
