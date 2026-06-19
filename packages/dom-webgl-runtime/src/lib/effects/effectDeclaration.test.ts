import { describe, expect, test } from "vitest";

import { compileWebGLEffectDeclarations } from "./effectDeclaration";

describe("compileWebGLEffectDeclarations", () => {
  test("returns array declarations unchanged", () => {
    expect(
      compileWebGLEffectDeclarations([
        { kind: "surface.basic", color: 0x111111, opacity: 0.5, radius: 18 },
        { kind: "motion.pointerTilt", strength: 0.4, maxDegrees: 5 },
      ]),
    ).toEqual([
      { kind: "surface.basic", color: 0x111111, opacity: 0.5, radius: 18 },
      { kind: "motion.pointerTilt", strength: 0.4, maxDegrees: 5 },
    ]);
  });

  test("compiles legacy material and motion slots into ordered effect declarations", () => {
    expect(
      compileWebGLEffectDeclarations({
        material: {
          kind: "surface",
          color: 0x222222,
          opacity: 0.75,
          radius: 24,
        },
        motion: { kind: "pointer-tilt", strength: 0.8, maxDegrees: 9 },
      }),
    ).toEqual([
      { kind: "surface.basic", color: 0x222222, opacity: 0.75, radius: 24 },
      { kind: "motion.pointerTilt", strength: 0.8, maxDegrees: 9 },
    ]);
  });

  test("compiles legacy solid material into the explicit solid effect kind", () => {
    expect(
      compileWebGLEffectDeclarations({
        material: { kind: "solid", color: 0xffffff, opacity: 0.9 },
      }),
    ).toEqual([
      { kind: "material.solid", color: 0xffffff, opacity: 0.9 },
    ]);
  });

  test("returns an empty array when effects are not declared", () => {
    expect(compileWebGLEffectDeclarations(undefined)).toEqual([]);
  });
});
