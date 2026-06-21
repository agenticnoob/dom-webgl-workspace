import type {
  WebGLFrameInput,
  WebGLGateScrollBehavior,
  WebGLScrollAdapter,
} from "../types";
import {
  createPageScrollState,
  type PageScrollMetrics,
  type PageScrollStateController,
} from "./pageScroll";
import {
  createScrollEventRouter,
  type ScrollControllerEventTarget,
} from "./scrollDeltaRouter";
import {
  createSceneGateStateMachine,
  detectSceneGateCrossing,
  measureSceneGateStart,
  type SceneGateActiveState,
  type SceneGateRect,
} from "./sceneGate";
import type { ScrollLockController } from "./scrollLock";

export type ScrollLockPort = ScrollLockController;

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
  getScrollMetrics?: () => PageScrollMetrics;
  scrollAdapter?: WebGLScrollAdapter;
  scrollLock: ScrollLockPort;
  eventTarget?: ScrollControllerEventTarget;
  lineHeight?: number;
}): ScrollController {
  const readScrollMetrics = createScrollMetricsReader(input);
  const pageScroll = createPageScrollState(readScrollMetrics);
  const sceneGate = createSceneGateStateMachine();
  const gateTargets = new Map<string, ScrollControllerGateTarget>();
  const previousOffsets = new Map<string, number>();
  let activeGate: SceneGateActiveState | null = null;
  let state = pageScroll.getState();
  const adapterDeltaDisconnect =
    input.scrollAdapter?.connectDeltaRouter?.(routeBrowserScrollDelta) ?? null;
  const eventRouter = !adapterDeltaDisconnect && input.eventTarget
    ? createScrollEventRouter({
        target: input.eventTarget,
        getViewportHeight: () => readScrollMetrics().viewportHeight,
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
        emitGateState(state);
        return state;
      }

      const pageState = pageScroll.update();
      const crossing = findGateCrossing(readScrollMetrics().viewportHeight);

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
      emitGateState(state);

      return state;
    },

    registerGateTarget(target: ScrollControllerGateTarget): void {
      gateTargets.set(target.key, target);
      previousOffsets.set(
        target.key,
        measureTargetOffset(target, readScrollMetrics().viewportHeight),
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
      adapterDeltaDisconnect?.();
      input.scrollAdapter?.dispose?.();
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
      viewportHeight: readScrollMetrics().viewportHeight,
      deltaY,
    });

    if (nextGate.kind !== "active") {
      return releaseActiveGate();
    }

    activeGate = nextGate;
    state = createGateScrollState(activeGate, deltaY);
    emitGateState(state);

    return state;
  }

  function releaseActiveGate(): WebGLFrameInput["scroll"] {
    activeGate = null;
    input.scrollLock.unlock();
    state = pageScroll.getState();
    emitGateState(state);

    return state;
  }

  function emitGateState(scroll: WebGLFrameInput["scroll"]): void {
    if (scroll.mode === "gate") {
      input.scrollAdapter?.onGateStateChange?.({
        active: true,
        key: scroll.activeGateKey,
        progress: scroll.sceneProgress,
      });
      return;
    }

    input.scrollAdapter?.onGateStateChange?.({ active: false });
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

function createScrollMetricsReader(input: {
  getScrollMetrics?: () => PageScrollMetrics;
  scrollAdapter?: WebGLScrollAdapter;
}): () => PageScrollMetrics {
  if (input.scrollAdapter) {
    return () => input.scrollAdapter!.readMetrics();
  }

  if (input.getScrollMetrics) {
    return input.getScrollMetrics;
  }

  throw new Error("createScrollController requires scroll metrics.");
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
