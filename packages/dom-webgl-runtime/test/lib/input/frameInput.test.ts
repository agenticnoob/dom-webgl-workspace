import { describe, expect, test } from "vitest";

import type { PointerController } from "../../../src/lib/input/pointerController";
import {
  createFrameInputSource,
  type ScrollStateController,
} from "../../../src/lib/input/frameInput";
import type { PageScrollStateController } from "../../../src/lib/input/pageScroll";

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

    expect(scrollState.scroll.mode).toBe("page");
    if (scrollState.scroll.mode !== "page") {
      throw new Error("Expected page scroll state in test fixture.");
    }
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
    expect(firstFrame.scroll.mode).toBe("page");
    if (firstFrame.scroll.mode !== "page") {
      throw new Error("Expected page scroll frame in test fixture.");
    }
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

  test("preserves gate scroll state in immutable frame snapshots", () => {
    const scrollState = createGateScrollStateController();
    const pointerController = createPointerController();
    const frameInput = createFrameInputSource(
      scrollState,
      pointerController,
      () => 100,
    );

    const firstFrame = frameInput.update();

    expect(firstFrame.scroll).toEqual({
      mode: "gate",
      activeGateKey: "hero.model",
      sceneProgress: 0.4,
      direction: 1,
      velocity: 250,
    });

    if (firstFrame.scroll.mode !== "gate") {
      throw new Error("Expected gate scroll frame in test fixture.");
    }
    firstFrame.scroll.activeGateKey = "mutated";
    firstFrame.scroll.sceneProgress = 0.95;

    scrollState.scroll.sceneProgress = 0.6;
    scrollState.scroll.velocity = 125;

    expect(frameInput.getState().scroll).toEqual({
      mode: "gate",
      activeGateKey: "hero.model",
      sceneProgress: 0.4,
      direction: 1,
      velocity: 250,
    });

    expect(frameInput.update().scroll).toEqual({
      mode: "gate",
      activeGateKey: "hero.model",
      sceneProgress: 0.6,
      direction: 1,
      velocity: 125,
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

function createGateScrollStateController(): ScrollStateController & {
  scroll: Extract<
    ReturnType<ScrollStateController["getState"]>,
    { mode: "gate" }
  >;
} {
  const scroll: Extract<
    ReturnType<ScrollStateController["getState"]>,
    { mode: "gate" }
  > = {
    mode: "gate",
    activeGateKey: "hero.model",
    sceneProgress: 0.4,
    direction: 1,
    velocity: 250,
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
