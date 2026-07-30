import useStore from '../store/useStore'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useStore()
  return (
    <button
      onClick={toggleTheme}
      className="px-4 py-2 rounded-lg border dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
    >
      {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
    </button>
  )
}