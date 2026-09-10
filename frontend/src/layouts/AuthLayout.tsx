import { Link, Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink-950 p-10 text-white lg:flex lg:flex-col">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 font-bold">V</div>
          <span className="text-lg font-semibold">Voyage</span>
        </Link>
        <div className="mt-auto max-w-md">
          <p className="text-3xl font-semibold leading-tight">Schedule travel bookings before they open.</p>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Create passengers, queue train, bus, and flight tasks, and review execution logs from a single
            operations dashboard. Automated booking execution arrives in a later phase.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
