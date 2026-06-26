import { describe, expect, test } from "vitest";

import { readTargetLocalPointer } from "./surfacePointer";

describe("surface pointer locality", () => {
  test("activates only inside the current target rect", () => {
    const targetLayout = {
      left: 100,
      top: 80,
      width: 320,
      height: 180,
    };

    expect(
      readTargetLocalPointer({
        layout: targetLayout,
        pointer: {
          x: 8,
          y: 24,
          isInside: true,
        },
      }),
    ).toEqual({
      active: false,
      x: 160,
      y: 90,
    });
    expect(
      readTargetLocalPointer({
        layout: targetLayout,
        pointer: {
          x: targetLayout.left + targetLayout.width / 2,
          y: targetLayout.top + targetLayout.height / 2,
          isInside: true,
        },
      }),
    ).toEqual({
      active: true,
      x: 160,
      y: 90,
    });
  });
});
