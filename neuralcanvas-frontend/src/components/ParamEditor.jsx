import { PARAM_SCHEMAS } from "../config/paramSchemas";
import FeatureSelector from "./FeatureSelector";

export default function ParamEditor({ nodeType, params = {}, onChange, dark, columns = [], columnTypes = {} }) {
  const schema = PARAM_SCHEMAS[nodeType];
  if (!schema || schema.length === 0) return null;

  // Trim and deduplicate columns received from backend/upstream
  const cleanColumns = Array.from(
    new Set((columns || []).map((c) => (c !== null && c !== undefined ? String(c).trim() : "")).filter(Boolean))
  );

  const cleanColumnTypes = {};
  if (columnTypes && typeof columnTypes === "object") {
    Object.entries(columnTypes).forEach(([k, v]) => {
      cleanColumnTypes[String(k).trim()] = v;
    });
  }

  const handleChange = (name, value) => {
    const sanitizedVal =
      name === "target_column" && typeof value === "string" ? value.trim() : value;
    onChange({ ...params, [name]: sanitizedVal });
  };

  const c = dark ? darkColors : lightColors;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {schema.map((field) => (
        <div key={field.name}>
          <label
            style={{
              fontSize: 12.5,
              color: c.label,
              display: "block",
              marginBottom: 6,
            }}
          >
            {field.label}
          </label>

          {/* Number */}
          {field.type === "number" && (
            <input
              type="number"
              step="any"
              placeholder={field.placeholder || ""}
              value={params[field.name] ?? field.default ?? ""}
              onChange={(e) =>
                handleChange(
                  field.name,
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
              style={inputStyle(c)}
            />
          )}

          {/* Text */}
          {field.type === "text" && (
            <input
              type="text"
              value={params[field.name] ?? field.default ?? ""}
              onChange={(e) => handleChange(field.name, e.target.value)}
              style={inputStyle(c)}
            />
          )}

          {/* Select */}
          {field.type === "select" && (
            <select
              value={
                (field.name === "target_column"
                  ? (
                      params.target_column ||
                      params.targetColumn ||
                      params.target ||
                      params.label_column ||
                      params.label ||
                      ""
                    ).toString().trim()
                  : params[field.name]) ?? field.default ?? ""
              }
              onChange={(e) => handleChange(field.name, e.target.value)}
              style={inputStyle(c)}
            >
              {field.name === "target_column" ? (
                <>
                  <option value="">Select column</option>

                  {cleanColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </>
              ) : (
                field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))
              )}
            </select>
          )}

          {/* Multi Select */}
          {field.type === "multiselect" && (
            <FeatureSelector
              columns={cleanColumns}
              columnTypes={cleanColumnTypes}
              selected={(params[field.name] || []).map((s) => String(s).trim())}
              onChange={(next) => handleChange(field.name, next)}
              dark={dark}
              allowedTypes={field.allowedTypes}
            />
          )}

          {/* Feature Inputs — one labeled number box per training column */}
          {field.type === "feature_inputs" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                maxHeight: 260,
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {cleanColumns.length === 0 && (
                <span style={{ fontSize: 11, color: c.label }}>
                  No feature columns found — connect this after Split Dataset.
                </span>
              )}

              {cleanColumns.map((col) => (
                <div key={col}>
                  <label
                    style={{
                      fontSize: 11,
                      color: c.label,
                      display: "block",
                      marginBottom: 3,
                    }}
                  >
                    {col}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={(params[field.name] || {})[col] ?? ""}
                    onChange={(e) => {
                      const current = params[field.name] || {};
                      const nextVal =
                        e.target.value === "" ? "" : Number(e.target.value);
                      handleChange(field.name, { ...current, [col]: nextVal });
                    }}
                    style={inputStyle(c)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Boolean */}
          {field.type === "boolean" && (
            <label
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <input
                type="checkbox"
                checked={params[field.name] ?? field.default}
                onChange={(e) =>
                  handleChange(field.name, e.target.checked)
                }
                style={{ display: "none" }}
              />

              <span
                onClick={() =>
                  handleChange(
                    field.name,
                    !(params[field.name] ?? field.default)
                  )
                }
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 11,
                  cursor: "pointer",
                  background:
                    params[field.name] ?? field.default
                      ? "#ff0071"
                      : "#334155",
                  position: "relative",
                  transition: "background 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  boxShadow: (params[field.name] ?? field.default) ? "0 0 12px rgba(255, 0, 113, 0.5)" : "none",

                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left:
                      params[field.name] ?? field.default
                        ? 20
                        : 2,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left 0.15s",
                  }}
                />
              </span>
            </label>
          )}
        </div>
      ))}
    </div>
  );
}

const inputStyle = (c) => ({
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: `1px solid rgba(255, 255, 255, 0.1)`,
  background: "rgba(10, 15, 26, 0.9)",
  color: "#f1f5f9",
  fontSize: 12.5,
  outline: "none",
  fontFamily: "'Inter', sans-serif",
  transition: "all 0.18s ease",
});

const darkColors = {
  label: "#94a3b8",
  border: "rgba(255, 255, 255, 0.1)",
  inputBg: "rgba(10, 15, 26, 0.9)",
  text: "#f1f5f9",
};

const lightColors = {
  label: "#475569",
  border: "#cbd5e1",
  inputBg: "#fff",
  text: "#1e293b",
};