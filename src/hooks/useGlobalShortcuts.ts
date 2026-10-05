import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface GlobalShortcutsOptions {
  onOpenCommandPalette?: () => void;
  onOpenShortcutsHelp?: () => void;
  onClockInOut?: () => void;
  onApplyLeave?: () => void;
}

export function useGlobalShortcuts({
  onOpenCommandPalette,
  onOpenShortcutsHelp,
  onClockInOut,
  onApplyLeave,
}: GlobalShortcutsOptions = {}) {
  const navigate = useNavigate();
  const pendingSequenceRef = useRef<string | null>(null);
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 1. Ignore if inside input, textarea, or contentEditable element
      const target = event.target as HTMLElement | null;
      const isInput =
        target &&
        typeof target.getAttribute === 'function' &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.getAttribute('role') === 'textbox');

      // Command + K or Ctrl + K always works even if in input
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenCommandPalette?.();
        return;
      }

      // If user is typing in an input field, do not trigger single/sequence hotkeys
      if (isInput) return;

      // Do not trigger if any modifier keys like Alt, Ctrl, Meta are held
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const key = event.key;

      // 2. Open keyboard shortcuts cheat sheet on '?'
      if (key === '?') {
        event.preventDefault();
        onOpenShortcutsHelp?.();
        return;
      }

      // 3. Quick Action 'C' for Clock In / Out
      if (key.toLowerCase() === 'c' && !pendingSequenceRef.current) {
        event.preventDefault();
        if (onClockInOut) {
          onClockInOut();
        } else {
          navigate('/attendance');
        }
        return;
      }

      // 4. Quick Action 'L' for Leave Application
      if (key.toLowerCase() === 'l' && !pendingSequenceRef.current) {
        event.preventDefault();
        if (onApplyLeave) {
          onApplyLeave();
        } else {
          navigate('/leave/apply');
        }
        return;
      }

      // 5. Sequence handling (e.g. 'g' then 'd', 'e', 'p', 'a', 'r', 's')
      if (key.toLowerCase() === 'g' && !pendingSequenceRef.current) {
        pendingSequenceRef.current = 'g';
        if (sequenceTimeoutRef.current) clearTimeout(sequenceTimeoutRef.current);
        sequenceTimeoutRef.current = setTimeout(() => {
          pendingSequenceRef.current = null;
        }, 1000);
        return;
      }

      if (pendingSequenceRef.current === 'g') {
        const nextKey = key.toLowerCase();
        pendingSequenceRef.current = null;
        if (sequenceTimeoutRef.current) clearTimeout(sequenceTimeoutRef.current);

        switch (nextKey) {
          case 'd':
            event.preventDefault();
            navigate('/dashboard');
            break;
          case 'e':
            event.preventDefault();
            navigate('/employees');
            break;
          case 'a':
            event.preventDefault();
            navigate('/attendance');
            break;
          case 'l':
            event.preventDefault();
            navigate('/leave');
            break;
          case 'p':
            event.preventDefault();
            navigate('/payroll');
            break;
          case 'r':
            event.preventDefault();
            navigate('/recruitment');
            break;
          case 's':
            event.preventDefault();
            navigate('/settings');
            break;
          case 'o':
            event.preventDefault();
            navigate('/org-chart');
            break;
          case 't':
            event.preventDefault();
            navigate('/tasks');
            break;
          case 'h':
            event.preventDefault();
            navigate('/helpdesk');
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (sequenceTimeoutRef.current) clearTimeout(sequenceTimeoutRef.current);
    };
  }, [navigate, onOpenCommandPalette, onOpenShortcutsHelp, onClockInOut, onApplyLeave]);
}
