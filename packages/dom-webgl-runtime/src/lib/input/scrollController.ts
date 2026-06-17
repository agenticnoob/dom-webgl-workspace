import type { WebGLFrameInput, WebGLGateScrollBehavior } from "../types";
import {
  createPageScrollState,
  type PageScrollMetrics,
  type PageScrollStateController,
} from "./pageScroll";
import {
  createTouchDeltaTracker,
  readFirstTouchClientY,
  readWheelDeltaY,
} from "./scrollDelta";
import {
  createSceneGateStateMachine,
  detectSceneGateCrossing,
  measureSceneGateStart,
  type SceneGateActiveState,
  type SceneGateRect,
} from "./sceneGate";
import type { ScrollLockController } from "./scrollLock";

export type ScrollLockPort = ScrollLockController;
export type ScrollControllerEventTarget = Pick<
  EventTarget,
  "addEventListener" | "removeEventListener"
>;

export type ScrollControllerGateTarget = {
  key: string;
  scroll: WebGLGateScrollBehavior;
  getRect(): SceneGateRect;
};

export type ScrollController = PageScrollStateController & {
  registerGateTarget(target: ScrollControllerGateTarget): void;
  unregisterGateTarget(key: string): void;
  releaseActiveGate(): WebGLFrameInput["scroll"];
  consumeScrollDelta(deltaY: number): WebGLFrameInput["scroll"];
  dispose(): void;
};

export function createScrollController(input: {
  getScrollMetrics: () => PageScrollMetrics;
  scrollLock: ScrollLockPort;
  eventTarget?: ScrollControllerEventTarget;
  lineHeight?: number;
}): ScrollController {
  const pageScroll = createPageScrollState(input.getScrollMetrics);
  const sceneGate = createSceneGateStateMachine();
  const gateTargets = new Map<string, ScrollControllerGateTarget>();
  const previousOffsets = new Map<string, number>();
  let activeGate: SceneGateActiveState | null = null;
  let state = pageScroll.getState();
  const eventRouter = input.eventTarget
    ? createScrollEventRouter({
        target: input.eventTarget,
        getViewportHeight: () => input.getScrollMetrics().viewportHeight,
        lineHeight: input.lineHeight,
        consumeDelta: routeBrowserScrollDelta,
      })
    : null;

  return {
    getState(): WebGLFrameInput["scroll"] {
      return state;
    },

    update(): WebGLFrameInput["scroll"] {
      if (activeGate !== null) {
        state = createGateScrollState(activeGate, 0);
        return state;
      }

      const pageState = pageScroll.update();
      const crossing = findGateCrossing(input.getScrollMetrics().viewportHeight);

      if (crossing === null) {
        state = pageState;
        return state;
      }

      const nextGate =
        crossing.direction === "forward"
          ? sceneGate.enterForward(crossing.metadata)
          : sceneGate.enterReverse(crossing.metadata);

      if (nextGate.kind !== "active") {
        state = pageState;
        return state;
      }

      activeGate = nextGate;
      input.scrollLock.lock();
      state = createGateScrollState(activeGate, pageState.velocity);

      return state;
    },

    registerGateTarget(target: ScrollControllerGateTarget): void {
      gateTargets.set(target.key, target);
      previousOffsets.set(
        target.key,
        measureTargetOffset(target, input.getScrollMetrics().viewportHeight),
      );
    },

    unregisterGateTarget(key: string): void {
      gateTargets.delete(key);
      previousOffsets.delete(key);

      if (activeGate?.gateKey === key) {
        releaseActiveGate();
      }
    },

    releaseActiveGate(): WebGLFrameInput["scroll"] {
      return releaseActiveGate();
    },

    consumeScrollDelta(deltaY: number): WebGLFrameInput["scroll"] {
      return scrollDeltaThroughController(deltaY);
    },

    dispose(): void {
      releaseActiveGate();
      eventRouter?.dispose();
      input.scrollLock.dispose();
    },
  };

  function routeBrowserScrollDelta(deltaY: number): boolean {
    const previousState = state;
    const nextState = scrollDeltaThroughController(deltaY);

    return didGateConsumeDelta(previousState, nextState, deltaY);
  }

  function scrollDeltaThroughController(deltaY: number): WebGLFrameInput["scroll"] {
    if (activeGate === null) {
      state = pageScroll.getState();
      return state;
    }

    const nextGate = sceneGate.applyScrollDelta({
      state: activeGate,
      viewportHeight: input.getScrollMetrics().viewportHeight,
      deltaY,
    });

    if (nextGate.kind !== "active") {
      return releaseActiveGate();
    }

    activeGate = nextGate;
    state = createGateScrollState(activeGate, deltaY);

    return state;
  }

  function releaseActiveGate(): WebGLFrameInput["scroll"] {
    activeGate = null;
    input.scrollLock.unlock();
    state = pageScroll.getState();

    return state;
  }

  function findGateCrossing(viewportHeight: number): {
    direction: "forward" | "reverse";
    metadata: {
      gateKey: string;
      duration: number;
      release: "forward-complete" | "both-directions-complete";
    };
  } | null {
    for (const target of gateTargets.values()) {
      const currentOffset = measureTargetOffset(target, viewportHeight);
      const previousOffset = previousOffsets.get(target.key) ?? currentOffset;

      previousOffsets.set(target.key, currentOffset);

      const direction = detectSceneGateCrossing({
        previousOffset,
        currentOffset,
      });

      if (direction === null) {
        continue;
      }

      return {
        direction,
        metadata: {
          gateKey: target.key,
          duration: target.scroll.duration,
          release: target.scroll.release ?? "forward-complete",
        },
      };
    }

    return null;
  }
}

function createScrollEventRouter(input: {
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

function didGateConsumeDelta(
  previousState: WebGLFrameInput["scroll"],
  nextState: WebGLFrameInput["scroll"],
  deltaY: number,
): boolean {
  if (deltaY === 0 || previousState.mode !== "gate") {
    return false;
  }

  if (nextState.mode !== "gate") {
    return true;
  }

  return (
    nextState.activeGateKey !== previousState.activeGateKey ||
    nextState.sceneProgress !== previousState.sceneProgress
  );
}

function measureTargetOffset(
  target: ScrollControllerGateTarget,
  viewportHeight: number,
): number {
  return measureSceneGateStart({
    rect: target.getRect(),
    viewportHeight,
    start: target.scroll.start,
  }).offset;
}

function createGateScrollState(
  activeGate: SceneGateActiveState,
  velocity: number,
): WebGLFrameInput["scroll"] {
  return {
    mode: "gate",
    activeGateKey: activeGate.gateKey,
    sceneProgress: activeGate.sceneProgress,
    direction: readDirection(velocity),
    velocity,
  };
}

function readDirection(deltaY: number): -1 | 0 | 1 {
  if (deltaY > 0) {
    return 1;
  }

  if (deltaY < 0) {
    return -1;
  }

  return 0;
}
