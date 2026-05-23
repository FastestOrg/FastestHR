import { useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/hooks/use-theme';
import { HelmetProvider } from 'react-helmet-async';
import { getCompanySlugFromHost } from '@/utils/tenantUtils';
import { Capacitor } from '@capacitor/core';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { PublicRoute } from '@/components/layout/PublicRoute';
import { MobileSplash } from '@/components/layout/MobileSplash';
import Landing from '@/pages/Landing';
import BlogList from '@/pages/BlogList';
import BlogPost from '@/pages/BlogPost';
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import ResetPassword from '@/pages/auth/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import Employees from '@/pages/Employees';
import Attendance from '@/pages/Attendance';
import Leave from '@/pages/Leave';
import Payroll from '@/pages/Payroll';
import Performance from '@/pages/Performance';
import Recruitment from '@/pages/Recruitment';
import Learning from '@/pages/Learning';
import HelpDesk from '@/pages/HelpDesk';
import Announcements from '@/pages/Announcements';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import Tasks from '@/pages/Tasks';
import OfferView from '@/pages/recruitment/OfferView';
import Documents from '@/pages/Documents';
import Billing from '@/pages/Billing';
import Onboarding from '@/pages/Onboarding';
import ExitManagement from '@/pages/ExitManagement';
import HolidayCalendar from '@/pages/HolidayCalendar';
import SendDesk from '@/pages/SendDesk';
import VirtualIDCard from '@/pages/employees/VirtualIDCard';
import PublicIDCard from '@/pages/public/PublicIDCard';
import LegacyCompare from '@/pages/public/LegacyCompare';
import StartupSolutions from '@/pages/solutions/StartupSolutions';
import AuthorDetail from '@/pages/AuthorDetail';


import Companies from '@/pages/admin/Companies';
import Subscriptions from '@/pages/admin/Subscriptions';
import SystemSettings from '@/pages/admin/SystemSettings';
import Roles from '@/pages/settings/Roles';
import AttritionInsights from '@/pages/admin/AttritionInsights';
import CultureHub from '@/pages/CultureHub';
import KPI from '@/pages/KPI';

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

import PlaceholderPage from '@/pages/PlaceholderPage';
import NotFound from '@/pages/NotFound';

import CoreEngine from '@/pages/public/CoreEngine';
import PayrollOS from '@/pages/public/PayrollOS';
import TalentPipeline from '@/pages/public/TalentPipeline';
import APIDocs from '@/pages/public/APIDocs';
import About from '@/pages/public/About';
import Careers from '@/pages/public/Careers';
import Changelog from '@/pages/public/Changelog';
import TermsOfService from '@/pages/public/TermsOfService';
import PrivacyPolicy from '@/pages/public/PrivacyPolicy';
import Security from '@/pages/public/Security';

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

  const withLayout = (component: React.ReactNode, role?: string) => (
    <ProtectedRoute requiredRole={role as any}>
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
        <Route path="*" element={<Suspense fallback={<LazyFallback />}><CompanyPage /></Suspense>} />
      </Routes>
    );
  }

  return (
    <>
      <AnimatePresence>
        {!initialized && <MobileSplash />}
      </AnimatePresence>
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
      <Route path="/ai-interview/:hash" element={<Suspense fallback={<LazyFallback />}><AIInterview /></Suspense>} />
      <Route path="/id/:publicId" element={<PublicIDCard />} />
      <Route path="/author/:slug" element={<AuthorDetail />} />


      {/* Company Career Pages */}
      <Route path="/company/:companySlug" element={<Suspense fallback={<div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] text-white/20 font-mono text-[10px] tracking-[0.2em] uppercase"><div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />LOADING EXPERIENCE</div>}><CompanyPage /></Suspense>} />
      <Route path="/company/:companySlug/jobs/:jobSlug" element={<Suspense fallback={<div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] text-white/20 font-mono text-[10px] tracking-[0.2em] uppercase"><div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />LOADING OPPORTUNITIES</div>}><JobApply /></Suspense>} />
      <Route path="/company/:companySlug/jobs/:jobSlug/interview/:candidateId" element={<Suspense fallback={<div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] text-white/20 font-mono text-[10px] tracking-[0.2em] uppercase"><div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />PREPARING AI INTERVIEW</div>}><AIInterview /></Suspense>} />

      {/* SEO Comparison Pages */}
      <Route path="/vs/legacy-hrms" element={<LegacyCompare />} />

      {/* SEO Solution Pages */}
      <Route path="/solutions/startups" element={<StartupSolutions />} />

      {/* Candidate Portal */}
      <Route path="/candidate/login" element={<Suspense fallback={<div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] text-white/20 font-mono text-[10px] tracking-[0.2em] uppercase"><div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />SECURE LOGIN</div>}><CandidateLogin /></Suspense>} />
      <Route path="/candidate/portal" element={<Suspense fallback={<div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] text-white/20 font-mono text-[10px] tracking-[0.2em] uppercase"><div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />OPENING PORTAL</div>}><CandidatePortal /></Suspense>} />


      {/* Core HR modules */}
      <Route path="/dashboard" element={withLayout(<Dashboard />)} />
      <Route path="/profile" element={withLayout(<EmployeeProfile />)} />
      <Route path="/employees" element={withLayout(<Employees />)} />
      <Route path="/employees/new" element={withLayout(<NewEmployee />)} />
      <Route path="/employees/:id" element={withLayout(<EmployeeDetail />)} />
      <Route path="/attendance" element={withLayout(<Attendance />)} />
      <Route path="/leave" element={withLayout(<Leave />)} />
      <Route path="/leave/apply" element={withLayout(<ApplyLeave />)} />
      <Route path="/payroll" element={withLayout(<Payroll />)} />
      <Route path="/performance" element={withLayout(<Performance />)} />
      <Route path="/recruitment" element={withLayout(<Recruitment />)} />
      <Route path="/culture" element={withLayout(<CultureHub />)} />
      <Route path="/kpi" element={withLayout(<KPI />)} />
      <Route path="/recruitment/new" element={withLayout(<NewJob />)} />
      <Route path="/recruitment/edit/:id" element={withLayout(<NewJob />)} />
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
      <Route path="/senddesk" element={withLayout(<SendDesk />)} />
      <Route path="/id-card" element={withLayout(<VirtualIDCard />)} />
      <Route path="/billing" element={withLayout(<Billing />, 'company_admin')} />
      <Route path="/roles" element={withLayout(<Roles />, 'company_admin')} />
      <Route path="/settings/*" element={withLayout(<Settings />, 'company_admin')} />

      {/* Super Admin routes */}
      <Route path="/admin" element={withLayout(<Dashboard />, 'super_admin')} />
      <Route path="/admin/companies" element={withLayout(<Companies />, 'super_admin')} />
      <Route path="/admin/subscriptions" element={withLayout(<Subscriptions />, 'super_admin')} />
      <Route path="/admin/system" element={withLayout(<SystemSettings />, 'super_admin')} />
      <Route path="/admin/attrition" element={withLayout(<AttritionInsights />, 'company_admin')} />

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

      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  );
}

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
