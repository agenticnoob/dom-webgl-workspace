import { describe, expect, test, vi } from "vitest";

import {
  createFrameInputSource,
  type ScrollStateController,
} from "./frameInput";
import type { PointerController } from "./pointerController";
import type { WebGLScrollAdapter, WebGLScrollDeltaRouter } from "../types";
import { createScrollController, type ScrollLockPort } from "./scrollController";

describe("createScrollController", () => {
  test("stays in page mode when a registered gate has not crossed", () => {
    const metrics = {
      scrollY: 20,
      scrollHeight: 2000,
      viewportHeight: 1000,
    };
    const rect = {
      top: 80,
      height: 200,
    };
    const scrollLock = createScrollLockStub();
    const scrollController = createScrollController({
      getScrollMetrics: () => metrics,
      scrollLock,
    });

    scrollController.registerGateTarget({
      key: "hero.scene",
      scroll: {
        type: "gate",
        start: "top top",
        duration: 1,
      },
      getRect: () => rect,
    });

    metrics.scrollY = 40;
    rect.top = 60;

    expect(scrollController.update()).toEqual({
      mode: "page",
      pageProgress: 0.04,
      direction: 1,
      velocity: 20,
    });
    expect(scrollLock.isLocked()).toBe(false);
  });

  test("drives page mode and an active scene gate through one controller", () => {
    const metrics = {
      scrollY: 0,
      scrollHeight: 2000,
      viewportHeight: 1000,
    };
    const rect = {
      top: 80,
      height: 200,
    };
    const scrollLock = createScrollLockStub();
    const scrollController = createScrollController({
      getScrollMetrics: () => metrics,
      scrollLock,
    });

    scrollController.registerGateTarget({
      key: "hero.scene",
      scroll: {
        type: "gate",
        start: "top top",
        duration: 1,
        release: "forward-complete",
      },
      getRect: () => rect,
    });

    expect(scrollController.getState()).toEqual({
      mode: "page",
      pageProgress: 0,
      direction: 0,
      velocity: 0,
    });
    expect(scrollLock.isLocked()).toBe(false);

    metrics.scrollY = 80;
    rect.top = 0;

    expect(scrollController.update()).toMatchObject({
      mode: "gate",
      activeGateKey: "hero.scene",
      sceneProgress: 0,
    });
    expect(scrollLock.isLocked()).toBe(true);

    expect(scrollController.consumeScrollDelta(250)).toEqual({
      mode: "gate",
      activeGateKey: "hero.scene",
      sceneProgress: 0.25,
      direction: 1,
      velocity: 250,
    });
    expect(scrollLock.isLocked()).toBe(true);

    expect(scrollController.consumeScrollDelta(800)).toMatchObject({
      mode: "page",
      pageProgress: 0.08,
    });
    expect(scrollLock.isLocked()).toBe(false);
  });

  test("drives reverse entry for gates that release in both directions", () => {
    const metrics = {
      scrollY: 600,
      scrollHeight: 2000,
      viewportHeight: 1000,
    };
    const rect = {
      top: -80,
      height: 200,
    };
    const scrollLock = createScrollLockStub();
    const scrollController = createScrollController({
      getScrollMetrics: () => metrics,
      scrollLock,
    });

    scrollController.registerGateTarget({
      key: "hero.scene",
      scroll: {
        type: "gate",
        start: "top top",
        duration: 1,
        release: "both-directions-complete",
      },
      getRect: () => rect,
    });

    metrics.scrollY = 560;
    rect.top = 0;

    expect(scrollController.update()).toMatchObject({
      mode: "gate",
      activeGateKey: "hero.scene",
      sceneProgress: 1,
      direction: -1,
      velocity: -40,
    });
    expect(scrollLock.isLocked()).toBe(true);

    expect(scrollController.consumeScrollDelta(-250)).toEqual({
      mode: "gate",
      activeGateKey: "hero.scene",
      sceneProgress: 0.75,
      direction: -1,
      velocity: -250,
    });
  });

  test("unregistering the active gate target releases the lock and returns to page mode", () => {
    const metrics = {
      scrollY: 0,
      scrollHeight: 2000,
      viewportHeight: 1000,
    };
    const rect = {
      top: 80,
      height: 200,
    };
    const scrollLock = createScrollLockStub();
    const scrollController = createScrollController({
      getScrollMetrics: () => metrics,
      scrollLock,
    });

    scrollController.registerGateTarget({
      key: "hero.scene",
      scroll: {
        type: "gate",
        start: "top top",
        duration: 1,
      },
      getRect: () => rect,
    });

    metrics.scrollY = 80;
    rect.top = 0;

    expect(scrollController.update()).toMatchObject({
      mode: "gate",
      activeGateKey: "hero.scene",
      sceneProgress: 0,
    });
    expect(scrollLock.isLocked()).toBe(true);

    scrollController.unregisterGateTarget("hero.scene");

    expect(scrollLock.isLocked()).toBe(false);
    expect(scrollController.getState()).toEqual({
      mode: "page",
      pageProgress: 0.08,
      direction: 1,
      velocity: 80,
    });
  });

  test("can feed frame input through the generic scroll state controller port", () => {
    const metrics = {
      scrollY: 0,
      scrollHeight: 2000,
      viewportHeight: 1000,
    };
    const scrollController = createScrollController({
      getScrollMetrics: () => metrics,
      scrollLock: createScrollLockStub(),
    });
    const scrollState: ScrollStateController = scrollController;
    const frameInput = createFrameInputSource(
      scrollState,
      createPointerControllerStub(),
      () => 100,
    );

    expect(frameInput.update().scroll).toEqual({
      mode: "page",
      pageProgress: 0,
      direction: 0,
      velocity: 0,
    });
  });

  test("can read page metrics from a public scroll adapter", () => {
    const metrics = {
      scrollY: 120,
      scrollHeight: 2000,
      viewportHeight: 1000,
    };
    const scrollController = createScrollController({
      scrollAdapter: {
        readMetrics: () => metrics,
      },
      scrollLock: createScrollLockStub(),
    });

    metrics.scrollY = 240;

    expect(scrollController.update()).toEqual({
      mode: "page",
      pageProgress: 0.24,
      direction: 1,
      velocity: 120,
    });
  });

  test("routes gate deltas through a public scroll adapter and reports gate state", () => {
    const metrics = {
      scrollY: 0,
      scrollHeight: 2000,
      viewportHeight: 1000,
    };
    const rect = {
      top: 80,
      height: 200,
    };
    const gateStateChanges: unknown[] = [];
    let routeDelta: WebGLScrollDeltaRouter | undefined;
    const scrollAdapter: WebGLScrollAdapter = {
      readMetrics: () => metrics,
      connectDeltaRouter(router) {
        routeDelta = router;
        return () => {
          routeDelta = undefined;
        };
      },
      onGateStateChange(state) {
        gateStateChanges.push(state);
      },
    };
    const scrollLock = createScrollLockStub();
    const scrollController = createScrollController({
      scrollAdapter,
      scrollLock,
    });

    scrollController.registerGateTarget({
      key: "hero.scene",
      scroll: {
        type: "gate",
        start: "top top",
        duration: 1,
      },
      getRect: () => rect,
    });

    metrics.scrollY = 80;
    rect.top = 0;
    expect(scrollController.update()).toMatchObject({
      mode: "gate",
      activeGateKey: "hero.scene",
      sceneProgress: 0,
    });

    expect(routeDelta?.(250)).toBe(true);
    expect(scrollController.getState()).toEqual({
      mode: "gate",
      activeGateKey: "hero.scene",
      sceneProgress: 0.25,
      direction: 1,
      velocity: 250,
    });
    expect(scrollLock.isLocked()).toBe(true);
    expect(gateStateChanges).toContainEqual({
      active: true,
      key: "hero.scene",
      progress: 0.25,
    });

    scrollController.dispose();

    expect(routeDelta).toBeUndefined();
    expect(gateStateChanges.at(-1)).toEqual({ active: false });
  });

  test("routes active gate wheel input and prevents page scroll only when consumed", () => {
    const metrics = {
      scrollY: 0,
      scrollHeight: 2000,
      viewportHeight: 1000,
    };
    const rect = {
      top: 80,
      height: 200,
    };
    const eventTarget = document.createElement("div");
    const scrollLock = createScrollLockStub();
    const scrollController = createScrollController({
      getScrollMetrics: () => metrics,
      scrollLock,
      eventTarget,
    });

    scrollController.registerGateTarget({
      key: "hero.scene",
      scroll: {
        type: "gate",
        start: "top top",
        duration: 1,
      },
      getRect: () => rect,
    });

    metrics.scrollY = 80;
    rect.top = 0;
    expect(scrollController.update()).toMatchObject({
      mode: "gate",
      activeGateKey: "hero.scene",
      sceneProgress: 0,
    });

    const wheelEvent = createWheelEvent(250);
    eventTarget.dispatchEvent(wheelEvent);

    expect(wheelEvent.defaultPrevented).toBe(true);
    expect(scrollController.getState()).toEqual({
      mode: "gate",
      activeGateKey: "hero.scene",
      sceneProgress: 0.25,
      direction: 1,
      velocity: 250,
    });
    expect(scrollLock.isLocked()).toBe(true);
  });

  test("leaves inactive page-mode wheel input unprevented", () => {
    const metrics = {
      scrollY: 0,
      scrollHeight: 2000,
      viewportHeight: 1000,
    };
    const eventTarget = document.createElement("div");
    const scrollController = createScrollController({
      getScrollMetrics: () => metrics,
      scrollLock: createScrollLockStub(),
      eventTarget,
    });

    const wheelEvent = createWheelEvent(250);
    eventTarget.dispatchEvent(wheelEvent);

    expect(wheelEvent.defaultPrevented).toBe(false);
    expect(scrollController.getState()).toEqual({
      mode: "page",
      pageProgress: 0,
      direction: 0,
      velocity: 0,
    });
  });

  test("routes touch move input through the same active gate delta path", () => {
    const metrics = {
      scrollY: 0,
      scrollHeight: 2000,
      viewportHeight: 1000,
    };
    const rect = {
      top: 80,
      height: 200,
    };
    const eventTarget = document.createElement("div");
    const scrollController = createScrollController({
      getScrollMetrics: () => metrics,
      scrollLock: createScrollLockStub(),
      eventTarget,
    });

    scrollController.registerGateTarget({
      key: "hero.scene",
      scroll: {
        type: "gate",
        start: "top top",
        duration: 1,
      },
      getRect: () => rect,
    });

    metrics.scrollY = 80;
    rect.top = 0;
    scrollController.update();

    eventTarget.dispatchEvent(createTouchEvent("touchstart", 300));
    const touchMoveEvent = createTouchEvent("touchmove", 250);
    eventTarget.dispatchEvent(touchMoveEvent);

    expect(touchMoveEvent.defaultPrevented).toBe(true);
    expect(scrollController.getState()).toEqual({
      mode: "gate",
      activeGateKey: "hero.scene",
      sceneProgress: 0.05,
      direction: 1,
      velocity: 50,
    });
  });

  test("dispose removes browser listeners and unlocks active gates", () => {
    const metrics = {
      scrollY: 0,
      scrollHeight: 2000,
      viewportHeight: 1000,
    };
    const rect = {
      top: 80,
      height: 200,
    };
    const eventTarget = document.createElement("div");
    const removeEventListener = vi.spyOn(eventTarget, "removeEventListener");
    const scrollLock = createScrollLockStub();
    const scrollController = createScrollController({
      getScrollMetrics: () => metrics,
      scrollLock,
      eventTarget,
    });

    scrollController.registerGateTarget({
      key: "hero.scene",
      scroll: {
        type: "gate",
        start: "top top",
        duration: 1,
      },
      getRect: () => rect,
    });

    metrics.scrollY = 80;
    rect.top = 0;
    scrollController.update();
    expect(scrollLock.isLocked()).toBe(true);

    scrollController.dispose();
    scrollController.dispose();

    const wheelEvent = createWheelEvent(250);
    eventTarget.dispatchEvent(wheelEvent);

    expect(scrollLock.isLocked()).toBe(false);
    expect(wheelEvent.defaultPrevented).toBe(false);
    expect(removeEventListener).toHaveBeenCalledWith(
      "wheel",
      expect.any(Function),
      expect.objectContaining({ passive: false }),
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      "touchmove",
      expect.any(Function),
      expect.objectContaining({ passive: false }),
    );
  });
});

function createWheelEvent(deltaY: number, deltaMode = 0): WheelEvent {
  const event = new Event("wheel", { cancelable: true }) as WheelEvent;

  Object.defineProperties(event, {
    deltaY: { value: deltaY },
    deltaMode: { value: deltaMode },
  });

  return event;
}

function createTouchEvent(type: string, clientY: number): TouchEvent {
  const event = new Event(type, { cancelable: true }) as TouchEvent;

  Object.defineProperty(event, "touches", {
    value: [{ clientY }],
  });

  return event;
}

function createScrollLockStub(): ScrollLockPort {
  let locked = false;

  return {
    lock() {
      locked = true;
    },
    unlock() {
      locked = false;
    },
    isLocked: () => locked,
    dispose() {
      locked = false;
    },
  };
}

function createPointerControllerStub(): PointerController {
  return {
    getState() {
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
    },
    dispose() {
      // Test stub does not own DOM listeners.
    },
  };
}
