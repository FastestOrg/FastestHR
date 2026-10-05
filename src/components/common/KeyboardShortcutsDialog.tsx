import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Keyboard, Navigation, Zap, Command as CommandIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcuts: ShortcutItem[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    category: 'Global & Search',
    icon: CommandIcon,
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open Spotlight Command Center' },
      { keys: ['Ctrl', 'K'], description: 'Open Spotlight Command Center (Windows/Linux)' },
      { keys: ['?'], description: 'Show this keyboard shortcuts guide' },
      { keys: ['Esc'], description: 'Close active modal / command palette' },
    ],
  },
  {
    category: 'Instant Actions',
    icon: Zap,
    shortcuts: [
      { keys: ['C'], description: 'Instant Clock In / Out (Attendance punch)' },
      { keys: ['L'], description: 'Quick Apply for Leave' },
    ],
  },
  {
    category: 'Navigation Sequences ("Go To")',
    icon: Navigation,
    shortcuts: [
      { keys: ['G', 'then', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'then', 'E'], description: 'Go to Employees Directory' },
      { keys: ['G', 'then', 'A'], description: 'Go to Attendance' },
      { keys: ['G', 'then', 'L'], description: 'Go to Leave Management' },
      { keys: ['G', 'then', 'P'], description: 'Go to Payroll OS' },
      { keys: ['G', 'then', 'R'], description: 'Go to Recruitment Pipeline' },
      { keys: ['G', 'then', 'S'], description: 'Go to Company Settings' },
    ],
  },
];

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card/95 backdrop-blur-xl border-border/60 shadow-2xl p-6">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border/40">
          <div className="flex items-center gap-2 text-primary">
            <Keyboard className="w-5 h-5" />
            <DialogTitle className="text-xl font-bold tracking-tight">Keyboard Shortcuts</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Navigate FastestHR at 100X velocity with keyboard-first shortcuts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-3 max-h-[65vh] overflow-y-auto pr-1">
          {SHORTCUT_CATEGORIES.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.category} className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Icon className="w-3.5 h-3.5 text-primary/70" />
                  <span>{section.category}</span>
                </div>
                <div className="grid gap-2">
                  {section.shortcuts.map((shortcut, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border/30 transition-colors text-sm"
                    >
                      <span className="text-foreground/90 font-medium">{shortcut.description}</span>
                      <div className="flex items-center gap-1 font-mono">
                        {shortcut.keys.map((k, idx) =>
                          k === 'then' ? (
                            <span key={idx} className="text-xs text-muted-foreground mx-0.5">
                              then
                            </span>
                          ) : (
                            <kbd
                              key={idx}
                              className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-background px-1.5 text-xs font-semibold text-foreground shadow-sm"
                            >
                              {k}
                            </kbd>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
          <span>Pro tip: Press <kbd className="px-1 py-0.5 rounded bg-muted font-mono">?</kbd> anywhere to open this sheet.</span>
          <Badge variant="outline" className="font-mono text-[10px]">FastestHR v2.0</Badge>
        </div>
      </DialogContent>
    </Dialog>
  );
}
