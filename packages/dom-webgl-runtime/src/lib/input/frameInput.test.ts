import { describe, expect, test } from "vitest";

import type { PageScrollStateController } from "./pageScroll";
import type { PointerController } from "./pointerController";
import { createFrameInputSource } from "./frameInput";

describe("createFrameInputSource", () => {
  test("combines monotonic time delta scroll and pointer into one frame input", () => {
    const scrollState = createScrollStateController();
    const pointerController = createPointerController();
    const clockValues = [100, 116, 112];
    const frameInput = createFrameInputSource(
      scrollState,
      pointerController,
      () => clockValues.shift() ?? 112,
    );

    expect(frameInput.update()).toEqual({
      time: 100,
      delta: 0,
      scroll: {
        mode: "page",
        pageProgress: 0.25,
        direction: 1,
        velocity: 24,
      },
      pointer: {
        x: 40,
        y: 20,
        normalizedX: -0.2,
        normalizedY: 0.6,
        isInside: true,
        isDown: false,
        downTime: 0,
        pressDuration: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragDeltaX: 0,
        dragDeltaY: 0,
        clickCount: 0,
      },
    });

    scrollState.scroll.pageProgress = 0.5;
    scrollState.scroll.direction = -1;
    scrollState.scroll.velocity = -8;
    pointerController.pointer = {
      ...pointerController.pointer,
      x: 80,
      normalizedX: 0.6,
      isDown: true,
    };

    expect(frameInput.update()).toMatchObject({
      time: 116,
      delta: 16,
      scroll: {
        mode: "page",
        pageProgress: 0.5,
        direction: -1,
        velocity: -8,
      },
      pointer: {
        x: 80,
        normalizedX: 0.6,
        isDown: true,
      },
    });

    expect(frameInput.update()).toMatchObject({
      time: 116,
      delta: 0,
    });
  });

  test("returns frame snapshots that cannot mutate controller state", () => {
    const scrollState = createScrollStateController();
    const pointerController = createPointerController();
    const frameInput = createFrameInputSource(
      scrollState,
      pointerController,
      () => 100,
    );

    const firstFrame = frameInput.update();
    firstFrame.time = 999;
    firstFrame.scroll.pageProgress = 0.95;
    firstFrame.pointer.x = 999;

    expect(frameInput.getState()).toMatchObject({
      time: 100,
      scroll: {
        pageProgress: 0.25,
      },
      pointer: {
        x: 40,
      },
    });

    expect(frameInput.update()).toMatchObject({
      time: 100,
      scroll: {
        pageProgress: 0.25,
      },
      pointer: {
        x: 40,
      },
    });
  });
});

function createScrollStateController(): PageScrollStateController & {
  scroll: ReturnType<PageScrollStateController["getState"]>;
} {
  const scroll: ReturnType<PageScrollStateController["getState"]> = {
    mode: "page",
    pageProgress: 0.25,
    direction: 1,
    velocity: 24,
  };

  return {
    scroll,
    getState() {
      return scroll;
    },
    update() {
      return scroll;
    },
  };
}

function createPointerController(): PointerController & {
  pointer: ReturnType<PointerController["getState"]>;
} {
  const controller = {
    pointer: {
      x: 40,
      y: 20,
      normalizedX: -0.2,
      normalizedY: 0.6,
      isInside: true,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 0,
    },
    getState() {
      return controller.pointer;
    },
    dispose() {
      // Test stub does not own DOM listeners.
    },
  };

  return controller;
}
