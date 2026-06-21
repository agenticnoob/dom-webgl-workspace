import { describe, expect, test, vi } from "vitest";

import { createLenisScrollAdapter } from "./lenis";

describe("createLenisScrollAdapter", () => {
  test("reads Lenis scroll metrics without depending on runtime internals", () => {
    const adapter = createLenisScrollAdapter(
      {
        scroll: 320,
        limit: 1680,
      },
      {
        getViewportHeight: () => 720,
      },
    );

    expect(adapter.readMetrics()).toEqual({
      scrollY: 320,
      scrollHeight: 2400,
      viewportHeight: 720,
    });
  });

  test("subscribes to Lenis scroll events and releases owned listeners", () => {
    const listeners = new Set<() => void>();
    const listener = vi.fn();
    const lenis = {
      scroll: 0,
      limit: 100,
      on: vi.fn((_event: "scroll", callback: () => void) => {
        listeners.add(callback);
        return () => listeners.delete(callback);
      }),
    };
    const adapter = createLenisScrollAdapter(lenis, {
      getViewportHeight: () => 100,
    });

    const unsubscribe = adapter.subscribe?.(listener);

    for (const callback of listeners) {
      callback();
    }
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe?.();
    for (const callback of listeners) {
      callback();
    }

    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("does not destroy consumer-owned Lenis instances unless requested", () => {
    const destroy = vi.fn();
    const consumerOwned = createLenisScrollAdapter(
      {
        scroll: 0,
        limit: 100,
        destroy,
      },
      {
        getViewportHeight: () => 100,
      },
    );
    const managed = createLenisScrollAdapter(
      {
        scroll: 0,
        limit: 100,
        destroy,
      },
      {
        getViewportHeight: () => 100,
        manageInstance: true,
      },
    );

    consumerOwned.dispose?.();
    expect(destroy).not.toHaveBeenCalled();

    managed.dispose?.();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
