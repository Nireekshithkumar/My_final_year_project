import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const navigate = useNavigate();

  const handleLogout = () => {
    setUser(null);
    navigate('/login');
  };

  return (
    <nav className="flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="font-bold text-lg text-slate-900 dark:text-white">Neural Canvas</div>

      <div className="flex items-center gap-4">
        {user && (
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {user.email || user.username}
          </span>
        )}
        <ThemeToggle />
        {user && (
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}