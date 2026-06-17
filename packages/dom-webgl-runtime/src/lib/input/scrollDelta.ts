export const DEFAULT_SCROLL_LINE_HEIGHT = 16;
const WHEEL_DELTA_PIXEL_MODE = 0;
const WHEEL_DELTA_LINE_MODE = 1;
const WHEEL_DELTA_PAGE_MODE = 2;

export type WheelDeltaInput = {
  deltaY: number;
  deltaMode: number;
};

export type WheelDeltaOptions = {
  lineHeight?: number;
  viewportHeight: number;
};

export type TouchMoveDeltaInput = {
  previousY: number;
  currentY: number;
};

export type TouchClientYInput = {
  touches: ArrayLike<{ clientY: number }>;
};

export type TouchDeltaTracker = {
  start(y: number): void;
  move(y: number): number;
  reset(): void;
};

export function readWheelDeltaY(
  input: WheelDeltaInput,
  options: WheelDeltaOptions,
): number {
  switch (input.deltaMode) {
    case WHEEL_DELTA_LINE_MODE:
      return input.deltaY * (options.lineHeight ?? DEFAULT_SCROLL_LINE_HEIGHT);
    case WHEEL_DELTA_PAGE_MODE:
      return input.deltaY * options.viewportHeight;
    case WHEEL_DELTA_PIXEL_MODE:
    default:
      return input.deltaY;
  }
}

export function readTouchMoveDelta(input: TouchMoveDeltaInput): number {
  return input.previousY - input.currentY;
}

export function readFirstTouchClientY(input: TouchClientYInput): number | null {
  return input.touches.length > 0 ? (input.touches[0]?.clientY ?? null) : null;
}

export function createTouchDeltaTracker(): TouchDeltaTracker {
  let previousY: number | null = null;

  return {
    start(y) {
      previousY = y;
    },
    move(y) {
      if (previousY === null) {
        previousY = y;
        return 0;
      }

      const deltaY = readTouchMoveDelta({ previousY, currentY: y });
      previousY = y;

      return deltaY;
    },
    reset() {
      previousY = null;
    },
  };
}
