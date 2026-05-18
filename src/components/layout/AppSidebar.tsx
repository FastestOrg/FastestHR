import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, Users, Clock, CalendarDays, DollarSign, BarChart3,
  Briefcase, GraduationCap, Headset, Megaphone, PieChart, Settings,
  Globe, Building2, CreditCard, Server, ChevronLeft, LogOut, Zap,
  FileText, UserPlus, Network, UserMinus, CalendarCheck, ChevronRight, Send, Shield, Contact, UserCircle2
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NavLink } from '@/components/NavLink';
import { useAuthStore } from '@/store/auth-store';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

type Role = 'super_admin' | 'company_admin' | 'hr_manager' | 'recruiter' | 'user';

interface NavItem {
  title: string;
  url: string;
  icon: any;
  roles: Role[]; // which roles can see this item
  subItems?: Omit<NavItem, 'icon' | 'subItems'>[];
}

const ALL_ROLES: Role[] = ['company_admin', 'hr_manager', 'recruiter', 'user'];
const ADMIN_HR: Role[] = ['company_admin', 'hr_manager'];
const ADMIN_ONLY: Role[] = ['company_admin'];

const fastBoardNav: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, roles: ALL_ROLES },
  { title: 'My Profile', url: '/profile', icon: UserCircle2, roles: ALL_ROLES },
  { title: 'Announcements', url: '/announcements', icon: Megaphone, roles: ALL_ROLES },
  { title: 'Employee', url: '/employees', icon: Users, roles: ADMIN_HR },
  { title: 'Attendance', url: '/attendance', icon: Clock, roles: ALL_ROLES },
  { title: 'Leave', url: '/leave', icon: CalendarDays, roles: ALL_ROLES },
  { title: 'Holidays', url: '/holidays', icon: CalendarCheck, roles: ALL_ROLES },
  { title: 'Documents', url: '/documents', icon: FileText, roles: ALL_ROLES },
  { title: 'Learning', url: '/learning', icon: GraduationCap, roles: ALL_ROLES },
  { title: 'Virtual ID Card', url: '/id-card', icon: Contact, roles: ALL_ROLES },
  { title: 'Tasks', url: '/tasks', icon: CalendarCheck, roles: ALL_ROLES },
  { title: 'Referrals', url: '/referrals', icon: UserPlus, roles: ALL_ROLES },
];

const managementNav: NavItem[] = [
  { title: 'Recruitment', url: '/recruitment', icon: Briefcase, roles: ['company_admin', 'hr_manager', 'recruiter'] },
  { title: 'Onboarding', url: '/onboarding', icon: UserPlus, roles: ADMIN_HR },
  { title: 'Performance', url: '/performance', icon: BarChart3, roles: ALL_ROLES },
  { title: 'Help Desk', url: '/helpdesk', icon: Headset, roles: ALL_ROLES },
  { title: 'Reports', url: '/reports', icon: PieChart, roles: ADMIN_HR },
  { title: 'Payroll', url: '/payroll', icon: DollarSign, roles: [...ADMIN_HR, 'user', 'recruiter'] },
  { title: 'Exit Management', url: '/exit-management', icon: UserMinus, roles: ADMIN_HR },
  { title: 'SendDesk', url: '/senddesk', icon: Send, roles: ADMIN_HR },
];

const accountNav: NavItem[] = [
  { title: 'Billing', url: '/billing', icon: CreditCard, roles: ADMIN_ONLY },
  { title: 'Roles', url: '/roles', icon: Shield, roles: ADMIN_ONLY },
  { title: 'Settings', url: '/settings', icon: Settings, roles: ADMIN_ONLY },
];

const superAdminNav = [
  { title: 'Platform Overview', url: '/admin', icon: Globe },
  { title: 'Companies', url: '/admin/companies', icon: Building2 },
  { title: 'Subscriptions', url: '/admin/subscriptions', icon: CreditCard },
  { title: 'System', url: '/admin/system', icon: Server },
];

function buildRoleMap(navItems: NavItem[]): Record<Role, NavItem[]> {
  const map = {} as Record<Role, NavItem[]>;
  for (const item of navItems) {
    for (const role of item.roles) {
      if (!map[role]) map[role] = [];
      map[role].push(item);
    }
  }
  return map;
}

const fastBoardNavMap = buildRoleMap(fastBoardNav);
const managementNavMap = buildRoleMap(managementNav);
const accountNavMap = buildRoleMap(accountNav);

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { profile, signOut } = useAuthStore();
  const isSuperAdmin = profile?.platform_role === 'super_admin';
  const userRole = (profile?.platform_role || 'user') as Role;

  // Fetch company data for branding
  const { data: company } = useQuery({
    queryKey: ['company-branding', profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('companies')
        .select('name, logo_url, slug')
        .eq('id', profile!.company_id!)
        .single();
      return data;
    },
    enabled: !!profile?.company_id,
    staleTime: 5 * 60 * 1000,
  });

  const filteredFastBoard = isSuperAdmin ? fastBoardNav : (fastBoardNavMap[userRole] || []);
  const filteredManagement = isSuperAdmin ? managementNav : (managementNavMap[userRole] || []);
  const filteredAccount = isSuperAdmin ? accountNav : (accountNavMap[userRole] || []);

  const isActive = (url: string) => {
    if (url === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(url);
  };

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const roleLabel = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: 'Super Admin',
      company_admin: 'Admin',
      hr_manager: 'HR Manager',
      recruiter: 'Recruiter',
      user: 'Employee',
    };
    return labels[role] || role;
  };

  const companyInitial = company?.name?.[0]?.toUpperCase() || 'F';
  const companyName = company?.name || 'FastestHR';

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          {company?.logo_url ? (
            <img
              src={company.logo_url}
              alt={companyName}
              className="h-8 w-8 shrink-0 rounded-xl object-cover ring-1 ring-border/50 transition-all duration-300 group-hover:ring-primary/50"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground font-bold text-sm">
              {companyInitial}
            </div>
          )}
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight truncate">{companyName}</span>
          )}
        </Link>
      </SidebarHeader>

      <Separator />

      <SidebarContent className="px-2">
        {filteredFastBoard.length > 0 && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">FastBoard</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredFastBoard.map((item) => (
                  item.subItems ? (
                    <Collapsible key={item.title} asChild defaultOpen={isActive(item.url) || item.subItems.some(sub => isActive(sub.url))}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={item.title}>
                            <item.icon className="h-4 w-4 shrink-0" />
                            {!collapsed && <span>{item.title}</span>}
                            {!collapsed && <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.subItems.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton asChild isActive={isActive(subItem.url)}>
                                  <NavLink
                                    to={subItem.url}
                                    className="transition-all hover:text-primary font-medium w-full"
                                    activeClassName="bg-primary/10 text-primary font-semibold rounded-md"
                                  >
                                    <span>{subItem.title}</span>
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  ) : (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        tooltip={item.title}
                      >
                        <NavLink
                          to={item.url}
                          className="transition-all hover:text-primary font-medium"
                          activeClassName="bg-primary/10 text-primary font-semibold rounded-md"
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {filteredManagement.length > 0 && (
          <SidebarGroup>
            <Separator className="mb-2" />
            {!collapsed && <SidebarGroupLabel className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Management</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredManagement.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <NavLink
                        to={item.url}
                        className="transition-all hover:text-primary font-medium"
                        activeClassName="bg-primary/10 text-primary font-semibold rounded-md"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {filteredAccount.length > 0 && (
          <SidebarGroup>
            <Separator className="mb-2" />
            {!collapsed && <SidebarGroupLabel className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredAccount.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <NavLink
                        to={item.url}
                        className="transition-all hover:text-primary font-medium"
                        activeClassName="bg-primary/10 text-primary font-semibold rounded-md"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isSuperAdmin && (
          <SidebarGroup>
            <Separator className="mb-2" />
            {!collapsed && <SidebarGroupLabel className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin Override</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {superAdminNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <NavLink
                        to={item.url}
                        className="transition-all hover:text-destructive font-medium"
                        activeClassName="bg-destructive/10 text-destructive font-semibold rounded-md"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <Separator className="mb-3" />
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-primary/20 text-primary font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-primary">{profile?.full_name}</span>
              <Badge variant="outline" className="w-fit border-border text-[10px] capitalize text-muted-foreground mt-1">
                {roleLabel(profile?.platform_role || 'user')}
              </Badge>
            </div>
          )}
          {!collapsed && (
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={signOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
