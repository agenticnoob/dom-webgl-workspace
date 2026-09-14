import { describe, expect, test } from "vitest";

import {
  resolveModelStoryFrame,
  resolveStoryCharacterCount,
  resolveStoryScrollProgress,
} from "../../src/recipes/model-story/frame";
import {
  createModelStoryEffectDeclaration,
  resolveModelStoryTransform,
  type ModelStoryFraming,
} from "../../src/recipes/model-story/effect";
import {
  groupStoryLineIndexes,
  resolveStoryLineShiftForExclusions,
  splitStoryText,
  type StoryWrapRect,
} from "../../src/recipes/model-story/wrap";

const rect = (
  left: number,
  top: number,
  width: number,
  height: number,
): StoryWrapRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

describe("model story reversible timeline", () => {
  test.each([
    [0, "front"],
    [0.25, "side"],
    [0.5, "back"],
    [0.75, "side"],
    [1, "front"],
  ] as const)(
    "holds the %s view with a full %s caption",
    (progress, facing) => {
      expect(resolveModelStoryFrame(progress)).toEqual({
        rotationY: -progress * Math.PI * 2,
        facing,
        phase: "holding",
        characterProgress: 1,
      });
    },
  );

  test("a full turn and its reverse retrace the same character counts at matching angles", () => {
    const frames = [0, 0.08, 0.125, 0.1875, 0.25, 0.3125, 0.5, 0.875, 1].map(
      (progress) => ({ progress, frame: resolveModelStoryFrame(progress) }),
    );
    for (const { progress, frame } of frames.reverse())
      expect(resolveModelStoryFrame(progress)).toEqual(frame);
    expect(resolveModelStoryFrame(0.1875).phase).toBe("typing");
    expect(resolveModelStoryFrame(0.3125).phase).toBe("deleting");
    expect(resolveModelStoryFrame(0.1875).characterProgress).toBe(
      resolveModelStoryFrame(0.3125).characterProgress,
    );
    expect(resolveModelStoryFrame(0.125).phase).toBe("blank");
    expect(resolveStoryCharacterCount(7, 0.5)).toBe(3);
  });

  test("reduced motion is a complete front message and no rotation", () => {
    expect(resolveModelStoryFrame(0.5, true)).toEqual(
      resolveModelStoryFrame(0),
    );
    expect(resolveModelStoryFrame(Number.NaN)).toEqual(
      resolveModelStoryFrame(0),
    );
    expect(resolveStoryCharacterCount(Infinity, 1)).toBe(0);
  });

  test("starts and ends exactly at the body viewport alignments", () => {
    expect(resolveStoryScrollProgress(0, 3000, 1000)).toBe(0);
    expect(resolveStoryScrollProgress(-1000, 3000, 1000)).toBe(0.5);
    expect(resolveStoryScrollProgress(-2000, 3000, 1000)).toBe(1);
    expect(resolveStoryScrollProgress(100, 3000, 1000)).toBe(0);
    expect(resolveStoryScrollProgress(-3000, 3000, 1000)).toBe(1);
    expect(resolveStoryScrollProgress(0, 700, 1000)).toBe(0);
  });

  test("rejects invalid framing before registering a model", () => {
    expect(() =>
      createModelStoryEffectDeclaration(
        "story",
        { center: [0, 0, 0], size: [1, 0, 1] },
        { aspect: 1, reducedMotion: false, setModelReady() {} },
      ),
    ).toThrow("three positive dimensions");
  });

  test("rotates an off-center GLB around its visual center with one stable responsive scale", () => {
    const framing = {
      center: [2, 3, 4],
      size: [1, 2, 1],
    } satisfies ModelStoryFraming;
    const front = resolveModelStoryTransform(0, framing, 1);
    const side = resolveModelStoryTransform(-Math.PI / 2, framing, 1);
    const end = resolveModelStoryTransform(-Math.PI * 2, framing, 1);
    expect(side.scale).toBe(front.scale);
    expect(front.position[0] + 2 * front.scale).toBeCloseTo(0);
    expect(side.position[0] - 4 * side.scale).toBeCloseTo(0);
    expect(side.position[2] + 2 * side.scale).toBeCloseTo(0);
    expect(side.position[1] + 3 * side.scale).toBeCloseTo(0);
    expect(end.position[0]).toBeCloseTo(front.position[0]);
    expect(end.position[2]).toBeCloseTo(front.position[2]);
    expect(resolveModelStoryTransform(0, framing, 0.35).scale).toBeLessThan(
      front.scale,
    );
  });
});

describe("model story rendered-line exclusions", () => {
  const model = { kind: "ellipse", rect: rect(480, 100, 320, 400) } as const;
  const bubble = {
    kind: "rounded-rectangle",
    rect: rect(480, 20, 320, 120),
    radius: 18,
  } as const;
  const bounds = { left: 24, right: 1256 };

  test("each rendered line moves independently and clears both shapes", () => {
    const center = resolveStoryLineShiftForExclusions(
      rect(250, 280, 370, 30),
      [model, bubble],
      bounds,
      "left",
      16,
    );
    const shoulder = resolveStoryLineShiftForExclusions(
      rect(250, 150, 370, 20),
      [model, bubble],
      bounds,
      "left",
      16,
    );
    const caption = resolveStoryLineShiftForExclusions(
      rect(660, 60, 340, 25),
      [model, bubble],
      bounds,
      "right",
      16,
    );
    expect(center).toBe(-156);
    expect(shoulder).toBeGreaterThan(center);
    expect(caption).toBe(156);
    expect(660 + caption).toBeGreaterThanOrEqual(bubble.rect.right + 16);
    expect(
      resolveStoryLineShiftForExclusions(
        rect(250, 600, 370, 30),
        [model, bubble],
        bounds,
        "left",
        16,
      ),
    ).toBe(0);
  });

  test("clamps outward movement to gutters and ignores invalid geometry", () => {
    expect(
      resolveStoryLineShiftForExclusions(
        rect(50, 280, 550, 30),
        [model],
        bounds,
        "left",
        16,
      ),
    ).toBe(-26);
    expect(
      resolveStoryLineShiftForExclusions(
        rect(50, NaN, 550, 30),
        [model],
        bounds,
        "left",
        16,
      ),
    ).toBe(0);
  });

  test("groups mixed-script glyph boxes by overlap and preserves semantic text", () => {
    expect(
      groupStoryLineIndexes([
        rect(100, 103, 50, 18),
        rect(150, 100, 16, 22),
        rect(100, 128, 16, 22),
      ]),
    ).toEqual([[0, 1], [2]]);
    const text = "观察 AI objects 的另一面。";
    expect(splitStoryText(text).join("")).toBe(text);
    expect(splitStoryText("AI 视角")).toEqual(["AI", " ", "视", "角"]);
  });
});
