import { describe, expect, test } from "vitest";

import {
  groupHeroProfileLineIndexes,
  resolveHeroProfileLineShift,
  resolveHeroProfileLineShiftForExclusions,
  resolveHeroProfileRoundedRectWrapInset,
  resolveHeroProfileWrapInset,
  splitHeroProfileText,
} from "../src/profile/wrap";

const modelExclusion = {
  left: 480,
  right: 800,
  top: 100,
  bottom: 500,
  width: 320,
  height: 400,
} as const;

describe("hero profile content wrap", () => {
  test("reserves the full horizontal radius across the model center", () => {
    expect(
      resolveHeroProfileWrapInset(
        {
          left: 240,
          right: 720,
          top: 280,
          bottom: 320,
          width: 480,
          height: 40,
        },
        modelExclusion,
      ),
    ).toBe(160);
  });

  test("follows the ellipse as a block approaches the model", () => {
    expect(
      resolveHeroProfileWrapInset(
        {
          left: 240,
          right: 720,
          top: 140,
          bottom: 150,
          width: 480,
          height: 10,
        },
        modelExclusion,
      ),
    ).toBeCloseTo(105.83, 2);
  });

  test("returns no extra inset outside the model exclusion", () => {
    expect(
      resolveHeroProfileWrapInset(
        {
          left: 240,
          right: 720,
          top: 0,
          bottom: 20,
          width: 480,
          height: 20,
        },
        modelExclusion,
      ),
    ).toBe(0);
  });

  test("fails safe for invalid or collapsed measurements", () => {
    expect(
      resolveHeroProfileWrapInset(
        {
          left: 240,
          right: 720,
          top: Number.NaN,
          bottom: 20,
          width: 480,
          height: 20,
        },
        modelExclusion,
      ),
    ).toBe(0);
    expect(
      resolveHeroProfileWrapInset(
        {
          left: 240,
          right: 720,
          top: 280,
          bottom: 320,
          width: 480,
          height: 40,
        },
        { ...modelExclusion, right: 480, width: 0 },
      ),
    ).toBe(0);
  });

  test("pushes each intersecting line toward its own outer side", () => {
    const bounds = { left: 0, right: 1280 };

    expect(
      resolveHeroProfileLineShift(
        {
          left: 250,
          right: 620,
          top: 280,
          bottom: 320,
          width: 370,
          height: 40,
        },
        modelExclusion,
        bounds,
        "left",
        16,
      ),
    ).toBe(-156);
    expect(
      resolveHeroProfileLineShift(
        {
          left: 660,
          right: 1010,
          top: 280,
          bottom: 320,
          width: 350,
          height: 40,
        },
        modelExclusion,
        bounds,
        "right",
        16,
      ),
    ).toBe(156);
  });

  test("resolves different shifts for neighboring lines along the ellipse", () => {
    const bounds = { left: 0, right: 1280 };
    const centerShift = resolveHeroProfileLineShift(
      {
        left: 250,
        right: 620,
        top: 280,
        bottom: 320,
        width: 370,
        height: 40,
      },
      modelExclusion,
      bounds,
      "left",
      16,
    );
    const edgeShift = resolveHeroProfileLineShift(
      {
        left: 250,
        right: 620,
        top: 140,
        bottom: 150,
        width: 370,
        height: 10,
      },
      modelExclusion,
      bounds,
      "left",
      16,
    );

    expect(centerShift).toBeLessThan(edgeShift);
    expect(edgeShift).toBeCloseTo(-101.83, 2);
  });

  test("keeps lines in their viewport bounds and resets outside the model", () => {
    const line = {
      left: 150,
      right: 620,
      top: 280,
      bottom: 320,
      width: 470,
      height: 40,
    } as const;

    expect(
      resolveHeroProfileLineShift(
        line,
        modelExclusion,
        { left: 100, right: 1180 },
        "left",
        16,
      ),
    ).toBe(-50);
    expect(
      resolveHeroProfileLineShift(
        { ...line, top: 0, bottom: 20, height: 20 },
        modelExclusion,
        { left: 100, right: 1180 },
        "left",
        16,
      ),
    ).toBe(0);
  });

  test("uses the furthest outward shift across the model and speech bubble", () => {
    const speechBubbleExclusion = {
      left: 500,
      right: 780,
      top: 20,
      bottom: 160,
      width: 280,
      height: 140,
    } as const;
    const line = {
      left: 250,
      right: 620,
      top: 100,
      bottom: 130,
      width: 370,
      height: 30,
    } as const;

    expect(
      resolveHeroProfileLineShiftForExclusions(
        line,
        [
          { kind: "ellipse", rect: modelExclusion },
          {
            kind: "rounded-rectangle",
            rect: speechBubbleExclusion,
            radius: 16,
          },
        ],
        { left: 0, right: 1280 },
        "left",
        16,
      ),
    ).toBeLessThan(
      resolveHeroProfileLineShift(
        line,
        modelExclusion,
        { left: 0, right: 1280 },
        "left",
        16,
      ),
    );
    expect(
      resolveHeroProfileLineShiftForExclusions(
        line,
        [
          { kind: "ellipse", rect: modelExclusion },
          {
            kind: "rounded-rectangle",
            rect: speechBubbleExclusion,
            radius: 16,
          },
        ],
        { left: 0, right: 1280 },
        "right",
        16,
      ),
    ).toBeGreaterThan(0);
  });

  test("clears a rounded rectangle and eases into its flat edge", () => {
    const speechBubbleExclusion = {
      left: 500,
      right: 780,
      top: 20,
      bottom: 100,
      width: 280,
      height: 80,
    } as const;
    const atCenter = {
      left: 250,
      right: 620,
      top: 50,
      bottom: 70,
      width: 370,
      height: 20,
    } as const;
    const atTopCorner = { ...atCenter, top: 20, bottom: 24 };
    const approaching = { ...atCenter, top: 6, bottom: 10 };

    expect(
      resolveHeroProfileRoundedRectWrapInset(
        atCenter,
        speechBubbleExclusion,
        16,
      ),
    ).toBe(140);
    expect(
      resolveHeroProfileRoundedRectWrapInset(
        atTopCorner,
        speechBubbleExclusion,
        16,
      ),
    ).toBeGreaterThanOrEqual(124);
    expect(
      resolveHeroProfileRoundedRectWrapInset(
        approaching,
        speechBubbleExclusion,
        16,
      ),
    ).toBeGreaterThan(0);
    expect(
      resolveHeroProfileRoundedRectWrapInset(
        { ...atCenter, top: -20, bottom: -10 },
        speechBubbleExclusion,
        16,
      ),
    ).toBe(0);
  });

  test("splits deterministic inline tokens without changing the copy", () => {
    const copy = "从军营到 AI Native";
    const segments = splitHeroProfileText(copy);

    expect(segments.join("")).toBe(copy);
    expect(segments).toEqual([
      "从",
      "军",
      "营",
      "到",
      " ",
      "AI",
      " ",
      "Native",
    ]);
  });

  test("groups mixed-script boxes by visual-line overlap instead of exact top", () => {
    const latin = {
      left: 100,
      right: 150,
      top: 103,
      bottom: 121,
      width: 50,
      height: 18,
    } as const;
    const han = {
      left: 150,
      right: 166,
      top: 100,
      bottom: 122,
      width: 16,
      height: 22,
    } as const;
    const nextLine = {
      left: 100,
      right: 116,
      top: 128,
      bottom: 150,
      width: 16,
      height: 22,
    } as const;

    expect(groupHeroProfileLineIndexes([latin, han, nextLine])).toEqual([
      [0, 1],
      [2],
    ]);
  });
});
