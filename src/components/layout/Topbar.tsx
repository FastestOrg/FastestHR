import { useState, useEffect } from 'react';
import { Moon, Sun, Search, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/hooks/use-theme';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationsDropdown } from './NotificationsDropdown';
import { Badge } from '@/components/ui/badge';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export function Topbar() {
  const { profile, signOut } = useAuthStore();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const breadcrumbs = location.pathname
    .split('/')
    .filter(Boolean)
    .map((seg, i, arr) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
      path: '/' + arr.slice(0, i + 1).join('/'),
    }));

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/60 backdrop-blur-md px-4">
      <SidebarTrigger className="-ml-1" />

      {/* Breadcrumbs */}
      <nav className="hidden items-center gap-1.5 text-sm md:flex">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.path} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-primary/50">/</span>}
            <span className={i === breadcrumbs.length - 1 ? 'font-medium text-primary' : 'text-muted-foreground transition-colors hover:text-primary'}>
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Mobile Search Icon */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
      </Button>

      {/* Desktop Search */}
      <Button
        variant="outline"
        className="hidden h-9 w-64 justify-start gap-2 border-border bg-background/50 text-muted-foreground hover:border-primary/50 hover:text-foreground md:flex transition-all backdrop-blur-sm"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span className="text-sm">Search...</span>
        <kbd className="ml-auto rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">⌘K</kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Quick Links">
            <CommandItem onSelect={() => { setOpen(false); navigate('/dashboard'); }}>Dashboard</CommandItem>
            <CommandItem onSelect={() => { setOpen(false); navigate('/employees'); }}>Employees</CommandItem>
            <CommandItem onSelect={() => { setOpen(false); navigate('/recruitment'); }}>Recruitment</CommandItem>
            <CommandItem onSelect={() => { setOpen(false); navigate('/payroll'); }}>Payroll</CommandItem>
            <CommandItem onSelect={() => { setOpen(false); navigate('/settings'); }}>Settings</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Theme toggle */}
      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggle} aria-label="Toggle theme">
        {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </Button>

      {/* Notifications */}
      <NotificationsDropdown />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium md:inline">{profile?.full_name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => navigate('/settings/profile')}>My Profile</DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/settings')}>Settings</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="text-destructive">Sign Out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
