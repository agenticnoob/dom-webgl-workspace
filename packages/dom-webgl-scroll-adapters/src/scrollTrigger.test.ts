import { describe, expect, test, vi } from "vitest";

import { createScrollTriggerBridge } from "./scrollTrigger";

describe("createScrollTriggerBridge", () => {
  test("wraps ScrollTrigger update refresh and scroller proxy without creating triggers", () => {
    const scroller = document.createElement("main");
    const proxy = {
      scrollTop: vi.fn(() => 120),
      getBoundingClientRect: vi.fn(() => ({
        top: 0,
        left: 0,
        width: 800,
        height: 600,
      })),
    };
    const ScrollTrigger = {
      update: vi.fn(),
      refresh: vi.fn(),
      scrollerProxy: vi.fn(),
    };

    const bridge = createScrollTriggerBridge({
      ScrollTrigger,
      scroller,
      proxy,
    });

    bridge.update();
    bridge.refresh(true);

    expect(ScrollTrigger.scrollerProxy).toHaveBeenCalledWith(scroller, proxy);
    expect(ScrollTrigger.update).toHaveBeenCalledTimes(1);
    expect(ScrollTrigger.refresh).toHaveBeenCalledWith(true);
  });
});
