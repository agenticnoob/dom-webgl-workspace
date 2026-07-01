import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type { WebGLFrameInput, WebGLTargetPointerState } from "../types";

export function createTargetPointerState(
  input: WebGLFrameInput,
  layout: ElementLayoutSnapshot,
): WebGLTargetPointerState {
  const pointer = input.pointer;
  const localX = pointer.x - layout.left;
  const localY = pointer.y - layout.top;
  const dragStartLocalX = pointer.dragStartX - layout.left;
  const dragStartLocalY = pointer.dragStartY - layout.top;
  const pressDuration = pointer.isDown
    ? Math.max(0, input.time - pointer.downTime)
    : pointer.pressDuration;

  return {
    localX,
    localY,
    normalizedX: normalizeAxis(localX, layout.width),
    normalizedY: -normalizeAxis(localY, layout.height),
    isInside:
      pointer.isInside &&
      localX >= 0 &&
      localX <= layout.width &&
      localY >= 0 &&
      localY <= layout.height,
    isPressed: pointer.isDown,
    pressDuration,
    isDragging: pointer.isDragging,
    dragStartLocalX,
    dragStartLocalY,
    dragDeltaX: pointer.dragDeltaX,
    dragDeltaY: pointer.dragDeltaY,
    ...(pointer.lastClickTime !== undefined
      ? { lastClickTime: pointer.lastClickTime }
      : {}),
    clickCount: pointer.clickCount,
  };
}

function normalizeAxis(value: number, size: number): number {
  if (size <= 0) {
    return 0;
  }

  return (2 * value - size) / size;
}
