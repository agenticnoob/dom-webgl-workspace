import { describe, expect, test } from "vitest";

import {
  getHeroProfileSpeechBubbleCopy,
  resolveHeroProfileSpeechBubbleFrame,
} from "../src/profile/speechBubble";

describe("hero profile speech bubble", () => {
  test.each([
    [0, "front", 1, 0, 0],
    [0.25, "side", 0, 1, 0],
    [0.5, "back", 0, 0, 1],
    [0.75, "side", 0, 1, 0],
    [1, "front", 1, 0, 0],
  ] as const)(
    "maps progress %s to the model's %s view",
    (progress, facing, front, side, back) => {
      const frame = resolveHeroProfileSpeechBubbleFrame(progress, false);

      expect(frame.facing).toBe(facing);
      expect(frame.weights).toEqual({ front, side, back });
    },
  );

  test("crossfades continuously and retraces the same orientation in reverse", () => {
    const before = resolveHeroProfileSpeechBubbleFrame(0.124, false);
    const midpoint = resolveHeroProfileSpeechBubbleFrame(0.125, false);
    const after = resolveHeroProfileSpeechBubbleFrame(0.126, false);

    expect(midpoint.weights.front).toBeCloseTo(0.5, 12);
    expect(midpoint.weights.side).toBeCloseTo(0.5, 12);
    expect(before.weights.front).toBeGreaterThan(midpoint.weights.front);
    expect(after.weights.front).toBeLessThan(midpoint.weights.front);
    expect(resolveHeroProfileSpeechBubbleFrame(0.25, false)).toEqual(
      resolveHeroProfileSpeechBubbleFrame(0.75, false),
    );
  });

  test("keeps the front message for reduced motion and invalid progress", () => {
    expect(resolveHeroProfileSpeechBubbleFrame(0.5, true)).toEqual(
      resolveHeroProfileSpeechBubbleFrame(0, false),
    );
    expect(resolveHeroProfileSpeechBubbleFrame(Number.NaN, false)).toEqual(
      resolveHeroProfileSpeechBubbleFrame(0, false),
    );
  });

  test("owns the requested Chinese messages and localized English equivalents", () => {
    expect(getHeroProfileSpeechBubbleCopy("zh")).toEqual({
      front: "这是我的正面",
      side: "这是我的侧面",
      back: "这是我的背面",
    });
    expect(getHeroProfileSpeechBubbleCopy("en")).toEqual({
      front: "This is my front.",
      side: "This is my side.",
      back: "This is my back.",
    });
  });
});
