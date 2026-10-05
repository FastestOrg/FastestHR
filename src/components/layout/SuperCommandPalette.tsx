import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  DollarSign,
  Briefcase,
  GraduationCap,
  Headset,
  Megaphone,
  PieChart,
  Settings,
  Sparkles,
  Search,
  UserCircle2,
  CalendarCheck,
  FileText,
  Contact,
  ActivitySquare,
  BarChart3,
  UserPlus,
  Send,
  Globe,
  Sun,
  Moon,
  Keyboard,
  ShieldCheck,
  CreditCard,
  Network,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/hooks/use-theme';
import { useOrgClient } from '@/hooks/useOrgClient';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface SuperCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenShortcutsHelp?: () => void;
}

export function SuperCommandPalette({
  open,
  onOpenChange,
  onOpenShortcutsHelp,
}: SuperCommandPaletteProps) {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { theme, toggle } = useTheme();
  const { orgClient, isBYOS } = useOrgClient();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch employees for live search
  const { data: employees = [] } = useQuery({
    queryKey: ['palette-employees', profile?.company_id, isBYOS],
    queryFn: async () => {
      if (!profile?.company_id && !isBYOS) return [];
      let query = orgClient
        .from('employees')
        .select('id, first_name, last_name, work_email, avatar_url, departments(name), designations(title), status, employee_code')
        .is('deleted_at', null)
        .limit(60);

      if (!isBYOS && profile?.company_id) {
        query = query.eq('company_id', profile.company_id);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Command palette employee search error:', error);
        return [];
      }
      return data || [];
    },
    enabled: open, // Only fetch when palette is opened
    staleTime: 60 * 1000,
  });

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  const isAdminOrHR =
    profile?.platform_role === 'company_admin' ||
    profile?.platform_role === 'super_admin' ||
    profile?.platform_role === 'hr_manager';

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="relative">
        <CommandInput
          placeholder="Type a command, search colleagues, or jump to modules..."
          value={searchQuery}
          onValueChange={setSearchQuery}
          className="h-14 text-base"
        />
        {isBYOS && (
          <div className="absolute right-3 top-3 hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-500">
            <ShieldCheck className="w-3 h-3" />
            <span>BYOS Active</span>
          </div>
        )}
      </div>

      <CommandList className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin">
        <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
          <div className="flex flex-col items-center justify-center space-y-2">
            <Search className="w-8 h-8 text-muted-foreground/40" />
            <p className="font-medium">No results found for "{searchQuery}"</p>
            <p className="text-xs text-muted-foreground/70">
              Try searching by colleague name, role, department, or action keyword.
            </p>
          </div>
        </CommandEmpty>

        {/* ─── QUICK ACTIONS ────────────────────────────────────────────── */}
        <CommandGroup heading="Instant Actions">
          <CommandItem
            onSelect={() => runCommand(() => navigate('/attendance'))}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-sm">Clock In / Out (Attendance)</span>
                <span className="text-[11px] text-muted-foreground">
                  Record daily punch with GPS / selfie verification
                </span>
              </div>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono font-semibold text-muted-foreground border border-border/50">
              C
            </kbd>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/leave/apply'))}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-sm">Apply for Leave</span>
                <span className="text-[11px] text-muted-foreground">
                  Submit paid, sick, or casual time off request
                </span>
              </div>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono font-semibold text-muted-foreground border border-border/50">
              L
            </kbd>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/payroll'))}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500">
                <DollarSign className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-sm">View Latest Payslip</span>
                <span className="text-[11px] text-muted-foreground">
                  Download monthly salary certificate & tax breakdown
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">G</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">P</kbd>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/culture'))}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-500">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-sm">Give Peer Recognition & Kudos</span>
                <span className="text-[11px] text-muted-foreground">
                  Send praise and celebrate a teammate's achievement
                </span>
              </div>
            </div>
          </CommandItem>

          {isAdminOrHR && (
            <CommandItem
              onSelect={() => runCommand(() => navigate('/recruitment/new'))}
              className="flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-rose-500/10 text-rose-500">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">Post New Job Opening</span>
                  <span className="text-[11px] text-muted-foreground">
                    Create requisition with AI video screener
                  </span>
                </div>
              </div>
            </CommandItem>
          )}

          <CommandItem
            onSelect={() => runCommand(() => navigate('/helpdesk'))}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-sky-500/10 text-sky-500">
                <Headset className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-sm">Raise Helpdesk Ticket</span>
                <span className="text-[11px] text-muted-foreground">
                  HR inquiries, POSH complaints, or IT support
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">G</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">H</kbd>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(toggle)}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-muted text-foreground">
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-sm">
                  Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Toggle platform theme appearance
                </span>
              </div>
            </div>
          </CommandItem>

          {onOpenShortcutsHelp && (
            <CommandItem
              onSelect={() => runCommand(onOpenShortcutsHelp)}
              className="flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-500">
                  <Keyboard className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">View Keyboard Shortcuts Guide</span>
                  <span className="text-[11px] text-muted-foreground">
                    Master FastestHR hotkeys and sequences
                  </span>
                </div>
              </div>
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono font-semibold text-muted-foreground border border-border/50">
                ?
              </kbd>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        {/* ─── TEAM EMPLOYEES ────────────────────────────────────────────── */}
        {employees.length > 0 && (
          <CommandGroup heading={`Colleagues & Team (${employees.length})`}>
            {employees.map((emp: any) => {
              const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Employee';
              const deptName = emp.departments?.name || '';
              const title = emp.designations?.title || '';
              const initials = fullName
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <CommandItem
                  key={emp.id}
                  value={`${fullName} ${emp.work_email || ''} ${deptName} ${title} ${emp.employee_code || ''}`}
                  onSelect={() => runCommand(() => navigate(`/employees/${emp.id}`))}
                  className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 border border-border/40">
                      <AvatarImage src={emp.avatar_url || ''} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{fullName}</span>
                        {emp.employee_code && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            #{emp.employee_code}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {title ? `${title} • ` : ''}
                        {deptName || emp.work_email || 'Staff'}
                      </span>
                    </div>
                  </div>
                  {emp.status && (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-medium capitalize border-border/50"
                    >
                      {emp.status.replace('_', ' ')}
                    </Badge>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* ─── MODULES & WORKFORCE NAVIGATION ────────────────────────────── */}
        <CommandGroup heading="Modules & Navigation">
          <CommandItem
            onSelect={() => runCommand(() => navigate('/dashboard'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Dashboard</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">G</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">D</kbd>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/employees'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Employee Directory</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">G</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">E</kbd>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/org-chart'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Network className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Organization Hierarchy Chart</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">G</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">O</kbd>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/attendance'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Attendance & Punch Log</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">G</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">A</kbd>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/leave'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Leave Management</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">G</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">L</kbd>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/payroll'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Payroll OS</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">G</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">P</kbd>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/recruitment'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Briefcase className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Recruitment & ATS Pipeline</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">G</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">R</kbd>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/performance'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Performance Reviews & OKRs</span>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/kpi'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <ActivitySquare className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">KPI Matrix & Goals</span>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/chats'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Team Chats & Direct Messages</span>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/meetings'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <CalendarCheck className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Calendar & Meeting Scheduler</span>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/documents'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Document Vault & Policies</span>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/id-card'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Contact className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Virtual Digital ID Card</span>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/learning'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <GraduationCap className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Learning & LMS Academy</span>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/announcements'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Megaphone className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Company Announcements Feed</span>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/global-verification'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Global Background Verification</span>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/reports'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <PieChart className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Executive Reports & Data Export</span>
            </div>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => navigate('/settings'))}
            className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">System Settings & Company Profile</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">G</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50">S</kbd>
            </div>
          </CommandItem>
        </CommandGroup>
      </CommandList>

      {/* ─── FOOTER BAR ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px] font-mono">↑↓</kbd>
            <span>Navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px] font-mono">↵</kbd>
            <span>Select</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px] font-mono">esc</kbd>
            <span>Close</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-muted-foreground/60">Press</span>
          <kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px] font-mono font-semibold">
            ?
          </kbd>
          <span className="hidden sm:inline text-muted-foreground/60">for shortcuts</span>
        </div>
      </div>
    </CommandDialog>
  );
}
