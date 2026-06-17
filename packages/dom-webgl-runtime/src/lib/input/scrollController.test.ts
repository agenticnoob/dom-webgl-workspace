import { describe, expect, test } from "vitest";

import {
  createFrameInputSource,
  type ScrollStateController,
} from "./frameInput";
import type { PointerController } from "./pointerController";
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
});

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
