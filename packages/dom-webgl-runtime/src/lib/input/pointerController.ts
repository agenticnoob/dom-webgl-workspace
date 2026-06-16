import type { WebGLPointerState } from "../types";

export type PointerController = {
  getState(): WebGLPointerState;
  dispose(): void;
};

export function createPointerController(
  targetElement: HTMLElement,
): PointerController {
  let state = createInitialPointerState();
  let disposed = false;

  const handlePointerMove = (event: PointerEvent) => {
    state = updatePointerPosition(state, targetElement, event);

    if (state.isDown) {
      const dragDeltaX = state.x - state.dragStartX;
      const dragDeltaY = state.y - state.dragStartY;

      state = {
        ...state,
        isDragging: dragDeltaX !== 0 || dragDeltaY !== 0,
        dragDeltaX,
        dragDeltaY,
      };
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    const nextState = updatePointerPosition(state, targetElement, event);

    state = {
      ...nextState,
      isDown: true,
      downTime: event.timeStamp,
      pressDuration: 0,
      isDragging: false,
      dragStartX: nextState.x,
      dragStartY: nextState.y,
      dragDeltaX: 0,
      dragDeltaY: 0,
    };
  };

  const handlePointerUp = (event: PointerEvent) => {
    const nextState = updatePointerPosition(state, targetElement, event);

    state = {
      ...nextState,
      isDown: false,
      isDragging: false,
      pressDuration: Math.max(0, event.timeStamp - state.downTime),
      lastClickTime: event.timeStamp,
      clickCount: state.clickCount + 1,
    };
  };

  targetElement.addEventListener("pointermove", handlePointerMove);
  targetElement.addEventListener("pointerdown", handlePointerDown);
  targetElement.addEventListener("pointerup", handlePointerUp);

  return {
    getState(): WebGLPointerState {
      return { ...state };
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      targetElement.removeEventListener("pointermove", handlePointerMove);
      targetElement.removeEventListener("pointerdown", handlePointerDown);
      targetElement.removeEventListener("pointerup", handlePointerUp);
      disposed = true;
    },
  };
}

function createInitialPointerState(): WebGLPointerState {
  return {
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
  };
}

function updatePointerPosition(
  state: WebGLPointerState,
  targetElement: HTMLElement,
  event: PointerEvent,
): WebGLPointerState {
  const rect = targetElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const normalizedX = normalizeAxis(x, rect.width);
  const normalizedY = -normalizeAxis(y, rect.height);

  return {
    ...state,
    x,
    y,
    normalizedX,
    normalizedY,
    isInside:
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom,
  };
}

function normalizeAxis(value: number, size: number): number {
  if (size <= 0) {
    return 0;
  }

  return (value / size) * 2 - 1;
}
