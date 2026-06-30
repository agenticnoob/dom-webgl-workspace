import { describe, expect, test, vi } from "vitest";

import { createLayoutPass } from "../../../src/lib/renderer/layoutPass";

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

  test("does not read viewport or DPR when every target is skipped", () => {
    const measureElement = vi.fn();
    const getViewportSize = vi.fn(() => ({ width: 390, height: 844 }));
    const getDevicePixelRatio = vi.fn(() => 2);
    const pass = createLayoutPass({
      measureElement,
      getViewportSize,
      getDevicePixelRatio,
    });

    const measurements = pass.measure([
      {
        key: "far.disposed",
        element: document.createElement("section"),
        active: false,
      },
    ]);

    expect(measurements.size).toBe(0);
    expect(measureElement).not.toHaveBeenCalled();
    expect(getViewportSize).not.toHaveBeenCalled();
    expect(getDevicePixelRatio).not.toHaveBeenCalled();
  });

  test("measures active targets into layout snapshots with viewport and DPR signatures", () => {
    const element = document.createElement("section");
    Object.assign(element.style, {
      backgroundColor: "rgb(10, 20, 30)",
      opacity: "0.8",
    });

    const layoutPass = createLayoutPass({
      measureElement: () =>
        ({
          x: 12.5,
          y: 20.25,
          left: 12.5,
          top: 20.25,
          right: 112.5,
          bottom: 70.25,
          width: 100,
          height: 50,
        }) as DOMRect,
      getViewportSize: () => ({ width: 390, height: 844 }),
      getDevicePixelRatio: () => 2,
    });

    const snapshots = layoutPass.measure([
      { key: "card", element, active: true },
    ]);
    const snapshot = snapshots.get("card");

    expect(snapshot).toMatchObject({
      left: 12.5,
      top: 20.25,
      width: 100,
      height: 50,
      viewport: { width: 390, height: 844 },
      devicePixelRatio: 1.5,
    });
    expect(snapshot?.layoutSignature).toContain("390");
    expect(snapshot?.layoutSignature).not.toContain("rgb(10, 20, 30)");
  });
});
