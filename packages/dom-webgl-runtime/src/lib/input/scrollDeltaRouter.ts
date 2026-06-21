import {
  createTouchDeltaTracker,
  readFirstTouchClientY,
  readWheelDeltaY,
} from "./scrollDelta";

export type ScrollControllerEventTarget = Pick<
  EventTarget,
  "addEventListener" | "removeEventListener"
>;

export function createScrollEventRouter(input: {
  target: ScrollControllerEventTarget;
  getViewportHeight: () => number;
  lineHeight?: number;
  consumeDelta(deltaY: number): boolean;
}): { dispose(): void } {
  const touchTracker = createTouchDeltaTracker();
  const activeListenerOptions: AddEventListenerOptions = { passive: false };
  const passiveListenerOptions: AddEventListenerOptions = { passive: true };
  let disposed = false;

  function onWheel(event: Event): void {
    const wheelEvent = event as WheelEvent;
    const consumed = input.consumeDelta(
      readWheelDeltaY(wheelEvent, {
        viewportHeight: input.getViewportHeight(),
        lineHeight: input.lineHeight,
      }),
    );

    if (consumed && event.cancelable) {
      event.preventDefault();
    }
  }

  function onTouchStart(event: Event): void {
    const clientY = readFirstTouchClientY(event as TouchEvent);

    if (clientY !== null) {
      touchTracker.start(clientY);
    }
  }

  function onTouchMove(event: Event): void {
    const clientY = readFirstTouchClientY(event as TouchEvent);

    if (clientY === null) {
      return;
    }

    const consumed = input.consumeDelta(touchTracker.move(clientY));

    if (consumed && event.cancelable) {
      event.preventDefault();
    }
  }

  function onTouchEnd(): void {
    touchTracker.reset();
  }

  input.target.addEventListener("wheel", onWheel, activeListenerOptions);
  input.target.addEventListener("touchstart", onTouchStart, passiveListenerOptions);
  input.target.addEventListener("touchmove", onTouchMove, activeListenerOptions);
  input.target.addEventListener("touchend", onTouchEnd, passiveListenerOptions);
  input.target.addEventListener("touchcancel", onTouchEnd, passiveListenerOptions);

  return {
    dispose(): void {
      if (disposed) {
        return;
      }

      input.target.removeEventListener("wheel", onWheel, activeListenerOptions);
      input.target.removeEventListener(
        "touchstart",
        onTouchStart,
        passiveListenerOptions,
      );
      input.target.removeEventListener(
        "touchmove",
        onTouchMove,
        activeListenerOptions,
      );
      input.target.removeEventListener(
        "touchend",
        onTouchEnd,
        passiveListenerOptions,
      );
      input.target.removeEventListener(
        "touchcancel",
        onTouchEnd,
        passiveListenerOptions,
      );
      touchTracker.reset();
      disposed = true;
    },
  };
}
