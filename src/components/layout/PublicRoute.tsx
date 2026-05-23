import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { Skeleton } from '@/components/ui/skeleton';

interface PublicRouteProps {
  children: React.ReactNode;
}

/**
 * PublicRoute prevents authenticated users from accessing public-only pages 
 * like login, register, etc. and redirects them to the dashboard.
 */
export function PublicRoute({ children }: PublicRouteProps) {
  const { user, loading, initialized } = useAuthStore();

  // Show loading state while checking authentication
  if (!initialized || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  // If user is logged in, redirect to dashboard (unless they are in password recovery flow)
  const isRecovery = window.location.hash.includes('type=recovery') || window.location.href.includes('type=recovery');
  if (user && !isRecovery) {
    return <Navigate to="/dashboard" replace />;
  }

  // If not logged in, render the public page
  return <>{children}</>;
}
