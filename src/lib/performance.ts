/**
 * FastestHR Performance Monitoring Suite
 * Focused on Interaction to Next Paint (INP) and Long Tasks
 */

export const initPerformanceMonitoring = () => {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  try {
    // 1. Monitor Long Animation Frames (LoAF) - Modern way to track INP causes
    // @ts-ignore
    const loafObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Only warn for significant blocking frames (>150ms) that occur after the initial loading/hydration phase (first 3 seconds).
        // During startup, a blocked thread is normal as the browser executes bundles and renders/hydrates the DOM.
        const isPostLoad = entry.startTime > 3000;
        if (entry.duration > 150 && isPostLoad) {
          console.warn('[Performance] Long Animation Frame detected:', {
            duration: `${entry.duration.toFixed(2)}ms`,
            startTime: entry.startTime,
            // @ts-ignore
            renderStart: entry.renderStart,
            scripts: (entry as any).scripts?.map((s: any) => ({
              duration: s.duration,
              source: s.sourceLocation,
              type: s.invokerType
            }))
          });
        } else if (entry.duration > 50) {
          console.debug('[Performance] Moderate or Startup Animation Frame detected:', {
            duration: `${entry.duration.toFixed(2)}ms`,
            startTime: entry.startTime,
            // @ts-ignore
            renderStart: entry.renderStart,
            scripts: (entry as any).scripts?.map((s: any) => ({
              duration: s.duration,
              source: s.sourceLocation,
              type: s.invokerType
            }))
          });
        }
      }
    });
    // @ts-ignore
    loafObserver.observe({ type: 'long-animation-frame', buffered: true });

    // 2. Monitor Event Timing (Foundational for INP)
    const eventObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // @ts-ignore
        const interactionId = entry.interactionId;
        if (interactionId && entry.duration > 200) {
          console.warn('[Performance] High INP Interaction detected:', {
            name: entry.name,
            duration: `${entry.duration.toFixed(2)}ms`,
            interactionId,
            startTime: entry.startTime
          });
        }
      }
    });
    eventObserver.observe({ type: 'event', buffered: true });

    // 3. Monitor Layout Shifts (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
          if (clsValue > 0.1) {
            console.warn('[Performance] Cumulative Layout Shift warning:', clsValue.toFixed(4));
          }
        }
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });

    console.log('[Performance] FastestHR Monitoring Suite Initialized');
  } catch (e) {
    console.error('[Performance] Failed to initialize monitoring:', e);
  }
};
