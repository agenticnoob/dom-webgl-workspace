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

  test("rejects legacy object-form effects", () => {
    expect(() =>
      compileWebGLEffectDeclarations({
        material: { kind: "solid" },
      } as never),
    ).toThrow("WebGL effects must be declared as an array of effect entries.");
  });

  test("returns an empty array when effects are not declared", () => {
    expect(compileWebGLEffectDeclarations(undefined)).toEqual([]);
  });
});
