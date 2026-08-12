import { useState, useMemo } from "react";

const TYPE_COLORS = {
  numerical: "#0891b2",
  categorical: "#8b5cf6",
  text: "#f59e0b",
  boolean: "#16a34a",
  datetime: "#ec4899",
};

export default function FeatureSelector({ columns = [], columnTypes = {}, selected = [], onChange, dark, allowedTypes }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const c = dark ? darkColors : lightColors;

  const visibleColumns = useMemo(() => {
    return columns.filter((col) => {
      const type = columnTypes[col] || "unknown";
      if (allowedTypes && !allowedTypes.includes(type)) return false;
      if (typeFilter !== "all" && type !== typeFilter) return false;
      if (search && !col.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [columns, columnTypes, search, typeFilter, allowedTypes]);

  const toggle = (col) => {
    const next = selected.includes(col) ? selected.filter((c) => c !== col) : [...selected, col];
    onChange(next);
  };

  const selectAll = () => onChange([...new Set([...selected, ...visibleColumns])]);
  const clearAll = () => onChange(selected.filter((c) => !visibleColumns.includes(c)));

  const availableTypes = [...new Set(columns.map((c) => columnTypes[c] || "unknown"))];

  return (
    <div>
      <input
        type="text"
        placeholder="Search features..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={inputStyle(c)}
      />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
        <button onClick={() => setTypeFilter("all")} style={chipStyle(c, typeFilter === "all")}>All</button>
        {availableTypes.map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} style={chipStyle(c, typeFilter === t)}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button onClick={selectAll} style={linkBtnStyle(c)}>Select All</button>
        <button onClick={clearAll} style={linkBtnStyle(c)}>Clear All</button>
      </div>

      <div
        style={{
          display: "flex", flexDirection: "column", gap: 4,
          maxHeight: 200, overflowY: "auto",
          border: `1px solid ${c.border}`, borderRadius: 8, padding: 8,
        }}
      >
        {visibleColumns.length === 0 && (
          <span style={{ fontSize: 11, color: c.label }}>No matching features.</span>
        )}
        {visibleColumns.map((col) => {
          const type = columnTypes[col] || "unknown";
          const isSelected = selected.includes(col);
          return (
            <label
              key={col}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                fontSize: 12.5, color: c.text, cursor: "pointer",
                padding: "4px 6px", borderRadius: 4,
                background: isSelected ? (dark ? "#1e3a5f" : "#eff6ff") : "transparent",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={isSelected} onChange={() => toggle(col)} />
                {col}
              </span>
              <span
                style={{
                  fontSize: 9.5, fontWeight: 700, textTransform: "uppercase",
                  color: "#fff", background: TYPE_COLORS[type] || "#64748b",
                  borderRadius: 4, padding: "2px 6px",
                }}
              >
                {type}
              </span>
            </label>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: c.label, marginTop: 6 }}>
        {selected.length} of {columns.length} selected
      </div>
    </div>
  );
}

const inputStyle = (c) => ({
  width: "100%", padding: "6px 10px", borderRadius: 8,
  border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: 12.5,
});

const chipStyle = (c, active) => ({
  fontSize: 10.5, padding: "3px 8px", borderRadius: 12, border: `1px solid ${c.border}`,
  background: active ? "#2563eb" : "transparent", color: active ? "#fff" : c.text,
  cursor: "pointer", textTransform: "capitalize",
});

const linkBtnStyle = (c) => ({
  fontSize: 11, color: "#2563eb", background: "transparent", border: "none",
  cursor: "pointer", padding: 0, textDecoration: "underline",
});

const darkColors = { label: "#94a3b8", border: "#334155", inputBg: "#0f172a", text: "#f1f5f9" };
const lightColors = { label: "#475569", border: "#cbd5e1", inputBg: "#fff", text: "#1e293b" };