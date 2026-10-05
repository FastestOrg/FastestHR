import { useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import posthog from 'posthog-js';
import { PostHogProvider, PostHogErrorBoundary } from '@posthog/react';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/hooks/use-theme';
import { HelmetProvider } from 'react-helmet-async';
import { getCompanySlugFromHost } from '@/utils/tenantUtils';
import { Capacitor } from '@capacitor/core';
import { BYOSProvider } from '@/contexts/BYOSContext';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ProtectedRoute, type PlatformRole } from '@/components/layout/ProtectedRoute';
import { PublicRoute } from '@/components/layout/PublicRoute';
import { MobileSplash } from '@/components/layout/MobileSplash';

// Public & Marketing Pages (lazy loaded)
const Landing = lazy(() => import('@/pages/Landing'));
const BlogList = lazy(() => import('@/pages/BlogList'));
const BlogPost = lazy(() => import('@/pages/BlogPost'));
const AuthorDetail = lazy(() => import('@/pages/AuthorDetail'));
const PublicIDCard = lazy(() => import('@/pages/public/PublicIDCard'));
const LegacyCompare = lazy(() => import('@/pages/public/LegacyCompare'));
const StartupSolutions = lazy(() => import('@/pages/solutions/StartupSolutions'));
const CoreEngine = lazy(() => import('@/pages/public/CoreEngine'));
const PayrollOS = lazy(() => import('@/pages/public/PayrollOS'));
const TalentPipeline = lazy(() => import('@/pages/public/TalentPipeline'));
const APIDocs = lazy(() => import('@/pages/public/APIDocs'));
const About = lazy(() => import('@/pages/public/About'));
const Careers = lazy(() => import('@/pages/public/Careers'));
const Changelog = lazy(() => import('@/pages/public/Changelog'));
const TermsOfService = lazy(() => import('@/pages/public/TermsOfService'));
const PrivacyPolicy = lazy(() => import('@/pages/public/PrivacyPolicy'));
const Security = lazy(() => import('@/pages/public/Security'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Auth Pages (lazy loaded)
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));

// Core HR modules (lazy loaded)
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Employees = lazy(() => import('@/pages/Employees'));
const Attendance = lazy(() => import('@/pages/Attendance'));
const Leave = lazy(() => import('@/pages/Leave'));
const Payroll = lazy(() => import('@/pages/Payroll'));
const Performance = lazy(() => import('@/pages/Performance'));
const Recruitment = lazy(() => import('@/pages/Recruitment'));
const Learning = lazy(() => import('@/pages/Learning'));
const HelpDesk = lazy(() => import('@/pages/HelpDesk'));
const Announcements = lazy(() => import('@/pages/Announcements'));
const Reports = lazy(() => import('@/pages/Reports'));
const Settings = lazy(() => import('@/pages/Settings'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const OfferView = lazy(() => import('@/pages/recruitment/OfferView'));
const Documents = lazy(() => import('@/pages/Documents'));
const Billing = lazy(() => import('@/pages/Billing'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const ExitManagement = lazy(() => import('@/pages/ExitManagement'));
const HolidayCalendar = lazy(() => import('@/pages/HolidayCalendar'));
const SendDesk = lazy(() => import('@/pages/SendDesk'));
const VirtualIDCard = lazy(() => import('@/pages/employees/VirtualIDCard'));
const CultureHub = lazy(() => import('@/pages/CultureHub'));
const KPI = lazy(() => import('@/pages/KPI'));

// Admin Pages (lazy loaded)
const Companies = lazy(() => import('@/pages/admin/Companies'));
const Subscriptions = lazy(() => import('@/pages/admin/Subscriptions'));
const SystemSettings = lazy(() => import('@/pages/admin/SystemSettings'));
const Roles = lazy(() => import('@/pages/settings/Roles'));
const AttritionInsights = lazy(() => import('@/pages/admin/AttritionInsights'));

// Chat module (lazy loaded)
const Chats = lazy(() => import('@/pages/Chats'));

// Sub-pages (lazy loaded for performance)
const NewEmployee = lazy(() => import('@/pages/employees/NewEmployee'));
const EmployeeDetail = lazy(() => import('@/pages/employees/EmployeeDetail'));
const ApplyLeave = lazy(() => import('@/pages/leaves/ApplyLeave'));
const NewJob = lazy(() => import('@/pages/recruitment/NewJob'));
const CompanyPage = lazy(() => import('@/pages/company/CompanyPage'));
const JobApply = lazy(() => import('@/pages/company/JobApply'));
const AIInterview = lazy(() => import('@/pages/company/AIInterview'));
const CandidateLogin = lazy(() => import('@/pages/candidate/CandidateLogin'));
const CandidatePortal = lazy(() => import('@/pages/candidate/CandidatePortal'));
const ReferralPortal = lazy(() => import('@/pages/recruitment/ReferralPortal'));
const EmployeeProfile = lazy(() => import('@/pages/profile/EmployeeProfile'));
const GlobalEmployeeVerification = lazy(() => import('@/pages/GlobalEmployeeVerification'));
const GlobalEmployeeProfile = lazy(() => import('@/pages/public/GlobalEmployeeProfile'));
const GlobalEmployeeVerify = lazy(() => import('@/pages/public/GlobalEmployeeVerify'));
const Meetings = lazy(() => import('@/pages/Meetings'));
const PublicBookingPage = lazy(() => import('@/pages/public/PublicBookingPage'));
const OrgChart = lazy(() => import('@/pages/OrgChart'));
const HierarchyLogs = lazy(() => import('@/pages/HierarchyLogs'));

// Recruitment sub-pages (lazy loaded)
const RecruitmentPipeline = lazy(() => import('@/pages/recruitment/RecruitmentPipeline').then(m => ({ default: m.RecruitmentPipeline })));
const RecruitmentLeadsBoard = lazy(() => import('@/pages/recruitment/RecruitmentLeadsBoard').then(m => ({ default: m.RecruitmentLeadsBoard })));
const RecruitmentTeam = lazy(() => import('@/pages/recruitment/RecruitmentTeam').then(m => ({ default: m.RecruitmentTeam })));
const RecruitmentAnalytics = lazy(() => import('@/pages/recruitment/RecruitmentAnalytics').then(m => ({ default: m.RecruitmentAnalytics })));
const OfferTemplateList = lazy(() => import('@/components/recruitment/OfferTemplateEditor').then(m => ({ default: m.OfferTemplateList })));

const queryClient = new QueryClient();

function AppRoutes() {
  const { initialize, initialized } = useAuthStore();
  const { theme } = useTheme();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Detect subdomain-based company routing
  const companySlugFromHost = getCompanySlugFromHost();

  // Loading fallback for lazy routes
  const LazyFallback = () => (
    <div className="flex h-64 flex-col items-center justify-center space-y-4">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-2 border-primary/20 rounded-full" />
        <div className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
      <div className="font-mono text-primary/40 text-[10px] tracking-[0.2em] uppercase animate-pulse">
        Module Loading
      </div>
    </div>
  );

  const withLayout = (component: React.ReactNode, role?: PlatformRole, allowedRoles?: PlatformRole[]) => (
    <ProtectedRoute requiredRole={role} allowedRoles={allowedRoles}>
      <DashboardLayout>
        <Suspense fallback={<LazyFallback />}>
          {component}
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  );

  // If accessed via subdomain (e.g. acme.fastesthr.com) or custom domain, show company career pages
  if (companySlugFromHost) {
    return (
      <Routes>
        <Route path="/" element={<Suspense fallback={<LazyFallback />}><CompanyPage /></Suspense>} />
        <Route path="/jobs/:jobSlug" element={<Suspense fallback={<LazyFallback />}><JobApply /></Suspense>} />
        <Route path="/jobs/:jobSlug/interview/:candidateId" element={<Suspense fallback={<LazyFallback />}><AIInterview /></Suspense>} />
        <Route path="/candidate/login" element={<Suspense fallback={<LazyFallback />}><CandidateLogin /></Suspense>} />
        <Route path="/candidate/portal" element={<Suspense fallback={<LazyFallback />}><CandidatePortal /></Suspense>} />
        <Route path="/offer/:token" element={<OfferView />} />
        <Route path="/ai-interview/:hash" element={<Suspense fallback={<LazyFallback />}><AIInterview /></Suspense>} />
        <Route path="/id/:publicId" element={<PublicIDCard />} />
        <Route path="/book/:bookingSlug" element={<Suspense fallback={<LazyFallback />}><PublicBookingPage /></Suspense>} />
        <Route path="/:bookingSlug" element={<Suspense fallback={<LazyFallback />}><PublicBookingPage /></Suspense>} />
        <Route path="*" element={<Suspense fallback={<LazyFallback />}><CompanyPage /></Suspense>} />
      </Routes>
    );
  }

  return (
    <>
      <AnimatePresence>
        {!initialized && <MobileSplash />}
      </AnimatePresence>
      <Suspense fallback={<LazyFallback />}>
        <Routes>
        {/* Public routes */}
        <Route path="/" element={Capacitor.isNativePlatform() ? <Navigate to="/login" replace /> : <Landing />} />
        <Route path="/blog" element={<BlogList />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/offer/:token" element={<OfferView />} />
        <Route path="/ai-interview/:hash" element={<AIInterview />} />
        <Route path="/id/:publicId" element={<PublicIDCard />} />
        <Route path="/author/:slug" element={<AuthorDetail />} />

        {/* Global Employee Verification - Public Pages */}
        <Route path="/employeebg/:id" element={<GlobalEmployeeProfile />} />
        <Route path="/employeebg/verify/:token" element={<GlobalEmployeeVerify />} />

        {/* Company Career Pages */}
        <Route path="/company/:companySlug" element={<CompanyPage />} />
        <Route path="/company/:companySlug/jobs/:jobSlug" element={<JobApply />} />
        <Route path="/company/:companySlug/jobs/:jobSlug/interview/:candidateId" element={<AIInterview />} />

        {/* SEO Comparison Pages */}
        <Route path="/vs/legacy-hrms" element={<LegacyCompare />} />

        {/* SEO Solution Pages */}
        <Route path="/solutions/startups" element={<StartupSolutions />} />

        {/* Candidate Portal */}
        <Route path="/candidate/login" element={<CandidateLogin />} />
        <Route path="/candidate/portal" element={<CandidatePortal />} />

        {/* Core HR modules */}
        <Route path="/dashboard" element={withLayout(<Dashboard />)} />
        <Route path="/profile" element={withLayout(<EmployeeProfile />)} />
        <Route path="/org-chart" element={withLayout(<OrgChart />)} />
        <Route path="/hierarchy-logs" element={withLayout(<HierarchyLogs />)} />
        <Route path="/employees" element={withLayout(<Employees />)} />
        <Route path="/employees/new" element={withLayout(<NewEmployee />, undefined, ['company_admin', 'super_admin', 'hr_manager'])} />
        <Route path="/employees/:id" element={withLayout(<EmployeeDetail />)} />
        <Route path="/attendance" element={withLayout(<Attendance />)} />
        <Route path="/leave" element={withLayout(<Leave />)} />
        <Route path="/leave/apply" element={withLayout(<ApplyLeave />)} />
        <Route path="/payroll" element={withLayout(<Payroll />)} />
        <Route path="/performance" element={withLayout(<Performance />)} />
        <Route path="/recruitment" element={withLayout(<Recruitment />)}>
          <Route index element={<Navigate to="pipeline" replace />} />
          <Route path="pipeline" element={<RecruitmentPipeline />} />
          <Route path="leads" element={<RecruitmentLeadsBoard />} />
          <Route path="analytics" element={<RecruitmentAnalytics />} />
          <Route path="team" element={<RecruitmentTeam />} />
          <Route path="templates" element={<OfferTemplateList />} />
          <Route path="new" element={<NewJob />} />
          <Route path="edit/:id" element={<NewJob />} />
        </Route>
        <Route path="/culture" element={withLayout(<CultureHub />)} />
        <Route path="/kpi" element={withLayout(<KPI />)} />
        <Route path="/referrals" element={withLayout(<ReferralPortal />)} />
        <Route path="/learning" element={withLayout(<Learning />)} />
        <Route path="/helpdesk" element={withLayout(<HelpDesk />)} />
        <Route path="/announcements" element={withLayout(<Announcements />)} />
        <Route path="/reports" element={withLayout(<Reports />)} />
        <Route path="/documents" element={withLayout(<Documents />)} />
        <Route path="/onboarding" element={withLayout(<Onboarding />)} />
        <Route path="/exit-management" element={withLayout(<ExitManagement />)} />
        <Route path="/holidays" element={withLayout(<HolidayCalendar />)} />
        <Route path="/tasks" element={withLayout(<Tasks />)} />
        <Route path="/chats" element={withLayout(<Chats />)} />
        <Route path="/meetings" element={withLayout(<Meetings />)} />
        <Route path="/senddesk" element={withLayout(<SendDesk />)} />
        <Route path="/global-verification" element={withLayout(<GlobalEmployeeVerification />)} />
        <Route path="/id-card" element={withLayout(<VirtualIDCard />)} />
        <Route path="/billing" element={withLayout(<Billing />, 'company_admin')} />
        <Route path="/roles" element={withLayout(<Roles />, 'company_admin')} />
        <Route path="/settings/*" element={withLayout(<Settings />, 'company_admin')} />

        {/* Super Admin routes */}
        <Route path="/admin" element={withLayout(<Dashboard />, 'super_admin')} />
        <Route path="/admin/companies" element={withLayout(<Companies />, 'super_admin')} />
        <Route path="/admin/subscriptions" element={withLayout(<Subscriptions />, 'super_admin')} />
        <Route path="/admin/system" element={withLayout(<SystemSettings />, 'super_admin')} />
        <Route path="/admin/attrition" element={withLayout(<AttritionInsights />, undefined, ['company_admin', 'super_admin', 'hr_manager'])} />

        {/* Footer Pages */}
        <Route path="/platform/core-engine" element={<CoreEngine />} />
        <Route path="/platform/payroll-os" element={<PayrollOS />} />
        <Route path="/platform/talent-pipeline" element={<TalentPipeline />} />
        <Route path="/platform/api-docs" element={<APIDocs />} />
        <Route path="/company/about" element={<About />} />
        <Route path="/company/careers" element={<Careers />} />
        <Route path="/company/changelog" element={<Changelog />} />
        <Route path="/legal/terms" element={<TermsOfService />} />
        <Route path="/legal/privacy" element={<PrivacyPolicy />} />
        <Route path="/legal/security" element={<Security />} />

        {/* Public Booking routes */}
        <Route path="/book/:companySlug/:bookingSlug" element={<PublicBookingPage />} />
        <Route path="/:companySlug/:bookingSlug" element={<PublicBookingPage />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </>
  );
}

const App = () => (
  <PostHogProvider client={posthog}>
    <PostHogErrorBoundary fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] text-white p-6 font-sans">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm text-zinc-400 text-center max-w-md mb-6">
          Our engineering team has been automatically notified and is actively looking into the issue. Thank you for your patience!
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-white font-medium rounded-lg text-sm transition-all shadow-lg shadow-black/20"
        >
          Reload Application
        </button>
      </div>
    }>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <BYOSProvider>
                <AppRoutes />
              </BYOSProvider>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </PostHogErrorBoundary>
  </PostHogProvider>
);

export default App;
