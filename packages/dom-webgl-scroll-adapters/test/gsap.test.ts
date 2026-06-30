import { describe, expect, test, vi } from "vitest";

import { createGsapTickerLenisBridge } from "../src/gsap";

describe("createGsapTickerLenisBridge", () => {
  test("drives Lenis with the GSAP ticker and cleans up its own hooks", () => {
    let tickerCallback: ((time: number) => void) | undefined;
    let scrollListener: (() => void) | undefined;
    const removeScrollListener = vi.fn();
    const lenis = {
      raf: vi.fn(),
      on: vi.fn((_event: "scroll", listener: () => void) => {
        scrollListener = listener;
        return removeScrollListener;
      }),
    };
    const gsap = {
      ticker: {
        add: vi.fn((callback: (time: number) => void) => {
          tickerCallback = callback;
        }),
        remove: vi.fn(),
        lagSmoothing: vi.fn(),
      },
    };
    const scrollTrigger = {
      update: vi.fn(),
    };

    const bridge = createGsapTickerLenisBridge({
      gsap,
      lenis,
      scrollTrigger,
    });

    tickerCallback?.(2);
    scrollListener?.();

    expect(lenis.raf).toHaveBeenCalledWith(2000);
    expect(scrollTrigger.update).toHaveBeenCalledTimes(1);
    expect(gsap.ticker.lagSmoothing).toHaveBeenCalledWith(0);

    bridge.dispose();

    expect(gsap.ticker.remove).toHaveBeenCalledWith(tickerCallback);
    expect(removeScrollListener).toHaveBeenCalledTimes(1);
  });
});
