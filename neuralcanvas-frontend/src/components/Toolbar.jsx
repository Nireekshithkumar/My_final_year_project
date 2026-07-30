import ThemeToggle from './ThemeToggle'

export default function Toolbar({ onSave, onRun, onClear, status, pipelineName }) {
  const statusStyle = {
    success: 'bg-green-100 text-green-700',
    running: 'bg-yellow-100 text-yellow-700 animate-pulse',
    failed: 'bg-red-100 text-red-700',
    idle: 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="h-14 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex items-center px-4 gap-3">
      <h1 className="text-base font-bold text-gray-800 dark:text-white mr-4 truncate max-w-xs">{pipelineName}</h1>

      <button onClick={onSave} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm px-4 py-1.5 rounded-lg transition font-medium">
        💾 Save
      </button>
      <button onClick={onRun} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded-lg transition font-medium">
        ▶ Run
      </button>
      <button onClick={onClear} className="bg-red-100 hover:bg-red-200 text-red-600 text-sm px-4 py-1.5 rounded-lg transition font-medium">
        🗑 Clear
      </button>

      <span className={`ml-2 text-xs font-semibold px-3 py-1 rounded-full ${statusStyle[status] || statusStyle.idle}`}>
        {status || 'idle'}
      </span>
    </div>
  )
}