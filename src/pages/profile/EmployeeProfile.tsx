import { useState, lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  User, Phone, Users, GraduationCap, Briefcase, Code,
  Landmark, HeartPulse, Link2, Settings, LayoutDashboard,
  AlertTriangle
} from 'lucide-react';
import ProfileDashboard from './ProfileDashboard';

// Lazy load sections for performance
const PersonalProfile = lazy(() => import('./sections/PersonalProfile'));
const EmergencyContact = lazy(() => import('./sections/EmergencyContact'));
const FamilyDependents = lazy(() => import('./sections/FamilyDependents'));
const EducationQualifications = lazy(() => import('./sections/EducationQualifications'));
const WorkExperience = lazy(() => import('./sections/WorkExperience'));
const SkillsCompetencies = lazy(() => import('./sections/SkillsCompetencies'));
const BankFinancial = lazy(() => import('./sections/BankFinancial'));
const HealthMedical = lazy(() => import('./sections/HealthMedical'));
const SocialLinks = lazy(() => import('./sections/SocialLinks'));
const PreferencesSettings = lazy(() => import('./sections/PreferencesSettings'));

type SectionId = 'overview' | 'personal' | 'emergency' | 'family' | 'education' | 'experience' | 'skills' | 'bank' | 'health' | 'social' | 'preferences';

interface SectionTab {
  id: SectionId;
  label: string;
  icon: any;
  shortLabel?: string;
}

const SECTIONS: SectionTab[] = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, shortLabel: 'Dashboard' },
  { id: 'personal', label: 'Personal Profile', icon: User, shortLabel: 'Personal' },
  { id: 'emergency', label: 'Emergency Contact', icon: Phone, shortLabel: 'Emergency' },
  { id: 'family', label: 'Family & Dependents', icon: Users, shortLabel: 'Family' },
  { id: 'education', label: 'Education', icon: GraduationCap, shortLabel: 'Education' },
  { id: 'experience', label: 'Work Experience', icon: Briefcase, shortLabel: 'Experience' },
  { id: 'skills', label: 'Skills & Competencies', icon: Code, shortLabel: 'Skills' },
  { id: 'bank', label: 'Bank & Financial', icon: Landmark, shortLabel: 'Bank' },
  { id: 'health', label: 'Health & Medical', icon: HeartPulse, shortLabel: 'Health' },
  { id: 'social', label: 'Social Links', icon: Link2, shortLabel: 'Social' },
  { id: 'preferences', label: 'Preferences', icon: Settings, shortLabel: 'Settings' },
];

const SectionFallback = () => (
  <div className="space-y-4">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-64 w-full rounded-xl" />
    <Skeleton className="h-48 w-full rounded-xl" />
  </div>
);

export default function EmployeeProfile() {
  const { user } = useAuthStore();
  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  // Fetch employee record for current user
  const { data: employee, isLoading, refetch } = useQuery({
    queryKey: ['my-employee-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*, departments(name), designations(title)')
        .eq('user_id', user!.id)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 animate-in fade-in zoom-in-95 duration-500">
        <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center">
          <AlertTriangle className="h-10 w-10 text-destructive/40" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">No employee profile found</h2>
        <p className="text-sm text-muted-foreground max-w-sm text-center">
          Your user account is not linked to an employee record. Please contact your HR administrator.
        </p>
      </div>
    );
  }

  const initials = `${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`.toUpperCase();

  const renderSection = () => {
    const props = { employee, refetch };
    switch (activeSection) {
      case 'overview': return <ProfileDashboard employee={employee} />;
      case 'personal': return <PersonalProfile {...props} />;
      case 'emergency': return <EmergencyContact {...props} />;
      case 'family': return <FamilyDependents {...props} />;
      case 'education': return <EducationQualifications {...props} />;
      case 'experience': return <WorkExperience {...props} />;
      case 'skills': return <SkillsCompetencies {...props} />;
      case 'bank': return <BankFinancial {...props} />;
      case 'health': return <HealthMedical {...props} />;
      case 'social': return <SocialLinks {...props} />;
      case 'preferences': return <PreferencesSettings {...props} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500 pb-20">
      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Avatar className="h-16 w-16 border-2 border-border/50 shadow-sm">
          <AvatarImage src={employee.avatar_url || ''} />
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {employee.first_name} {employee.last_name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {employee.employee_code && (
              <Badge variant="outline" className="text-[10px] font-mono border-border/40 text-muted-foreground">
                {employee.employee_code}
              </Badge>
            )}
            {employee.designations?.title && (
              <span className="text-sm text-muted-foreground">{employee.designations.title}</span>
            )}
            {employee.departments?.name && (
              <>
                <span className="text-muted-foreground/30">•</span>
                <span className="text-sm text-muted-foreground">{employee.departments.name}</span>
              </>
            )}
          </div>
        </div>
        <Badge
          className={`font-mono uppercase text-xs shrink-0 ${
            employee.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/40' :
            employee.status === 'probation' ? 'bg-amber-500/10 text-amber-600 border-amber-500/40' :
            'bg-muted text-muted-foreground'
          }`}
          variant="outline"
        >
          {employee.status}
        </Badge>
      </div>

      {/* Section Tabs */}
      <div className="relative w-full overflow-hidden">
        <ScrollArea className="w-full">
          <div className="flex gap-0 border-b border-border/50 min-w-max">
            {SECTIONS.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/50'
                  }`}
                >
                  <section.icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground/60'}`} />
                  <span className="hidden md:inline">{section.label}</span>
                  <span className="md:hidden">{section.shortLabel || section.label}</span>
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" className="h-1" />
        </ScrollArea>
      </div>

      {/* Active Section Content */}
      <div className="min-h-[400px]">
        <Suspense fallback={<SectionFallback />}>
          {renderSection()}
        </Suspense>
      </div>
    </div>
  );
}
