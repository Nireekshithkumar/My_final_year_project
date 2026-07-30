import { Handle, Position } from 'reactflow'

const NODE_TAGS = {
  Start: 'bg-emerald-600',
  End: 'bg-red-600',
  LoadDataset: 'bg-sky-600',
  SplitDataset: 'bg-cyan-600',
  Classifier: 'bg-indigo-600',
  Regressor: 'bg-emerald-500',
  Clusterer: 'bg-purple-600',
  Evaluate: 'bg-amber-500',
  SaveResults: 'bg-slate-600',
}

const NODE_SUBTITLES = {
  Start: 'Start task',
  End: 'End task',
  LoadDataset: 'Load dataset',
  SplitDataset: 'Split dataset',
  Classifier: 'Classification model',
  Regressor: 'Regression model',
  Clusterer: 'Clustering model',
  Evaluate: 'Evaluate workflow',
  SaveResults: 'Save results',
}

export default function CustomNode({ data, selected }) {
  const accent = NODE_TAGS[data.type] || 'bg-slate-600'

  return (
    <div className={`rounded-3xl border bg-white dark:bg-slate-900 shadow-sm transition ${selected ? 'border-blue-300 shadow-blue-100' : 'border-slate-200 dark:border-slate-700'}`}>
      <div className={`${accent} rounded-t-3xl px-4 py-3`}>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white">{data.type}</p>
      </div>
      <div className="px-4 py-4">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1 truncate">{data.label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 truncate">{NODE_SUBTITLES[data.type] || 'Workflow step'}</p>
        {data.params && Object.keys(data.params).length > 0 ? (
          <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
            {Object.entries(data.params).slice(0, 3).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-2">
                <span>{key}</span>
                <span className="font-semibold">{String(value)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">No settings configured</p>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-slate-400 border border-white rounded-full shadow-sm" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-slate-400 border border-white rounded-full shadow-sm" />
    </div>
  )
}
