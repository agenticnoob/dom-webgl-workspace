import { describe, expect, test } from "vitest";

import { effectTargetSupports } from "./effectCapabilities";
import type { WebGLEffectTarget } from "./effectTarget";

describe("effectTargetSupports", () => {
  test("detects optional target capabilities", () => {
    const target: WebGLEffectTarget = {
      applySurfaceMaterial: () => undefined,
      setRotation: () => undefined,
    };

    expect(effectTargetSupports(target, "material.surface")).toBe(true);
    expect(effectTargetSupports(target, "transform.rotation")).toBe(true);
    expect(effectTargetSupports(target, "material.solid")).toBe(false);
  });

  test("returns false when no target is available", () => {
    expect(effectTargetSupports(undefined, "material.surface")).toBe(false);
  });
});
