import { Navigate } from 'react-router-dom';
import { useAuth } from '../api/hooks';
import { Spinner } from '../components/ui/Spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { data: user, isLoading, isError } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const isValidUser = Boolean(user && typeof user === 'object' && 'id' in user);

  if (isError || !isValidUser) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
