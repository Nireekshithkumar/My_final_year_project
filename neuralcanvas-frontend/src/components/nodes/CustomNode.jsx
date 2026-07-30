import { Handle, Position } from 'reactflow';
import { Trash2 } from 'lucide-react';
import useStore from '../../store/useStore';

const ICONS = {
  start: { bg: '#22c55e', symbol: '▶' },
  end: { bg: '#ef4444', symbol: '■' },
  load_dataset: { bg: '#f59e0b', symbol: '📁' },
  split_dataset: { bg: '#f59e0b', symbol: '✂️' },
  train_model: { bg: '#ec4899', symbol: '🧠' },
  evaluate: { bg: '#3b82f6', symbol: '📊' },
  predict: { bg: '#22c55e', symbol: '🎯' },
  plot: { bg: '#06b6d4', symbol: '📈' },
};

export default function CustomNode({ id, data, selected }) {
  const removeNode = useStore((s) => s.removeNode);
  const icon = ICONS[data.nodeType] || ICONS.start;

  return (
    <div
      style={{
        width: 220,           // fixed width — this alone kills the overlap issue
        borderRadius: 10,
        background: '#fff',
        border: selected ? '2px solid #6366f1' : '1px solid #e5e7eb',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      <Handle type="target" position={Position.Left} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
        <span
          style={{
            width: 28, height: 28, borderRadius: 6, background: icon.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, flexShrink: 0,
          }}
        >
          {icon.symbol}
        </span>
        <span
          style={{
            fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
          }}
          title={data.label}
        >
          {data.label}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); removeNode(id); }}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            padding: 4, borderRadius: 4, display: 'flex', flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#fee2e2')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title="Delete node"
        >
          <Trash2 size={14} color="#ef4444" />
        </button>
      </div>

      <div style={{ padding: '0 12px 10px', fontSize: 12, color: '#6b7280' }}>
        {data.subtitle || data.label}
        {data.configured && <span style={{ marginLeft: 6, color: '#22c55e' }}>✓</span>}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}