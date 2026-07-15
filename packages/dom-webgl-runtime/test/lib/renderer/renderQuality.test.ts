import { describe, expect, test } from "vitest";

import { normalizeWebGLRenderQuality } from "../../../src/lib/renderer/renderQuality";

describe("render quality", () => {
  test("preserves performance defaults when no declaration is provided", () => {
    expect(normalizeWebGLRenderQuality()).toEqual({
      antialias: false,
      maxDevicePixelRatio: 1.5,
    });
  });

  test("normalizes an opt-in quality declaration", () => {
    expect(
      normalizeWebGLRenderQuality({
        antialias: true,
        maxDevicePixelRatio: 2,
      }),
    ).toEqual({
      antialias: true,
      maxDevicePixelRatio: 2,
    });
  });

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid maxDevicePixelRatio %s",
    (maxDevicePixelRatio) => {
      expect(() =>
        normalizeWebGLRenderQuality({ maxDevicePixelRatio }),
      ).toThrow(
        "WebGL render quality maxDevicePixelRatio must be a finite positive number.",
      );
    },
  );
});
