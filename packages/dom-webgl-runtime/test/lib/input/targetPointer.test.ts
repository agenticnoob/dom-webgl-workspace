import { describe, expect, test } from "vitest";

import { createTargetPointerState } from "../../../src/lib/input/targetPointer";
import type { ElementLayoutSnapshot } from "../../../src/lib/renderer/layoutPass";
import type { WebGLFrameInput, WebGLPointerState } from "../../../src/lib/types";

describe("createTargetPointerState", () => {
  test("maps runtime pointer coordinates into target-local coordinates", () => {
    const input = createFrameInput({
      x: 150,
      y: 90,
      normalizedX: -0.25,
      normalizedY: 0.4,
      isInside: true,
    });
    const layout = createLayoutSnapshot({
      left: 100,
      top: 50,
      width: 200,
      height: 100,
    });

    expect(createTargetPointerState(input, layout)).toMatchObject({
      localX: 50,
      localY: 40,
      normalizedX: -0.5,
      normalizedY: 0.2,
      isInside: true,
      isPressed: false,
    });
  });

  test("reports outside target even when the pointer is inside the runtime stage", () => {
    const input = createFrameInput({
      x: 350,
      y: 90,
      isInside: true,
    });
    const layout = createLayoutSnapshot({
      left: 100,
      top: 50,
      width: 200,
      height: 100,
    });

    expect(createTargetPointerState(input, layout)).toMatchObject({
      localX: 250,
      localY: 40,
      normalizedX: 1.5,
      normalizedY: 0.2,
      isInside: false,
    });
  });

  test("computes live press duration from frame time while pressed", () => {
    const input = createFrameInput({
      time: 900,
      x: 150,
      y: 90,
      isInside: true,
      isDown: true,
      downTime: 250,
      pressDuration: 0,
    });
    const layout = createLayoutSnapshot({
      left: 100,
      top: 50,
      width: 200,
      height: 100,
    });

    expect(createTargetPointerState(input, layout)).toMatchObject({
      isPressed: true,
      pressDuration: 650,
    });
  });

  test("maps drag start into target-local coordinates", () => {
    const input = createFrameInput({
      x: 160,
      y: 95,
      isInside: true,
      isDown: true,
      isDragging: true,
      dragStartX: 120,
      dragStartY: 70,
      dragDeltaX: 40,
      dragDeltaY: 25,
    });
    const layout = createLayoutSnapshot({
      left: 100,
      top: 50,
      width: 200,
      height: 100,
    });

    expect(createTargetPointerState(input, layout)).toMatchObject({
      dragStartLocalX: 20,
      dragStartLocalY: 20,
      dragDeltaX: 40,
      dragDeltaY: 25,
      isDragging: true,
    });
  });
});

function createFrameInput(
  pointer: Partial<WebGLPointerState> & { time?: number } = {},
): WebGLFrameInput {
  return {
    time: pointer.time ?? 100,
    delta: 16,
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

function createLayoutSnapshot(
  rect: Pick<ElementLayoutSnapshot, "left" | "top" | "width" | "height">,
): ElementLayoutSnapshot {
  return {
    x: rect.left,
    y: rect.top,
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    width: rect.width,
    height: rect.height,
    viewport: { width: 800, height: 600 },
    devicePixelRatio: 1,
    layoutSignature: `${rect.left}:${rect.top}:${rect.width}:${rect.height}`,
  };
}
