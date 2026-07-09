import type {
  WebGLPointerButton,
  WebGLPointerModifiers,
  WebGLPointerState,
} from "../types";

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
  onPointerInput?(): void;
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
  const onPointerInput = isPointerControllerOptions(input)
    ? input.onPointerInput
    : undefined;
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

    onPointerInput?.();
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
      button: normalizePointerButton(pointerEvent.button),
      buttons: normalizePointerButtons(pointerEvent.buttons),
      downTime: pointerEvent.timeStamp,
      pressDuration: 0,
      isDragging: false,
      dragStartX: nextState.x,
      dragStartY: nextState.y,
      dragDeltaX: 0,
      dragDeltaY: 0,
    };

    onPointerInput?.();
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
      button: undefined,
      buttons: normalizePointerButtons(pointerEvent.buttons),
      pressDuration: Math.max(0, pointerEvent.timeStamp - state.downTime),
      lastClickTime: pointerEvent.timeStamp,
      clickCount: state.clickCount + 1,
    };

    onPointerInput?.();
  };

  pointerEventTarget.addEventListener("pointermove", handlePointerMove);
  pointerEventTarget.addEventListener("pointerdown", handlePointerDown);
  pointerEventTarget.addEventListener("pointerup", handlePointerUp);

  return {
    getState(): WebGLPointerState {
      return clonePointerState(state);
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
    buttons: [],
    modifiers: createPointerModifiers(),
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
    buttons: normalizePointerButtons(event.buttons),
    modifiers: readPointerModifiers(event),
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

function normalizePointerButton(button: number): WebGLPointerButton | undefined {
  switch (button) {
    case 0:
      return "primary";
    case 1:
      return "middle";
    case 2:
      return "secondary";
  }
}

function normalizePointerButtons(buttons: number): WebGLPointerButton[] {
  const normalized: WebGLPointerButton[] = [];

  if ((buttons & 1) === 1) {
    normalized.push("primary");
  }
  if ((buttons & 4) === 4) {
    normalized.push("middle");
  }
  if ((buttons & 2) === 2) {
    normalized.push("secondary");
  }

  return normalized;
}

function readPointerModifiers(event: PointerEvent): WebGLPointerModifiers {
  return {
    shift: event.shiftKey,
    alt: event.altKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
  };
}

function createPointerModifiers(): WebGLPointerModifiers {
  return {
    shift: false,
    alt: false,
    ctrl: false,
    meta: false,
  };
}

function clonePointerState(state: WebGLPointerState): WebGLPointerState {
  return {
    ...state,
    buttons: state.buttons.slice(),
    modifiers: { ...state.modifiers },
  };
}
