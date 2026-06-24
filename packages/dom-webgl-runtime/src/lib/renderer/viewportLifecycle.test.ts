import { describe, expect, test } from "vitest";

import { createViewportLifecycle } from "./viewportLifecycle";

describe("viewport lifecycle", () => {
  test("classifies targets as active only inside active margin", () => {
    const lifecycle = createViewportLifecycle();

    expect(lifecycle.classify(new DOMRect(0, 100, 100, 100), 1000)).toBe("active");
    expect(lifecycle.classify(new DOMRect(0, 1800, 100, 100), 1000)).toBe(
      "mounted",
    );
    expect(lifecycle.classify(new DOMRect(0, 4000, 100, 100), 1000)).toBe("disposed");
  });
});