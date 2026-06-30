import { describe, expect, test } from "vitest";

import { defineWebGLEffect } from "../../../src/lib/effects/effectAuthoring";
import { createWebGLEffectRegistry } from "../../../src/lib/effects/effectRegistry";

const testEffect = defineWebGLEffect({
  kind: "test.effect",
  update() {
    return;
  },
});

describe("createWebGLEffectRegistry", () => {
  test("registers and resolves effect definitions by kind", () => {
    const registry = createWebGLEffectRegistry([testEffect]);

    expect(registry.resolve("test.effect")).toBe(testEffect);
  });

  test("throws on duplicate effect kinds", () => {
    expect(() =>
      createWebGLEffectRegistry([testEffect, testEffect]),
    ).toThrow(
      'WebGL effect "test.effect" is already registered.',
    );
  });

  test("returns undefined for unknown effect kinds", () => {
    expect(createWebGLEffectRegistry().resolve("missing.effect")).toBeUndefined();
  });
});
