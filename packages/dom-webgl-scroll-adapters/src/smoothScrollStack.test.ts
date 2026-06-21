import { describe, expect, test, vi } from "vitest";

import { createLenisGsapScrollStack } from "./smoothScrollStack";

describe("createLenisGsapScrollStack", () => {
  test("returns a runtime scroll adapter and wires Lenis to the GSAP ticker", () => {
    const tickerCallbacks = new Set<(time: number) => void>();
    const lenis = createFakeLenis({ scroll: 120, limit: 880 });
    const gsap = {
      ticker: {
        add: vi.fn((callback: (time: number) => void) => {
          tickerCallbacks.add(callback);
        }),
        remove: vi.fn((callback: (time: number) => void) => {
          tickerCallbacks.delete(callback);
        }),
        lagSmoothing: vi.fn(),
      },
    };
    const ScrollTrigger = {
      update: vi.fn(),
      refresh: vi.fn(),
      scrollerProxy: vi.fn(),
    };

    const stack = createLenisGsapScrollStack({
      lenis,
      gsap,
      ScrollTrigger,
      getViewportHeight: () => 500,
    });

    expect(stack.scrollAdapter.readMetrics()).toEqual({
      scrollY: 120,
      scrollHeight: 1380,
      viewportHeight: 500,
    });
    expect(gsap.ticker.add).toHaveBeenCalledTimes(1);
    expect(gsap.ticker.lagSmoothing).toHaveBeenCalledWith(0);

    for (const callback of tickerCallbacks) {
      callback(1.25);
    }

    expect(lenis.raf).toHaveBeenCalledWith(1250);

    lenis.emitScroll();
    expect(ScrollTrigger.update).toHaveBeenCalledTimes(1);

    stack.dispose();
    expect(gsap.ticker.remove).toHaveBeenCalledTimes(1);
    expect(tickerCallbacks.size).toBe(0);
  });

  test("configures ScrollTrigger scroller proxy and delegates update refresh", () => {
    const lenis = createFakeLenis();
    const gsap = createFakeGsap();
    const scroller = document.createElement("main");
    const proxy = {
      scrollTop: vi.fn(() => 25),
      getBoundingClientRect: vi.fn(() => ({
        top: 0,
        left: 0,
        width: 100,
        height: 200,
      })),
      pinType: "transform" as const,
    };
    const ScrollTrigger = {
      update: vi.fn(),
      refresh: vi.fn(),
      scrollerProxy: vi.fn(),
    };

    const stack = createLenisGsapScrollStack({
      lenis,
      gsap,
      ScrollTrigger,
      scroller,
      proxy,
    });

    expect(ScrollTrigger.scrollerProxy).toHaveBeenCalledWith(scroller, proxy);

    stack.update();
    stack.refresh(true);

    expect(ScrollTrigger.update).toHaveBeenCalledTimes(1);
    expect(ScrollTrigger.refresh).toHaveBeenCalledWith(true);
  });

  test("keeps Lenis consumer-owned by default and destroys only when requested", () => {
    const consumerOwnedLenis = createFakeLenis();
    const managedLenis = createFakeLenis();

    createLenisGsapScrollStack({
      lenis: consumerOwnedLenis,
      gsap: createFakeGsap(),
    }).dispose();

    createLenisGsapScrollStack({
      lenis: managedLenis,
      gsap: createFakeGsap(),
      manageLenis: true,
    }).dispose();

    expect(consumerOwnedLenis.destroy).not.toHaveBeenCalled();
    expect(managedLenis.destroy).toHaveBeenCalledTimes(1);
  });
});

function createFakeLenis(input: { scroll?: number; limit?: number } = {}) {
  const listeners = new Set<() => void>();

  return {
    scroll: input.scroll ?? 0,
    limit: input.limit ?? 1000,
    raf: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn((_event: "scroll", listener: () => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    }),
    emitScroll() {
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

function createFakeGsap() {
  return {
    ticker: {
      add: vi.fn(),
      remove: vi.fn(),
      lagSmoothing: vi.fn(),
    },
  };
}
