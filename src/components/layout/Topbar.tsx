import { useState } from 'react';
import { Moon, Sun, Search, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/hooks/use-theme';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationsDropdown } from './NotificationsDropdown';
import { SuperCommandPalette } from './SuperCommandPalette';
import { KeyboardShortcutsDialog } from '@/components/common/KeyboardShortcutsDialog';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';

export function Topbar() {
  const { profile, signOut } = useAuthStore();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Register global shortcuts: Cmd+K, ?, C (Clock-in), L (Leave), and G sequences
  useGlobalShortcuts({
    onOpenCommandPalette: () => setCommandOpen(true),
    onOpenShortcutsHelp: () => setShortcutsOpen(true),
  });

  const breadcrumbs = location.pathname
    .split('/')
    .filter(Boolean)
    .map((seg, i, arr) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
      path: '/' + arr.slice(0, i + 1).join('/'),
    }));

  const initials =
    profile?.full_name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/60 backdrop-blur-md px-4">
        <SidebarTrigger className="-ml-1" />

        {/* Breadcrumbs */}
        <nav className="hidden items-center gap-1.5 text-sm md:flex">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-primary/50">/</span>}
              <span
                className={
                  i === breadcrumbs.length - 1
                    ? 'font-medium text-primary'
                    : 'text-muted-foreground transition-colors hover:text-primary'
                }
              >
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
          onClick={() => setCommandOpen(true)}
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Desktop Super Search Bar */}
        <Button
          variant="outline"
          className="hidden h-9 w-64 justify-start gap-2 border-border/70 bg-background/50 text-muted-foreground hover:border-primary/50 hover:text-foreground md:flex transition-all backdrop-blur-sm shadow-sm group"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-xs">Quick search or command...</span>
          <kbd className="ml-auto rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </Button>

        {/* Keyboard Shortcuts Sheet trigger button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={() => setShortcutsOpen(true)}
          title="Keyboard Shortcuts (?)"
          aria-label="Keyboard Shortcuts"
        >
          <Keyboard className="h-4 w-4" />
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={toggle}
          aria-label="Toggle theme"
          title="Toggle appearance"
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>

        {/* Notifications */}
        <NotificationsDropdown />

        {/* User profile menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2" aria-label="User menu">
              <Avatar className="h-7 w-7 border border-border/40">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline">{profile?.full_name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 shadow-xl">
            <DropdownMenuItem onClick={() => navigate('/profile')}>My Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
              Shortcuts <span className="ml-auto font-mono text-[10px] text-muted-foreground">?</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Spotlight Command Center Dialog */}
      <SuperCommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onOpenShortcutsHelp={() => setShortcutsOpen(true)}
      />

      {/* Keyboard Shortcuts Cheat Sheet Dialog */}
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </>
  );
}
