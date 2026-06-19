import { describe, expect, test } from "vitest";

import { normalizeWebGLEffectsDeclaration } from "./effectNormalization";

describe("normalizeWebGLEffectsDeclaration", () => {
  test("defaults solid material and pointer tilt values", () => {
    expect(
      normalizeWebGLEffectsDeclaration({
        material: { kind: "solid" },
        motion: { kind: "pointer-tilt" },
      }),
    ).toEqual({
      material: { kind: "solid", color: 0xffffff, opacity: 1 },
      motion: { kind: "pointer-tilt", strength: 1, maxDegrees: 8 },
    });
  });

  test("clamps existing Phase 5 effect values", () => {
    expect(
      normalizeWebGLEffectsDeclaration({
        material: { kind: "solid", color: 0x1ffffff, opacity: 2 },
        motion: { kind: "pointer-tilt", strength: -1, maxDegrees: 90 },
      }),
    ).toEqual({
      material: { kind: "solid", color: 0xffffff, opacity: 1 },
      motion: { kind: "pointer-tilt", strength: 0, maxDegrees: 30 },
    });
  });

  test("defaults and clamps minimal surface material values", () => {
    expect(
      normalizeWebGLEffectsDeclaration({
        material: {
          kind: "surface",
          color: 0x1ffffff,
          opacity: 2,
          radius: -4,
        },
      }),
    ).toEqual({
      material: {
        kind: "surface",
        color: 0xffffff,
        opacity: 1,
        radius: 0,
      },
    });
  });
});
