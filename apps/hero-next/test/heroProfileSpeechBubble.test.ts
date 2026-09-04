import { describe, expect, test } from "vitest";

import {
  getHeroProfileSpeechBubbleCopy,
  resolveHeroProfileSpeechBubbleFrame,
  resolveHeroProfileVisibleCharacterCount,
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
      expect(frame.characterProgress).toEqual({ front, side, back });
      expect(frame.phase).toBe("holding");
    },
  );

  test("types each stage in, holds it, then deletes it without morphing the bubble", () => {
    const leavingFront = resolveHeroProfileSpeechBubbleFrame(0.08, false);
    const midpoint = resolveHeroProfileSpeechBubbleFrame(0.125, false);
    const openingSide = resolveHeroProfileSpeechBubbleFrame(0.1875, false);
    const holdingSide = resolveHeroProfileSpeechBubbleFrame(0.25, false);
    const leavingSide = resolveHeroProfileSpeechBubbleFrame(0.3125, false);

    expect(leavingFront.facing).toBe("front");
    expect(leavingFront.characterProgress.front).toBeGreaterThan(0);
    expect(leavingFront.characterProgress.front).toBeLessThan(1);
    expect(leavingFront.phase).toBe("deleting");
    expect(midpoint.facing).toBe("side");
    expect(midpoint.characterProgress).toEqual({ front: 0, side: 0, back: 0 });
    expect(midpoint.phase).toBe("blank");
    expect(openingSide.facing).toBe("side");
    expect(openingSide.characterProgress.side).toBeGreaterThan(0);
    expect(openingSide.characterProgress.side).toBeLessThan(1);
    expect(openingSide.phase).toBe("typing");
    expect(holdingSide.characterProgress.side).toBe(1);
    expect(holdingSide.phase).toBe("holding");
    expect(leavingSide.characterProgress.side).toBe(
      openingSide.characterProgress.side,
    );
    expect(leavingSide.phase).toBe("deleting");
  });

  test("retraces the same character progress deterministically in reverse", () => {
    for (const progress of [0, 0.03, 0.1, 0.125, 0.18, 0.25, 0.37, 0.5]) {
      const forward = resolveHeroProfileSpeechBubbleFrame(progress, false);
      const reverse = resolveHeroProfileSpeechBubbleFrame(1 - progress, false);

      expect(forward.characterProgress).toEqual(reverse.characterProgress);
      if (Math.max(...Object.values(forward.characterProgress)) > 0) {
        expect(forward.facing).toBe(reverse.facing);
      }
    }

    expect(resolveHeroProfileSpeechBubbleFrame(0.25, false)).toEqual(
      resolveHeroProfileSpeechBubbleFrame(0.75, false),
    );
  });

  test("quantizes reveal progress into whole typewriter characters", () => {
    expect(resolveHeroProfileVisibleCharacterCount(7, 0)).toBe(0);
    expect(resolveHeroProfileVisibleCharacterCount(7, 0.5)).toBe(3);
    expect(resolveHeroProfileVisibleCharacterCount(7, 1)).toBe(7);
    expect(resolveHeroProfileVisibleCharacterCount(7, Number.NaN)).toBe(0);
    expect(resolveHeroProfileVisibleCharacterCount(-1, 1)).toBe(0);
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
