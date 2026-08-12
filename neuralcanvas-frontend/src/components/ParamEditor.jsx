import { PARAM_SCHEMAS } from "../config/paramSchemas";
import FeatureSelector from "./FeatureSelector";

export default function ParamEditor({ nodeType, params = {}, onChange, dark, columns = [], columnTypes = {} }) {
  const schema = PARAM_SCHEMAS[nodeType];
  if (!schema || schema.length === 0) return null;

  const handleChange = (name, value) =>
    onChange({ ...params, [name]: value });

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
              value={params[field.name] ?? field.default ?? ""}
              onChange={(e) => handleChange(field.name, e.target.value)}
              style={inputStyle(c)}
            >
              {field.name === "target_column" ? (
                <>
                  <option value="">Select column</option>

                  {columns.map((col) => (
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
              columns={columns}
              columnTypes={columnTypes}
              selected={params[field.name] || []}
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
              {columns.length === 0 && (
                <span style={{ fontSize: 11, color: c.label }}>
                  No feature columns found — connect this after Split Dataset.
                </span>
              )}

              {columns.map((col) => (
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
                      ? "#2563eb"
                      : "#475569",
                  position: "relative",
                  transition: "background 0.15s",
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
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px solid ${c.border}`,
  background: c.inputBg,
  color: c.text,
  fontSize: 13,
});

const darkColors = {
  label: "#94a3b8",
  border: "#334155",
  inputBg: "#0f172a",
  text: "#f1f5f9",
};

const lightColors = {
  label: "#475569",
  border: "#cbd5e1",
  inputBg: "#fff",
  text: "#1e293b",
};