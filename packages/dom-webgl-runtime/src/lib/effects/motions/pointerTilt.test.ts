import { describe, expect, test, vi } from "vitest";

import { applyPointerTilt } from "./pointerTilt";
import type { WebGLEffectTarget } from "../effectTarget";
import type { NormalizedWebGLMotionDeclaration } from "../effectNormalization";
import type { WebGLFrameInput } from "../../types";

describe("applyPointerTilt", () => {
  test("rotates from shared normalized pointer input", () => {
    const target = createEffectTarget();
    const motion: NormalizedWebGLMotionDeclaration = {
      kind: "pointer-tilt",
      strength: 0.5,
      maxDegrees: 10,
    };

    applyPointerTilt(
      target,
      createFrameInput({ isInside: true, normalizedX: 1, normalizedY: -0.5 }),
      motion,
    );

    expect(target.setRotation).toHaveBeenCalledWith(
      expect.closeTo(-0.0436332313),
      expect.closeTo(0.0872664626),
    );
  });

  test("resets when the pointer is outside", () => {
    const target = createEffectTarget();

    applyPointerTilt(target, createFrameInput({ isInside: false }), {
      kind: "pointer-tilt",
      strength: 1,
      maxDegrees: 8,
    });

    expect(target.setRotation).toHaveBeenCalledWith(0, 0);
  });
});

function createEffectTarget(): WebGLEffectTarget {
  return {
    setVisible: vi.fn(),
    setRotation: vi.fn(),
    setScale: vi.fn(),
    setOpacity: vi.fn(),
  };
}

function createFrameInput(
  pointer: Partial<WebGLFrameInput["pointer"]> = {},
): WebGLFrameInput {
  return {
    time: 100,
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
      ...pointer,
    },
  };
}
