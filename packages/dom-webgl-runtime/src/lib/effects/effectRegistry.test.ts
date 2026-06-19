import { describe, expect, test } from "vitest";

import { createWebGLEffectRegistry } from "./effectRegistry";
import type { WebGLEffectPlugin } from "./effectPlugin";

const testPlugin: WebGLEffectPlugin<
  { kind: "test.effect"; value?: number },
  { value: number }
> = {
  kind: "test.effect",
  appliesTo: ["snapshot/element"],
  capabilities: ["material.surface"],
  normalize: (declaration) => ({ value: declaration.value ?? 1 }),
  create: () => ({ update: () => undefined }),
};

describe("createWebGLEffectRegistry", () => {
  test("registers and resolves plugins by kind", () => {
    const registry = createWebGLEffectRegistry();
    registry.register(testPlugin);

    expect(registry.resolve("test.effect")).toBe(testPlugin);
  });

  test("throws on duplicate plugin kinds", () => {
    const registry = createWebGLEffectRegistry();
    registry.register(testPlugin);

    expect(() => registry.register(testPlugin)).toThrow(
      'WebGL effect plugin "test.effect" is already registered.',
    );
  });

  test("returns undefined for unknown plugin kinds", () => {
    expect(createWebGLEffectRegistry().resolve("missing.effect")).toBeUndefined();
  });
});
