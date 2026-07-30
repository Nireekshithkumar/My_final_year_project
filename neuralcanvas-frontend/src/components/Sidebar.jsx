const NODE_PALETTE = [
  {
    category: 'Workflow',
    items: [
      { type: 'Start', label: 'Start Task', description: 'Begin workflow' },
      { type: 'End', label: 'End Task', description: 'Finish workflow' },
    ],
  },
  {
    category: 'Data',
    items: [
      { type: 'LoadDataset', label: 'Load Dataset', description: 'Import data' },
      { type: 'SplitDataset', label: 'Split Dataset', description: 'Train/test split' },
    ],
  },
  {
    category: 'Model',
    items: [
      { type: 'Classifier', label: 'Classification Model', description: 'Supervised classifier' },
      { type: 'Regressor', label: 'Regression Model', description: 'Supervised regressor' },
      { type: 'Clusterer', label: 'Clustering Model', description: 'Unsupervised clusterer' },
    ],
  },
  {
    category: 'Output',
    items: [
      { type: 'Evaluate', label: 'Evaluate', description: 'Evaluate model' },
      { type: 'SaveResults', label: 'Save Results', description: 'Persist workflow output' },
    ],
  },
]

function SidebarItem({ item, onDragStart }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item)}
      className="mb-3 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 shadow-sm cursor-grab hover:shadow-md transition"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">{item.type}</span>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const onDragStart = (e, item) => {
    e.dataTransfer.setData('algorithmType', item.type)
    e.dataTransfer.setData('label', item.label)
    const category =
      item.type === 'SplitDataset'
        ? 'Data'
        : item.type === 'SaveResults'
        ? 'Output'
        : item.type === 'Start' || item.type === 'End'
        ? 'Workflow'
        : 'Model'
    e.dataTransfer.setData('category', category)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-80 h-full bg-slate-100 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 px-4 py-4 overflow-y-auto">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400 dark:text-slate-500">Node Library</p>
        <h2 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">Drag nodes onto the canvas</h2>
      </div>

      {NODE_PALETTE.map((group) => (
        <div key={group.category} className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400 mb-3">{group.category}</p>
          {group.items.map((item) => (
            <SidebarItem key={item.type} item={item} onDragStart={onDragStart} />
          ))}
        </div>
      ))}
    </div>
  )
}
