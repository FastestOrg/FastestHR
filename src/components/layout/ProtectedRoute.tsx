import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { Skeleton } from '@/components/ui/skeleton';

export type PlatformRole = 'super_admin' | 'company_admin' | 'hr_manager' | 'recruiter' | 'user';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: PlatformRole;
  allowedRoles?: PlatformRole[];
}

export function ProtectedRoute({ children, requiredRole, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading, initialized } = useAuthStore();

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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!profile?.platform_role || (!allowedRoles.includes(profile.platform_role) && profile.platform_role !== 'super_admin')) {
      return <Navigate to="/dashboard" replace />;
    }
  } else if (requiredRole && profile?.platform_role !== requiredRole && profile?.platform_role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
