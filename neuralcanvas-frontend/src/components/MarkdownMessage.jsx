/**
 * MarkdownMessage.jsx
 * Renders AI Copilot responses as styled Markdown instead of raw text.
 * Uses react-markdown + remark-gfm for full GitHub-Flavored Markdown support.
 * Styled to match the existing NeuralCanvas dark UI.
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Shared token colours consistent with the NeuralCanvas theme */
const C = {
  text: '#e2e8f0',
  muted: '#94a3b8',
  accent: '#c084fc',   // purple-400
  pink: '#f472b6',     // pink-400
  cyan: '#67e8f9',     // cyan-300
  green: '#86efac',    // green-300
  codeBg: 'rgba(0, 0, 0, 0.45)',
  blockquoteBg: 'rgba(99, 102, 241, 0.08)',
  blockquoteBorder: '#6366f1',
  tableBorder: 'rgba(255,255,255,0.1)',
  tableHeadBg: 'rgba(255,255,255,0.05)',
}

/**
 * Custom renderers for react-markdown.
 * Each renderer returns an inline-styled JSX element so no extra CSS file is needed.
 */
const components = {
  // ── Headings ───────────────────────────────────────────────────────────────
  h1: ({ children }) => (
    <h1 style={{
      fontSize: '1.35em',
      fontWeight: 800,
      color: C.pink,
      margin: '0 0 10px',
      paddingBottom: '6px',
      borderBottom: `1px solid rgba(244, 114, 182, 0.25)`,
      fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      lineHeight: 1.3,
    }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{
      fontSize: '1.18em',
      fontWeight: 700,
      color: C.accent,
      margin: '14px 0 8px',
      fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      lineHeight: 1.3,
    }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{
      fontSize: '1.05em',
      fontWeight: 700,
      color: C.cyan,
      margin: '12px 0 6px',
      lineHeight: 1.3,
    }}>{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 style={{
      fontSize: '0.97em',
      fontWeight: 600,
      color: C.green,
      margin: '10px 0 5px',
      lineHeight: 1.3,
    }}>{children}</h4>
  ),

  // ── Paragraphs & line breaks ───────────────────────────────────────────────
  p: ({ children }) => (
    <p style={{ margin: '0 0 8px', lineHeight: 1.65, color: C.text }}>{children}</p>
  ),
  br: () => <br />,

  // ── Emphasis ──────────────────────────────────────────────────────────────
  strong: ({ children }) => (
    <strong style={{ fontWeight: 700, color: '#f1f5f9' }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ fontStyle: 'italic', color: C.muted }}>{children}</em>
  ),

  // ── Lists ─────────────────────────────────────────────────────────────────
  ul: ({ children }) => (
    <ul style={{
      margin: '4px 0 8px',
      paddingLeft: '20px',
      listStyleType: 'disc',
      color: C.text,
      display: 'flex',
      flexDirection: 'column',
      gap: '3px',
    }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{
      margin: '4px 0 8px',
      paddingLeft: '20px',
      listStyleType: 'decimal',
      color: C.text,
      display: 'flex',
      flexDirection: 'column',
      gap: '3px',
    }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li style={{ lineHeight: 1.6, paddingLeft: '2px' }}>{children}</li>
  ),

  // ── Inline code ───────────────────────────────────────────────────────────
  code: ({ inline, className, children }) => {
    if (inline) {
      return (
        <code style={{
          background: C.codeBg,
          color: C.cyan,
          borderRadius: '4px',
          padding: '1px 5px',
          fontSize: '0.88em',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          border: '1px solid rgba(103, 232, 249, 0.18)',
        }}>{children}</code>
      )
    }
    // Block code
    return (
      <code style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: '0.85em',
        color: '#bfdbfe',
        display: 'block',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>{children}</code>
    )
  },

  // ── Code blocks ───────────────────────────────────────────────────────────
  pre: ({ children }) => (
    <pre style={{
      background: 'rgba(0, 0, 0, 0.55)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '8px',
      padding: '12px 14px',
      overflowX: 'auto',
      margin: '6px 0 10px',
      lineHeight: 1.55,
    }}>{children}</pre>
  ),

  // ── Blockquotes (callouts / info boxes) ───────────────────────────────────
  blockquote: ({ children }) => (
    <blockquote style={{
      background: C.blockquoteBg,
      borderLeft: `3px solid ${C.blockquoteBorder}`,
      borderRadius: '0 8px 8px 0',
      padding: '8px 14px',
      margin: '6px 0 10px',
      color: '#c7d2fe',
      fontStyle: 'normal',
    }}>{children}</blockquote>
  ),

  // ── Links ─────────────────────────────────────────────────────────────────
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: C.accent, textDecoration: 'underline', textDecorationStyle: 'dotted' }}
    >{children}</a>
  ),

  // ── Horizontal Rule ───────────────────────────────────────────────────────
  hr: () => (
    <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '10px 0' }} />
  ),

  // ── Tables (GFM) ──────────────────────────────────────────────────────────
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '8px 0 12px' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '0.9em',
        color: C.text,
        border: `1px solid ${C.tableBorder}`,
        borderRadius: '8px',
        overflow: 'hidden',
      }}>{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ background: C.tableHeadBg }}>{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr style={{ borderBottom: `1px solid ${C.tableBorder}` }}>{children}</tr>
  ),
  th: ({ children }) => (
    <th style={{
      padding: '7px 12px',
      fontWeight: 700,
      textAlign: 'left',
      color: C.accent,
      borderRight: `1px solid ${C.tableBorder}`,
    }}>{children}</th>
  ),
  td: ({ children }) => (
    <td style={{
      padding: '6px 12px',
      borderRight: `1px solid ${C.tableBorder}`,
    }}>{children}</td>
  ),
}

/**
 * MarkdownMessage
 *
 * Drop-in replacement for raw `{m.content}` text in chat bubbles.
 * Renders Markdown safely and handles partial/streamed content without crashing.
 *
 * @param {string}  content - The raw Markdown string from the AI response.
 * @param {boolean} isUser  - If true, applies plain rendering (user messages rarely use MD).
 */
export default function MarkdownMessage({ content, isUser = false }) {
  if (!content) return null

  // User messages: render as plain text preserving newlines
  if (isUser) {
    return (
      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {content}
      </span>
    )
  }

  return (
    <div style={{
      wordBreak: 'break-word',
      overflowWrap: 'break-word',
      // Reset list markers that bubble styles might suppress
      '--list-marker-color': C.muted,
    }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        // Avoid crashing on malformed / partial streamed markdown
        skipHtml={false}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
