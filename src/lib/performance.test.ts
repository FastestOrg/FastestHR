import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initPerformanceMonitoring } from './performance';

describe('Performance Monitoring', () => {
  let originalWindow: { PerformanceObserver?: unknown };
  let observeMock: ReturnType<typeof vi.fn>;
  let mockObservers: Array<{ callback: (list: unknown) => void }> = [];

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    observeMock = vi.fn();
    mockObservers = [];

    // Save the original PerformanceObserver descriptor or property
    const desc = Object.getOwnPropertyDescriptor(window, 'PerformanceObserver');
    originalWindow = { PerformanceObserver: desc ? desc.value : undefined };

    Object.defineProperty(window, 'PerformanceObserver', {
      writable: true,
      configurable: true,
      value: class MockPerformanceObserver {
        callback: (list: unknown) => void;
        constructor(callback: (list: unknown) => void) {
          this.callback = callback;
          mockObservers.push(this);
        }
        observe = observeMock;
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalWindow.PerformanceObserver !== undefined) {
      Object.defineProperty(window, 'PerformanceObserver', {
        writable: true,
        configurable: true,
        value: originalWindow.PerformanceObserver
      });
    } else {
      Object.defineProperty(window, 'PerformanceObserver', {
        writable: true,
        configurable: true,
        value: undefined
      });
    }
  });

  it('should return early if PerformanceObserver is not in window', () => {
    Object.defineProperty(window, 'PerformanceObserver', {
      writable: true,
      configurable: true,
      value: undefined
    });

    initPerformanceMonitoring();

    expect(observeMock).not.toHaveBeenCalled();
  });

  it('should initialize observers for long-animation-frame, event, and layout-shift', () => {
    initPerformanceMonitoring();

    expect(observeMock).toHaveBeenCalledWith({ type: 'long-animation-frame', buffered: true });
    expect(observeMock).toHaveBeenCalledWith({ type: 'event', buffered: true });
    expect(observeMock).toHaveBeenCalledWith({ type: 'layout-shift', buffered: true });
  });

  it('should catch and log errors if initialization throws', () => {
    observeMock.mockImplementationOnce(() => {
      throw new Error('Mock error');
    });

    initPerformanceMonitoring();

    expect(console.error).toHaveBeenCalledWith(
      '[Performance] Failed to initialize monitoring:',
      expect.any(Error)
    );
  });

  describe('Long Animation Frames (LoAF)', () => {
    it('should warn for significant blocking frames (>150ms) after startup', () => {
      initPerformanceMonitoring();

      const loafObserver = mockObservers[0];
      const mockList = {
        getEntries: () => [{
          startTime: 3001,
          duration: 151,
          renderStart: 3050,
          scripts: []
        }]
      };

      loafObserver.callback(mockList);

      expect(console.warn).toHaveBeenCalledWith(
        '[Performance] Long Animation Frame detected:',
        expect.objectContaining({
          duration: '151.00ms',
          startTime: 3001
        })
      );
    });

    it('should debug for moderate blocking frames (>50ms, <150ms) after startup', () => {
      initPerformanceMonitoring();

      const loafObserver = mockObservers[0];
      const mockList = {
        getEntries: () => [{
          startTime: 3001,
          duration: 100,
          renderStart: 3050,
          scripts: []
        }]
      };

      loafObserver.callback(mockList);

      expect(console.debug).toHaveBeenCalledWith(
        '[Performance] Moderate or Startup Animation Frame detected:',
        expect.objectContaining({
          duration: '100.00ms',
          startTime: 3001
        })
      );
    });

    it('should debug for significant blocking frames (>150ms) during startup (<3000ms)', () => {
      initPerformanceMonitoring();

      const loafObserver = mockObservers[0];
      const mockList = {
        getEntries: () => [{
          startTime: 1000,
          duration: 200,
          renderStart: 1050,
          scripts: []
        }]
      };

      loafObserver.callback(mockList);

      expect(console.debug).toHaveBeenCalledWith(
        '[Performance] Moderate or Startup Animation Frame detected:',
        expect.objectContaining({
          duration: '200.00ms',
          startTime: 1000
        })
      );
    });
  });

  describe('Event Timing (INP)', () => {
    it('should warn for high INP interactions (>200ms)', () => {
      initPerformanceMonitoring();

      const eventObserver = mockObservers[1];
      const mockList = {
        getEntries: () => [{
          interactionId: 123,
          duration: 201,
          name: 'click',
          startTime: 1000
        }]
      };

      eventObserver.callback(mockList);

      expect(console.warn).toHaveBeenCalledWith(
        '[Performance] High INP Interaction detected:',
        expect.objectContaining({
          name: 'click',
          duration: '201.00ms',
          interactionId: 123
        })
      );
    });

    it('should not warn if interaction duration is <= 200ms', () => {
      initPerformanceMonitoring();

      const eventObserver = mockObservers[1];
      const mockList = {
        getEntries: () => [{
          interactionId: 124,
          duration: 200,
          name: 'click',
          startTime: 1000
        }]
      };

      eventObserver.callback(mockList);

      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should not warn if interactionId is missing', () => {
      initPerformanceMonitoring();

      const eventObserver = mockObservers[1];
      const mockList = {
        getEntries: () => [{
          duration: 201,
          name: 'click',
          startTime: 1000
        }]
      };

      eventObserver.callback(mockList);

      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('Cumulative Layout Shift (CLS)', () => {
    it('should warn if accumulated CLS > 0.1', () => {
      initPerformanceMonitoring();

      const clsObserver = mockObservers[2];
      const mockList1 = {
        getEntries: () => [{
          hadRecentInput: false,
          value: 0.05
        }]
      };
      const mockList2 = {
        getEntries: () => [{
          hadRecentInput: false,
          value: 0.06
        }]
      };

      clsObserver.callback(mockList1);
      expect(console.warn).not.toHaveBeenCalled();

      clsObserver.callback(mockList2);
      expect(console.warn).toHaveBeenCalledWith(
        '[Performance] Cumulative Layout Shift warning:',
        '0.1100'
      );
    });

    it('should ignore layout shifts with recent input', () => {
      initPerformanceMonitoring();

      const clsObserver = mockObservers[2];
      const mockList = {
        getEntries: () => [{
          hadRecentInput: true,
          value: 0.2
        }]
      };

      clsObserver.callback(mockList);

      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
