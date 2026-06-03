import { Button } from '@/components/ui/button';
import {
  Briefcase, Plus, UserCheck, BarChart3, Crown, Send,
} from 'lucide-react';
import { useNavigate, useLocation, Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';


export default function Recruitment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuthStore();

  const isAdmin = ['company_admin', 'super_admin'].includes(profile?.platform_role || '');
  const isManager = profile?.platform_role === 'hr_manager';
  const isRecruiter = profile?.platform_role === 'recruiter';
  const canManageJobs = isAdmin || isManager;

  // Determine the active tab from the current URL path
  const pathSegment = location.pathname.split('/recruitment/')[1]?.split('/')[0]?.split('?')[0] || '';
  const activeTab = ['pipeline', 'leads', 'analytics', 'team', 'templates'].includes(pathSegment) 
    ? pathSegment 
    : '';

  // Recruiter role: redirect to leads if they hit /recruitment or /recruitment/pipeline
  if (isRecruiter && (activeTab === '' || activeTab === 'pipeline')) {
    return <Navigate to="/recruitment/leads" replace />;
  }

  // Define visible tabs based on role
  const tabs = [
    ...(!isRecruiter ? [{ id: 'pipeline', label: 'Pipeline', icon: Briefcase, path: '/recruitment/pipeline' }] : []),
    { id: 'leads', label: isRecruiter ? 'My Leads' : 'Leads Board', icon: UserCheck, path: '/recruitment/leads' },
    ...((isAdmin || isManager) ? [{ id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/recruitment/analytics' }] : []),
    ...((isAdmin || isManager) ? [{ id: 'team', label: 'Team', icon: Crown, path: '/recruitment/team' }] : []),
    { id: 'templates', label: 'Offer Templates', icon: Send, path: '/recruitment/templates' },
  ];

  // Check if we're on a sub-page like /recruitment/new or /recruitment/edit/:id
  const isSubPage = ['new', 'edit'].includes(pathSegment);

  return (
    <div className="space-y-6">
      {/* Header — hidden on sub-pages like new/edit job */}
      {!isSubPage && (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-background/50 backdrop-blur-md p-4 rounded-xl border border-border/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div 
                className="p-2 bg-primary/10 rounded-lg cursor-pointer hover:bg-primary/20 transition-colors"
                onClick={() => navigate('/recruitment/pipeline')}
              >
                <Briefcase className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground font-medium">
                  <span className="hover:text-primary cursor-pointer transition-colors" onClick={() => navigate('/recruitment/pipeline')}>Recruitment</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground -mt-0.5">
                  Recruitment Dashboard
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
              <div className="flex flex-wrap items-center gap-2">
                {canManageJobs && (
                  <Button onClick={() => navigate('/recruitment/new')} className="rounded-full px-4 sm:px-6 h-8 sm:h-9 text-xs sm:text-sm gap-2 shadow-lg shadow-primary/20">
                    <Plus className="w-3.5 h-3.5" />
                    Post New Job
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Tab Navigation — link-based instead of state-based */}
          <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted/50 border border-border/50 p-1 text-muted-foreground">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gap-2",
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "hover:bg-background/50 hover:text-foreground"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Nested route content */}
      <Outlet />
    </div>
  );
}
