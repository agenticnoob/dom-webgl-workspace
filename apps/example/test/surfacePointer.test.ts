import { describe, expect, test } from "vitest";

import { readTargetLocalPointer } from "../src/surfacePointer";

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
          localX: 8 - targetLayout.left,
          localY: 24 - targetLayout.top,
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
          localX: targetLayout.width / 2,
          localY: targetLayout.height / 2,
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
