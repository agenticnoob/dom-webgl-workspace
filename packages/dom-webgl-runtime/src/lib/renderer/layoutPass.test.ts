import { describe, expect, test, vi } from "vitest";

import { createLayoutPass } from "./layoutPass";

describe("layout pass", () => {
  test("measures each active target once and returns measurements by key", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");
    const measureElement = vi
      .fn()
      .mockReturnValueOnce(new DOMRect(0, 0, 100, 50))
      .mockReturnValueOnce(new DOMRect(10, 20, 200, 80));
    const pass = createLayoutPass({ measureElement });

    const measurements = pass.measure([
      { key: "first", element: first, active: true },
      { key: "second", element: second, active: true },
      { key: "inactive", element: document.createElement("div"), active: false },
    ]);

    expect(measureElement).toHaveBeenCalledTimes(2);
    expect(measurements.get("first")).toMatchObject({ width: 100, height: 50 });
    expect(measurements.get("second")).toMatchObject({ width: 200, height: 80 });
    expect(measurements.has("inactive")).toBe(false);
  });
});
