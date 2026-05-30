import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { 
  Building, MapPin, Clock, DollarSign, Shield, Calendar, Bell, 
  Mail, KeyIcon, Users, Globe, Contact, Laptop, GitBranch 
} from 'lucide-react';

import GeneralSettings from '@/pages/settings/GeneralSettings';
import LocationsSettings from '@/pages/settings/LocationsSettings';
import DomainSettings from '@/pages/settings/DomainSettings';
import SecuritySettings from '@/pages/settings/SecuritySettings';
import WorkScheduleSettings from '@/pages/settings/WorkScheduleSettings';
import LeaveTypesSettings from '@/pages/settings/LeaveTypesSettings';
import RolesSettings from '@/pages/settings/RolesSettings';
import { IDCardTemplateEditor } from '@/components/settings/IDCardTemplateEditor';
import PayrollSettings from '@/pages/settings/PayrollSettings';
import AssetManagementTab from '@/components/settings/AssetManagementTab';
import EmailDocsSettings from '@/pages/settings/EmailDocsSettings';
import NotificationsSettings from '@/pages/settings/NotificationsSettings';
import IntegrationsSettings from '@/pages/settings/IntegrationsSettings';
import WorkflowBuilder from '@/components/settings/WorkflowBuilder';

export default function Settings() {
  const { profile } = useAuthStore();
  const location = useLocation();
  const currentPath = location.pathname;

  const menuGroups = [
    {
      title: 'General Workspace',
      items: [
        { path: '/settings', label: 'General Info', icon: Building },
        { path: '/settings/locations', label: 'Office Locations', icon: MapPin },
        { path: '/settings/domains', label: 'Domains', icon: Globe },
        { path: '/settings/security', label: 'Security & SSO', icon: KeyIcon },
      ]
    },
    {
      title: 'People & Policy',
      items: [
        { path: '/settings/schedule', label: 'Work Schedule', icon: Clock },
        { path: '/settings/leaves', label: 'Leave Types', icon: Calendar },
        { path: '/settings/roles', label: 'Roles & Access', icon: Shield },
        { path: '/settings/id-card', label: 'ID Cards', icon: Contact },
      ]
    },
    {
      title: 'Finance & Assets',
      items: [
        { path: '/settings/payroll', label: 'Payroll Config', icon: DollarSign },
        { path: '/settings/assets', label: 'Asset Management', icon: Laptop },
      ]
    },
    {
      title: 'Automation & Alerts',
      items: [
        { path: '/settings/email-docs', label: 'Email & SMTP', icon: Mail },
        { path: '/settings/notifications', label: 'Notifications', icon: Bell },
        { path: '/settings/integrations', label: 'Integrations', icon: Users },
        { path: '/settings/workflows', label: 'Workflow Engine', icon: GitBranch },
      ]
    }
  ];

  // Flattened array for mobile slider rendering
  const allItems = menuGroups.flatMap(group => group.items);

  const isActive = (path: string) => {
    if (path === '/settings') {
      return currentPath === '/settings' || currentPath === '/settings/';
    }
    return currentPath.startsWith(path);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground">
          Workspace Settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Orchestrate and calibrate FastestHR resources, controls, and configurations</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-8 items-start">
        {/* Left Navigation Column */}
        <div className="col-span-1 lg:sticky lg:top-6">
          {/* Mobile Horizontally Scrollable Pills */}
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            {allItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25 scale-[1.02]'
                      : 'bg-card/40 hover:bg-card/85 text-muted-foreground border-border/50'
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Desktop Elegant Category Grouped Sidebar */}
          <div className="hidden lg:block space-y-6 bg-card/40 backdrop-blur-md rounded-2xl border border-border/50 p-4 accent-glow">
            {menuGroups.map((group) => (
              <div key={group.title} className="space-y-2">
                <h3 className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 select-none">
                  {group.title}
                </h3>
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 group border-l-2 relative overflow-hidden ${
                          active
                            ? 'bg-primary/10 border-l-primary text-primary font-medium pl-4 shadow-[inset_1px_0_0_0_rgba(124,58,237,0.1)]'
                            : 'border-l-transparent text-muted-foreground hover:text-foreground hover:bg-primary/5 hover:border-l-primary/30 pl-3'
                        }`}
                      >
                        <item.icon className={`w-4 h-4 transition-transform group-hover:scale-105 ${active ? 'text-primary' : 'text-muted-foreground/80 group-hover:text-foreground'}`} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Content Panel Column */}
        <div className="lg:col-span-3 min-h-[500px]">
          <Routes>
            <Route path="/" element={<GeneralSettings />} />
            <Route path="/locations" element={<LocationsSettings />} />
            <Route path="/domains" element={<DomainSettings />} />
            <Route path="/security" element={<SecuritySettings />} />
            <Route path="/schedule" element={<WorkScheduleSettings />} />
            <Route path="/leaves" element={<LeaveTypesSettings />} />
            <Route path="/roles" element={<RolesSettings />} />
            <Route path="/id-card" element={<IDCardTemplateEditor />} />
            <Route path="/payroll" element={<PayrollSettings />} />
            <Route path="/assets" element={<AssetManagementTab companyId={profile?.company_id} />} />
            <Route path="/email-docs" element={<EmailDocsSettings />} />
            <Route path="/notifications" element={<NotificationsSettings />} />
            <Route path="/integrations" element={<IntegrationsSettings />} />
            <Route path="/workflows" element={<WorkflowBuilder companyId={profile?.company_id} />} />
            <Route path="*" element={<Navigate to="/settings" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
