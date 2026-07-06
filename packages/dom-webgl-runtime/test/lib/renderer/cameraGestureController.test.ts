import { describe, expect, test } from "vitest";

import {
  createInitialCameraGestureState,
  updateCameraGestureFrame,
} from "../../../src/lib/renderer/cameraGestureController";
import type {
  NormalizedCameraControllerFrameDeclaration,
  NormalizedCameraPointerControllerDeclaration,
} from "../../../src/lib/renderer/cameraControllerDeclarations";
import type { WebGLFrameInput } from "../../../src/lib/types";

describe("camera gesture controller", () => {
  test("orbits around a target with distance constraints", () => {
    const result = updateCameraGestureFrame({
      baseFrame: { position: [0, 0, 500], target: [0, 0, 0], fov: 42 },
      state: createInitialCameraGestureState(),
      pointer: {
        activation: "empty-space",
        orbit: {
          drag: { button: "primary" },
          target: [0, 0, 0],
          sensitivity: [0.01, 0.01],
          minDistance: 300,
          maxDistance: 700,
        },
      },
      frameInput: createGestureFrameInput({
        pointer: {
          isDown: true,
          isDragging: true,
          button: "primary",
          dragDeltaX: 20,
          dragDeltaY: 0,
        },
      }),
    });

    expect(result.activeGesture).toBe("orbit");
    expect(result.frame.position?.[2]).toBeLessThan(500);
    expect(readDistance(result.frame)).toBeGreaterThanOrEqual(300);
    expect(readDistance(result.frame)).toBeLessThanOrEqual(700);
  });

  test("pans camera and target together in camera plane", () => {
    const result = updateCameraGestureFrame({
      baseFrame: { position: [0, 0, 500], target: [0, 0, 0], fov: 42 },
      state: createInitialCameraGestureState(),
      pointer: {
        activation: "empty-space",
        pan: { drag: { button: "secondary" }, sensitivity: [1, 1] },
      },
      frameInput: createGestureFrameInput({
        pointer: {
          isDown: true,
          isDragging: true,
          dragDeltaX: 20,
          dragDeltaY: -10,
          button: "secondary",
        },
      }),
    });

    expect(result.frame.position).toEqual([-20, -10, 500]);
    expect(result.frame.target).toEqual([-20, -10, 0]);
    expect(result.activeGesture).toBe("pan");
  });

  test("dollies camera distance with alt primary drag", () => {
    const result = updateCameraGestureFrame({
      baseFrame: { position: [0, 0, 500], target: [0, 0, 0], fov: 42 },
      state: createInitialCameraGestureState(),
      pointer: {
        activation: "empty-space",
        dolly: {
          drag: { button: "primary", modifier: "alt" },
          sensitivity: 2,
          minDistance: 300,
          maxDistance: 700,
        },
      },
      frameInput: createGestureFrameInput({
        pointer: {
          isDown: true,
          isDragging: true,
          button: "primary",
          modifiers: { alt: true, shift: false, ctrl: false, meta: false },
          dragDeltaY: -120,
        },
      }),
    });

    expect(result.frame.position).toEqual([0, 0, 300]);
    expect(result.activeGesture).toBe("dolly");
  });

  test("applies camera-scoped pointer parallax within max offsets", () => {
    const result = updateCameraGestureFrame({
      baseFrame: { position: [0, 0, 500], target: [0, 0, 0], fov: 42 },
      state: createInitialCameraGestureState(),
      pointer: {
        activation: "empty-space",
        parallax: {
          scope: "camera",
          strength: [20, 10],
          maxOffset: [8, 4],
        },
      },
      frameInput: createGestureFrameInput({
        pointer: { normalizedX: 0.5, normalizedY: -0.5, isInside: true },
      }),
    });

    expect(result.frame.position).toEqual([8, -4, 500]);
    expect(result.frame.target).toEqual([0, 0, 0]);
    expect(result.activeGesture).toBe("parallax");
  });

  test("does not accumulate pointer parallax into persistent gesture state", () => {
    const pointer: NormalizedCameraPointerControllerDeclaration = {
      activation: "empty-space",
      parallax: {
        scope: "camera",
        strength: [20, 10],
        maxOffset: [8, 4],
      },
    };
    const first = updateCameraGestureFrame({
      baseFrame: { position: [0, 0, 500], target: [0, 0, 0], fov: 42 },
      state: createInitialCameraGestureState(),
      pointer,
      frameInput: createGestureFrameInput({
        pointer: { normalizedX: 0.5, normalizedY: -0.5, isInside: true },
      }),
    });
    const second = updateCameraGestureFrame({
      baseFrame: { position: [0, 0, 500], target: [0, 0, 0], fov: 42 },
      state: first.state,
      pointer,
      frameInput: createGestureFrameInput({
        pointer: { normalizedX: 0.5, normalizedY: -0.5, isInside: true },
      }),
    });

    expect(first.frame.position).toEqual([8, -4, 500]);
    expect(second.frame.position).toEqual([8, -4, 500]);
    expect(second.state.targetFrame).toEqual({
      position: [0, 0, 500],
      target: [0, 0, 0],
      fov: 42,
    });
  });

  test("continues rendering while damping is settling", () => {
    const result = updateCameraGestureFrame({
      baseFrame: { position: [0, 0, 500], target: [0, 0, 0], fov: 42 },
      state: createInitialCameraGestureState({
        appliedFrame: { position: [0, 0, 600], target: [0, 0, 0], fov: 42 },
      }),
      pointer: {
        activation: "empty-space",
        damping: { factor: 0.2, settleEpsilon: 0.001 },
      },
      frameInput: createGestureFrameInput({ delta: 16 }),
    });

    expect(result.requiresContinuousRendering).toBe(true);
    expect(result.frame.position?.[2]).toBeGreaterThan(500);
    expect(result.frame.position?.[2]).toBeLessThan(600);
    expect(result.activeGesture).toBe("damping");
  });

  test("resets gesture framing on double click", () => {
    const firstClick = updateCameraGestureFrame({
      baseFrame: { position: [0, 0, 500], target: [0, 0, 0], fov: 42 },
      state: createInitialCameraGestureState({
        targetFrame: { position: [80, 20, 420], target: [12, 8, 0], fov: 42 },
        appliedFrame: { position: [80, 20, 420], target: [12, 8, 0], fov: 42 },
      }),
      pointer: {
        activation: "empty-space",
        reset: { onDoubleClick: true, durationMs: 120 },
      },
      frameInput: createGestureFrameInput({
        pointer: { clickCount: 1, lastClickTime: 100, isInside: true },
      }),
    });
    const result = updateCameraGestureFrame({
      baseFrame: { position: [0, 0, 500], target: [0, 0, 0], fov: 42 },
      state: firstClick.state,
      pointer: {
        activation: "empty-space",
        reset: { onDoubleClick: true, durationMs: 120 },
      },
      frameInput: createGestureFrameInput({
        pointer: { clickCount: 2, lastClickTime: 220, isInside: true },
      }),
    });

    expect(result.frame).toEqual({
      position: [0, 0, 500],
      target: [0, 0, 0],
      fov: 42,
    });
    expect(result.activeGesture).toBe("reset");
  });

  test("does not reset on two separate slow clicks", () => {
    const pointer: NormalizedCameraPointerControllerDeclaration = {
      activation: "empty-space",
      reset: { onDoubleClick: true, durationMs: 120 },
    };
    const firstClick = updateCameraGestureFrame({
      baseFrame: { position: [0, 0, 500], target: [0, 0, 0], fov: 42 },
      state: createInitialCameraGestureState({
        targetFrame: { position: [80, 20, 420], target: [12, 8, 0], fov: 42 },
        appliedFrame: { position: [80, 20, 420], target: [12, 8, 0], fov: 42 },
      }),
      pointer,
      frameInput: createGestureFrameInput({
        pointer: { clickCount: 1, lastClickTime: 100, isInside: true },
      }),
    });
    const secondClick = updateCameraGestureFrame({
      baseFrame: { position: [0, 0, 500], target: [0, 0, 0], fov: 42 },
      state: firstClick.state,
      pointer,
      frameInput: createGestureFrameInput({
        pointer: { clickCount: 2, lastClickTime: 900, isInside: true },
      }),
    });

    expect(secondClick.activeGesture).not.toBe("reset");
    expect(secondClick.frame).toEqual({
      position: [80, 20, 420],
      target: [12, 8, 0],
      fov: 42,
    });
  });

  test("does not reset after drag releases increment click count", () => {
    const pointer: NormalizedCameraPointerControllerDeclaration = {
      activation: "empty-space",
      reset: { onDoubleClick: true, durationMs: 120 },
    };
    const firstDragRelease = updateCameraGestureFrame({
      baseFrame: { position: [0, 0, 500], target: [0, 0, 0], fov: 42 },
      state: createInitialCameraGestureState({
        targetFrame: { position: [80, 20, 420], target: [12, 8, 0], fov: 42 },
        appliedFrame: { position: [80, 20, 420], target: [12, 8, 0], fov: 42 },
      }),
      pointer,
      frameInput: createGestureFrameInput({
        pointer: {
          clickCount: 1,
          lastClickTime: 100,
          isInside: true,
          dragStartX: 10,
          dragDeltaX: 24,
        },
      }),
    });
    const secondDragRelease = updateCameraGestureFrame({
      baseFrame: { position: [0, 0, 500], target: [0, 0, 0], fov: 42 },
      state: firstDragRelease.state,
      pointer,
      frameInput: createGestureFrameInput({
        pointer: {
          clickCount: 2,
          lastClickTime: 180,
          isInside: true,
          dragStartX: 10,
          dragDeltaX: 40,
        },
      }),
    });

    expect(secondDragRelease.activeGesture).not.toBe("reset");
    expect(secondDragRelease.frame).toEqual({
      position: [80, 20, 420],
      target: [12, 8, 0],
      fov: 42,
    });
  });
});

function createGestureFrameInput(
  input: {
    delta?: number;
    pointer?: Partial<WebGLFrameInput["pointer"]>;
  } = {},
): WebGLFrameInput {
  return {
    time: 100,
    delta: input.delta ?? 16,
    scroll: {
      mode: "page",
      pageProgress: 0,
      direction: 0,
      velocity: 0,
    },
    pointer: {
      x: 0,
      y: 0,
      normalizedX: 0,
      normalizedY: 0,
      isInside: true,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 0,
      buttons: [],
      modifiers: { shift: false, alt: false, ctrl: false, meta: false },
      ...input.pointer,
    },
  };
}

function readDistance(frame: NormalizedCameraControllerFrameDeclaration): number {
  const position = frame.position ?? [0, 0, 500];
  const target = frame.target ?? [0, 0, 0];

  return Math.hypot(
    position[0] - target[0],
    position[1] - target[1],
    position[2] - target[2],
  );
}
