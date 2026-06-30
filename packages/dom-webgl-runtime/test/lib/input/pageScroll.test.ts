import { describe, expect, test } from "vitest";

import { createPageScrollFrameState, createPageScrollState } from "../../../src/lib/input/pageScroll";

describe("createPageScrollState", () => {
  test("creates reusable page scroll frame state from metrics and delta", () => {
    expect(
      createPageScrollFrameState(
        {
          scrollY: 250,
          scrollHeight: 2000,
          viewportHeight: 1000,
        },
        125,
      ),
    ).toEqual({
      mode: "page",
      pageProgress: 0.25,
      direction: 1,
      velocity: 125,
    });
  });

  test("reports page mode by default and clamps page progress", () => {
    const metrics = {
      scrollY: -20,
      scrollHeight: 1000,
      viewportHeight: 500,
    };
    const pageScroll = createPageScrollState(() => metrics);

    expect(pageScroll.getState()).toEqual({
      mode: "page",
      pageProgress: 0,
      direction: 0,
      velocity: 0,
    });

    metrics.scrollY = 750;

    expect(pageScroll.update()).toMatchObject({
      mode: "page",
      pageProgress: 1,
    });
  });

  test("updates direction and velocity from scroll deltas", () => {
    const metrics = {
      scrollY: 100,
      scrollHeight: 1100,
      viewportHeight: 100,
    };
    const pageScroll = createPageScrollState(() => metrics);

    metrics.scrollY = 140;

    expect(pageScroll.update()).toMatchObject({
      direction: 1,
      velocity: 40,
      pageProgress: 0.14,
    });

    metrics.scrollY = 115;

    expect(pageScroll.update()).toMatchObject({
      direction: -1,
      velocity: -25,
      pageProgress: 0.115,
    });

    expect(pageScroll.update()).toMatchObject({
      direction: 0,
      velocity: 0,
      pageProgress: 0.115,
    });
  });
});
