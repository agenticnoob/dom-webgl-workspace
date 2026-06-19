import { describe, expect, test, vi } from "vitest";

import { surfaceBasicEffect } from "./surfaceBasicEffect";
import type { WebGLEffectTargetContext } from "../effectPlugin";

describe("surfaceBasicEffect", () => {
  test("normalizes color opacity and radius", () => {
    expect(
      surfaceBasicEffect.normalize({
        kind: "surface.basic",
        color: 0x1ffffff,
        opacity: 2,
        radius: 120,
      }),
    ).toEqual({ color: 0xffffff, opacity: 1, radius: 96 });
  });

  test("applies surface material through target capability", () => {
    const applySurfaceMaterial = vi.fn();
    const instance = surfaceBasicEffect.create({
      color: 0x123456,
      opacity: 0.75,
      radius: 24,
    });

    instance.update({
      key: "hero",
      sourceKind: "snapshot/element",
      input: frameInput(),
      layout: layoutSnapshot(),
      target: { applySurfaceMaterial },
    });

    expect(applySurfaceMaterial).toHaveBeenCalledWith(
      { color: 0x123456, opacity: 0.75, radius: 24 },
      { width: 320, height: 180, devicePixelRatio: 2 },
    );
  });
});

function layoutSnapshot(): WebGLEffectTargetContext["layout"] {
  return {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 320,
    bottom: 180,
    width: 320,
    height: 180,
    viewport: { width: 1024, height: 768 },
    devicePixelRatio: 2,
    layoutSignature: "surface-layout",
  };
}

function frameInput(): WebGLEffectTargetContext["input"] {
  return {
    time: 0,
    delta: 16,
    scroll: { mode: "page", pageProgress: 0, direction: 0, velocity: 0 },
    pointer: {
      x: 0,
      y: 0,
      normalizedX: 0,
      normalizedY: 0,
      isInside: false,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 0,
    },
  };
}
