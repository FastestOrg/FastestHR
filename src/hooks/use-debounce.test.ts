import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useDebounce } from "./use-debounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial value"));
    expect(result.current).toBe("initial value");
  });

  it("should not update the value before the specified delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: "initial value" } }
    );

    rerender({ value: "new value" });

    // Fast-forward time but not enough to trigger the timeout
    vi.advanceTimersByTime(499);

    expect(result.current).toBe("initial value");
  });

  it("should update the value after the specified delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: "initial value" } }
    );

    rerender({ value: "new value" });

    // Fast-forward time enough to trigger the timeout
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe("new value");
  });

  it("should clear the timeout and restart the timer if the value is updated within the delay period", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: "initial value" } }
    );

    rerender({ value: "first update" });

    // Fast-forward time partially
    vi.advanceTimersByTime(250);

    rerender({ value: "second update" });

    // Fast-forward time to where the first update would have triggered, but it shouldn't
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe("initial value");

    // Fast-forward time to where the second update should trigger
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe("second update");
  });

  it("should use a default delay of 500ms if not specified", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: "initial value" } }
    );

    rerender({ value: "new value" });

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe("initial value");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("new value");
  });
});
