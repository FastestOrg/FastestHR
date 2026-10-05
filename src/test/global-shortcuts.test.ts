import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';

// Mock react-router-dom useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('useGlobalShortcuts Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers onOpenCommandPalette on Cmd+K or Ctrl+K', () => {
    const onOpenCommandPalette = vi.fn();
    renderHook(() => useGlobalShortcuts({ onOpenCommandPalette }));

    // Simulate Cmd+K
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(onOpenCommandPalette).toHaveBeenCalledTimes(1);
  });

  it('triggers onOpenShortcutsHelp on ? key when not in an input', () => {
    const onOpenShortcutsHelp = vi.fn();
    renderHook(() => useGlobalShortcuts({ onOpenShortcutsHelp }));

    const event = new KeyboardEvent('keydown', {
      key: '?',
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(onOpenShortcutsHelp).toHaveBeenCalledTimes(1);
  });

  it('ignores shortcuts when active element is an INPUT', () => {
    const onOpenShortcutsHelp = vi.fn();
    renderHook(() => useGlobalShortcuts({ onOpenShortcutsHelp }));

    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = new KeyboardEvent('keydown', {
      key: '?',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'target', { value: input, enumerable: true });

    window.dispatchEvent(event);

    expect(onOpenShortcutsHelp).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('navigates to attendance on C key', () => {
    renderHook(() => useGlobalShortcuts());

    const event = new KeyboardEvent('keydown', {
      key: 'c',
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(mockNavigate).toHaveBeenCalledWith('/attendance');
  });

  it('navigates to leave apply on L key', () => {
    renderHook(() => useGlobalShortcuts());

    const event = new KeyboardEvent('keydown', {
      key: 'l',
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(mockNavigate).toHaveBeenCalledWith('/leave/apply');
  });

  it('navigates sequentially on G then D to /dashboard', () => {
    renderHook(() => useGlobalShortcuts());

    // Press 'g'
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'g', bubbles: true, cancelable: true })
    );

    // Press 'd'
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'd', bubbles: true, cancelable: true })
    );

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('navigates sequentially on G then E to /employees', () => {
    renderHook(() => useGlobalShortcuts());

    // Press 'g'
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'g', bubbles: true, cancelable: true })
    );

    // Press 'e'
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'e', bubbles: true, cancelable: true })
    );

    expect(mockNavigate).toHaveBeenCalledWith('/employees');
  });
});
