import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useScrollDirection } from "./use-scroll-direction";

describe("useScrollDirection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const triggerScroll = (scrollY: number) => {
    vi.spyOn(window, "scrollY", "get").mockReturnValue(scrollY);
    window.dispatchEvent(new Event("scroll"));
    act(() => {
      vi.runAllTimers(); // For requestAnimationFrame
    });
  };

  it("should initialize with default values", () => {
    const { result } = renderHook(() => useScrollDirection());
    expect(result.current).toEqual({
      direction: null,
      scrollY: 0,
      isAtTop: true,
    });
  });

  it("should update isAtTop when scrolled slightly", () => {
    const { result } = renderHook(() => useScrollDirection());

    triggerScroll(50); // still considered top as < 80

    expect(result.current.isAtTop).toBe(true);
    expect(result.current.scrollY).toBe(50);
  });

  it("should change isAtTop to false when scrolled past 80px", () => {
    const { result } = renderHook(() => useScrollDirection());

    triggerScroll(100);

    expect(result.current.isAtTop).toBe(false);
    expect(result.current.scrollY).toBe(100);
  });

  it("should update direction to 'down' when scrolling down past threshold", () => {
    const { result } = renderHook(() => useScrollDirection());

    // Initially at top
    expect(result.current.direction).toBe(null);

    // Scroll down to 100, delta = 100 > SCROLL_THRESHOLD (10), currentScrollY >= 80
    triggerScroll(100);

    expect(result.current.direction).toBe("down");
    expect(result.current.scrollY).toBe(100);
  });

  it("should maintain direction if scroll delta is less than threshold", () => {
    const { result } = renderHook(() => useScrollDirection());

    // Scroll to 100 (down)
    triggerScroll(100);
    expect(result.current.direction).toBe("down");

    // Scroll to 105 (delta = 5 < 10)
    triggerScroll(105);

    // Direction should still be down, even though delta was small
    expect(result.current.direction).toBe("down");
    expect(result.current.scrollY).toBe(105);
  });

  it("should update direction to 'up' when scrolling up past threshold", () => {
    const { result } = renderHook(() => useScrollDirection());

    // Scroll down to 200
    triggerScroll(200);
    expect(result.current.direction).toBe("down");

    // Scroll up to 150 (delta = -50 < -10)
    triggerScroll(150);

    expect(result.current.direction).toBe("up");
    expect(result.current.scrollY).toBe(150);
    expect(result.current.isAtTop).toBe(false); // 150 > 80
  });

  it("should update direction to 'up' if near top regardless of delta direction", () => {
    const { result } = renderHook(() => useScrollDirection());

    // Scroll down to 100
    triggerScroll(100);
    expect(result.current.direction).toBe("down");

    // Scroll up to 70 (near top)
    triggerScroll(70);

    expect(result.current.direction).toBe("up");
    expect(result.current.scrollY).toBe(70);
    expect(result.current.isAtTop).toBe(true);

    // Now let's try a small scroll down near top
    triggerScroll(75); // delta = 5 < 10
    // wait for frame
    expect(result.current.direction).toBe("up"); // direction forced to 'up' if near top
    expect(result.current.isAtTop).toBe(true);

    // Now larger scroll down but still near top
    triggerScroll(78); // delta = 3, previous scroll was 75, if we trigger threshold it forces 'up'

  });

  it("should clean up event listener on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useScrollDirection());

    expect(addSpy).toHaveBeenCalledWith("scroll", expect.any(Function), { passive: true });

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
