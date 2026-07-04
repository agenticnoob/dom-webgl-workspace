import { describe, expect, test } from "vitest";

import {
  normalizeTimelineBinding,
  readTimelineProgress,
} from "../../../src/lib/timeline/timelineDeclarations";

describe("normalizeTimelineBinding", () => {
  test("normalizes string bindings into id and progressKey", () => {
    expect(normalizeTimelineBinding(" hero.3d ")).toEqual({
      id: "hero.3d",
      progressKey: "hero.3d",
    });
  });

  test("normalizes object bindings with active ranges", () => {
    expect(
      normalizeTimelineBinding({
        id: "hero.3d",
        progressKey: "scroll.hero",
        active: { from: 0.2, to: 0.8 },
      }),
    ).toEqual({
      id: "hero.3d",
      progressKey: "scroll.hero",
      active: { from: 0.2, to: 0.8 },
    });
  });

  test("defaults active range boundaries", () => {
    expect(
      normalizeTimelineBinding({
        id: "hero.3d",
        active: {},
      }),
    ).toEqual({
      id: "hero.3d",
      progressKey: "hero.3d",
      active: { from: 0, to: 1 },
    });
  });

  test("rejects empty ids and reversed active ranges", () => {
    expect(() => normalizeTimelineBinding(" ")).toThrow(
      "WebGL timeline id must be a non-empty string.",
    );
    expect(() =>
      normalizeTimelineBinding({
        id: "hero.3d",
        active: { from: 0.9, to: 0.1 },
      }),
    ).toThrow("WebGL timeline active range must have from <= to.");
  });
});

describe("readTimelineProgress", () => {
  test("reads progress and active state from the runtime progress source", () => {
    const binding = normalizeTimelineBinding({
      id: "hero.3d",
      active: { from: 0.25, to: 0.75 },
    });
    expect(binding).toBeDefined();
    if (!binding) {
      throw new Error("Expected timeline binding to normalize.");
    }

    expect(readTimelineProgress(binding, { get: () => 0.5 })).toEqual({
      id: "hero.3d",
      progressKey: "hero.3d",
      progress: 0.5,
      active: true,
    });
    expect(readTimelineProgress(binding, { get: () => 0.9 })).toEqual({
      id: "hero.3d",
      progressKey: "hero.3d",
      progress: 0.9,
      active: false,
    });
  });
});
