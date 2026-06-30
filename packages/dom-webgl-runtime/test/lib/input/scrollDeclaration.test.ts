import { describe, expect, test } from "vitest";

import { normalizeScrollBehavior } from "../../../src/lib/input/scrollDeclaration";

describe("normalizeScrollBehavior", () => {
  test("normalizes omitted and page scroll declarations to page mode", () => {
    expect(normalizeScrollBehavior()).toEqual({ type: "page" });
    expect(normalizeScrollBehavior({ type: "page" })).toEqual({ type: "page" });
    expect(normalizeScrollBehavior({})).toEqual({ type: "page" });
  });

  test("normalizes gate declarations with trimmed start and default release", () => {
    expect(
      normalizeScrollBehavior({
        type: "gate",
        start: "  top top  ",
        duration: 1.5,
      }),
    ).toEqual({
      type: "gate",
      start: "top top",
      duration: 1.5,
      release: "forward-complete",
    });
  });

  test("preserves explicit gate release", () => {
    expect(
      normalizeScrollBehavior({
        type: "gate",
        start: "center center",
        duration: 2,
        release: "both-directions-complete",
      }),
    ).toEqual({
      type: "gate",
      start: "center center",
      duration: 2,
      release: "both-directions-complete",
    });
  });

  test("rejects blank gate start", () => {
    expect(() =>
      normalizeScrollBehavior({
        type: "gate",
        start: "   ",
        duration: 1,
      }),
    ).toThrowError(/start/i);
  });

  test("rejects non-positive or non-finite gate duration", () => {
    expect(() =>
      normalizeScrollBehavior({
        type: "gate",
        start: "top top",
        duration: 0,
      }),
    ).toThrowError(/duration/i);

    expect(() =>
      normalizeScrollBehavior({
        type: "gate",
        start: "top top",
        duration: Number.NaN,
      }),
    ).toThrowError(/duration/i);

    expect(() =>
      normalizeScrollBehavior({
        type: "gate",
        start: "top top",
        duration: Number.POSITIVE_INFINITY,
      }),
    ).toThrowError(/duration/i);
  });

  test("rejects unknown gate release values", () => {
    expect(() =>
      normalizeScrollBehavior({
        type: "gate",
        start: "top top",
        duration: 1,
        release: "sideways" as unknown as "forward-complete",
      }),
    ).toThrowError(/release/i);
  });
});
