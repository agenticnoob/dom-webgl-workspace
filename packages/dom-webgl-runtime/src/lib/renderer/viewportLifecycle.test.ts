import { describe, expect, test } from "vitest";

import { createViewportLifecycle } from "./viewportLifecycle";

describe("viewport lifecycle", () => {
  test("classifies targets as active only inside active margin", () => {
    const lifecycle = createViewportLifecycle({
      viewportHeight: 1000,
      activeMargin: "50vh",
      preloadMargin: "150vh",
      mountMargin: "100vh",
      unloadMargin: "250vh",
    });

    expect(lifecycle.classify(new DOMRect(0, 100, 100, 100))).toBe("active");
    expect(lifecycle.classify(new DOMRect(0, 1800, 100, 100))).toBe(
      "preloading",
    );
    expect(lifecycle.classify(new DOMRect(0, 4000, 100, 100))).toBe("disposed");
  });
});
