import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Account details for this development workspace.</p>
      </div>
      <Card className="p-6">
        <dl className="space-y-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Name</dt>
            <dd className="mt-1 font-medium">{user?.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Email</dt>
            <dd className="mt-1 font-medium">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Phone</dt>
            <dd className="mt-1 font-medium">{user?.phone}</dd>
          </div>
        </dl>
        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-sm text-slate-500">
            Notifications, payment methods, and provider credentials will be added in later phases.
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}
