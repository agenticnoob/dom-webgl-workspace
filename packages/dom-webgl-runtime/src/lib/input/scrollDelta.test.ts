import { describe, expect, test } from "vitest";

import {
  DEFAULT_SCROLL_LINE_HEIGHT,
  createTouchDeltaTracker,
  readFirstTouchClientY,
  readTouchMoveDelta,
  readWheelDeltaY,
} from "./scrollDelta";

describe("readWheelDeltaY", () => {
  test("reads pixel-mode wheel deltaY as pixels", () => {
    expect(
      readWheelDeltaY(
        { deltaY: 42, deltaMode: 0 },
        { viewportHeight: 800 },
      ),
    ).toBe(42);
  });

  test("normalizes line-mode wheel deltaY with the default line height", () => {
    expect(
      readWheelDeltaY(
        { deltaY: 3, deltaMode: 1 },
        { viewportHeight: 800 },
      ),
    ).toBe(3 * DEFAULT_SCROLL_LINE_HEIGHT);
  });

  test("normalizes line-mode wheel deltaY with a caller-provided line height", () => {
    expect(
      readWheelDeltaY(
        { deltaY: -2, deltaMode: 1 },
        { lineHeight: 20, viewportHeight: 800 },
      ),
    ).toBe(-40);
  });

  test("normalizes page-mode wheel deltaY with the viewport height", () => {
    expect(
      readWheelDeltaY(
        { deltaY: 1.5, deltaMode: 2 },
        { viewportHeight: 640 },
      ),
    ).toBe(960);
  });
});

describe("readTouchMoveDelta", () => {
  test("returns positive scroll delta when the finger moves upward", () => {
    expect(readTouchMoveDelta({ previousY: 300, currentY: 250 })).toBe(50);
  });

  test("returns negative scroll delta when the finger moves downward", () => {
    expect(readTouchMoveDelta({ previousY: 250, currentY: 280 })).toBe(-30);
  });
});

describe("createTouchDeltaTracker", () => {
  test("derives move deltas from the previous touch Y position", () => {
    const tracker = createTouchDeltaTracker();

    tracker.start(300);

    expect(tracker.move(250)).toBe(50);
    expect(tracker.move(280)).toBe(-30);
  });

  test("returns zero before start or after reset", () => {
    const tracker = createTouchDeltaTracker();

    expect(tracker.move(250)).toBe(0);

    tracker.start(300);
    expect(tracker.move(250)).toBe(50);

    tracker.reset();
    expect(tracker.move(240)).toBe(0);
  });
});

describe("readFirstTouchClientY", () => {
  test("reads the first active touch clientY", () => {
    expect(
      readFirstTouchClientY({
        touches: [{ clientY: 320 }, { clientY: 120 }],
      }),
    ).toBe(320);
  });

  test("returns null when no active touch is present", () => {
    expect(readFirstTouchClientY({ touches: [] })).toBeNull();
  });
});
