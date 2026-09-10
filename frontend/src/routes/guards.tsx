import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from '../components/Spinner';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <Spinner label="Checking session..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <Spinner label="Checking session..." />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
