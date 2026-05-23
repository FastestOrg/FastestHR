import { useState, useEffect, useCallback, useRef } from 'react';

interface ScrollInfo {
  direction: 'up' | 'down' | null;
  scrollY: number;
  isAtTop: boolean;
}

const SCROLL_THRESHOLD = 10; // Minimum scroll delta before changing direction

export function useScrollDirection(): ScrollInfo {
  const [scrollInfo, setScrollInfo] = useState<ScrollInfo>({
    direction: null,
    scrollY: 0,
    isAtTop: true,
  });

  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const updateScrollInfo = useCallback(() => {
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - lastScrollY.current;
    const isAtTop = currentScrollY < 80;

    if (Math.abs(delta) >= SCROLL_THRESHOLD) {
      setScrollInfo({
        direction: isAtTop ? 'up' : (delta > 0 ? 'down' : 'up'),
        scrollY: currentScrollY,
        isAtTop,
      });
      lastScrollY.current = currentScrollY;
    } else {
      setScrollInfo((prev) => ({
        ...prev,
        direction: isAtTop ? 'up' : prev.direction,
        scrollY: currentScrollY,
        isAtTop,
      }));
    }

    ticking.current = false;
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(updateScrollInfo);
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [updateScrollInfo]);

  return scrollInfo;
}
