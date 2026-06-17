import type { WebGLFrameInput, WebGLGateScrollBehavior } from "../types";
import {
  createPageScrollState,
  type PageScrollMetrics,
  type PageScrollStateController,
} from "./pageScroll";
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
  consumeScrollDelta(deltaY: number): WebGLFrameInput["scroll"];
  dispose(): void;
};

export function createScrollController(input: {
  getScrollMetrics: () => PageScrollMetrics;
  scrollLock: ScrollLockPort;
}): ScrollController {
  const pageScroll = createPageScrollState(input.getScrollMetrics);
  const sceneGate = createSceneGateStateMachine();
  const gateTargets = new Map<string, ScrollControllerGateTarget>();
  const previousOffsets = new Map<string, number>();
  let activeGate: SceneGateActiveState | null = null;
  let state = pageScroll.getState();

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
    },

    consumeScrollDelta(deltaY: number): WebGLFrameInput["scroll"] {
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
        activeGate = null;
        input.scrollLock.unlock();
        state = pageScroll.getState();
        return state;
      }

      activeGate = nextGate;
      state = createGateScrollState(activeGate, deltaY);

      return state;
    },

    dispose(): void {
      activeGate = null;
      input.scrollLock.dispose();
    },
  };

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
