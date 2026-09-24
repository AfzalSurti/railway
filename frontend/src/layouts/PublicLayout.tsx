import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function PublicLayout() {
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">V</span>
            Voyage
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            {isAuthenticated ? (
              <Link to="/dashboard" className="text-brand-700 hover:underline">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-slate-600 hover:text-slate-900">
                  Log in
                </Link>
                <Link to="/register" className="rounded-xl bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700">
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
