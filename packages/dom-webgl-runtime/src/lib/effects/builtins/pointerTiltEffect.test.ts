import { describe, expect, test, vi } from "vitest";

import { pointerTiltEffect } from "./pointerTiltEffect";
import type { WebGLEffectTargetContext } from "../effectPlugin";

describe("pointerTiltEffect", () => {
  test("normalizes strength and maxDegrees", () => {
    expect(
      pointerTiltEffect.normalize({
        kind: "motion.pointerTilt",
        strength: -1,
        maxDegrees: 90,
      }),
    ).toEqual({ kind: "pointer-tilt", strength: 0, maxDegrees: 30 });
  });

  test("updates rotation through target capability", () => {
    const setRotation = vi.fn();
    const instance = pointerTiltEffect.create({
      kind: "pointer-tilt",
      strength: 1,
      maxDegrees: 10,
    });

    instance.update({
      key: "hero",
      sourceKind: "snapshot/element",
      layout: layoutSnapshot(),
      input: {
        ...frameInput(),
        pointer: {
          ...frameInput().pointer,
          isInside: true,
          normalizedX: 1,
          normalizedY: -1,
        },
      },
      target: { setRotation },
    });

    expect(setRotation).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
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
    layoutSignature: "pointer-layout",
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
