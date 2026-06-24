import type { WebGLPointerState } from "../types";

export type PointerController = {
  getState(): WebGLPointerState;
  dispose(): void;
};

export type PointerControllerEventTarget = Pick<
  EventTarget,
  "addEventListener" | "removeEventListener"
>;

export type PointerControllerOptions = {
  coordinateElement: HTMLElement;
  eventTarget?: PointerControllerEventTarget;
};

export function createPointerController(
  input: HTMLElement | PointerControllerOptions,
): PointerController {
  const coordinateElement = isPointerControllerOptions(input)
    ? input.coordinateElement
    : input;
  const eventTarget = isPointerControllerOptions(input)
    ? input.eventTarget
    : undefined;
  const pointerEventTarget = eventTarget ?? coordinateElement;
  let state = createInitialPointerState();
  let disposed = false;

  const handlePointerMove = (event: Event) => {
    const pointerEvent = event as PointerEvent;
    state = updatePointerPosition(state, coordinateElement, pointerEvent);

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

  const handlePointerDown = (event: Event) => {
    const pointerEvent = event as PointerEvent;
    const nextState = updatePointerPosition(
      state,
      coordinateElement,
      pointerEvent,
    );

    state = {
      ...nextState,
      isDown: true,
      downTime: pointerEvent.timeStamp,
      pressDuration: 0,
      isDragging: false,
      dragStartX: nextState.x,
      dragStartY: nextState.y,
      dragDeltaX: 0,
      dragDeltaY: 0,
    };
  };

  const handlePointerUp = (event: Event) => {
    const pointerEvent = event as PointerEvent;
    const nextState = updatePointerPosition(
      state,
      coordinateElement,
      pointerEvent,
    );

    state = {
      ...nextState,
      isDown: false,
      isDragging: false,
      pressDuration: Math.max(0, pointerEvent.timeStamp - state.downTime),
      lastClickTime: pointerEvent.timeStamp,
      clickCount: state.clickCount + 1,
    };
  };

  pointerEventTarget.addEventListener("pointermove", handlePointerMove);
  pointerEventTarget.addEventListener("pointerdown", handlePointerDown);
  pointerEventTarget.addEventListener("pointerup", handlePointerUp);

  return {
    getState(): WebGLPointerState {
      return { ...state };
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      pointerEventTarget.removeEventListener("pointermove", handlePointerMove);
      pointerEventTarget.removeEventListener("pointerdown", handlePointerDown);
      pointerEventTarget.removeEventListener("pointerup", handlePointerUp);
      disposed = true;
    },
  };
}

function isPointerControllerOptions(
  input: HTMLElement | PointerControllerOptions,
): input is PointerControllerOptions {
  return "coordinateElement" in input;
}

export function createInitialPointerState(): WebGLPointerState {
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
