import { describe, expect, test } from "vitest";

import {
  resolveHeroChapterAtlasResolution,
  resolveHeroChapterLayout,
} from "../src/chapters/layout";

describe("hero chapter shared layout", () => {
  test("matches the desktop profile lead at the DOM handoff", () => {
    const layout = resolveHeroChapterLayout(
      { width: 1867, height: 750 },
      "self",
    );

    expect(layout.kind).toBe("profile");
    if (layout.kind !== "profile") {
      throw new Error("Expected the self chapter to use the profile layout.");
    }
    expect(layout.index.left).toBeCloseTo(517.5, 12);
    expect(layout.index.top).toBeCloseTo(105, 12);
    expect(layout.index.width).toBe(400);
    expect(layout.index.fontSize).toBe(12);
    expect(layout.index.lineHeight).toBeCloseTo(16.8, 12);
    expect(layout.index.align).toBe("right");
    expect(layout.heading.right).toBe(917.5);
    expect(layout.heading.top).toBe(196.8);
    expect(layout.heading.fontSize).toBe(96);
    expect(layout.heading.lineHeight).toBe(92.16);
    expect(layout.heading.balance).toBe(true);
    expect(layout.intro).toMatchObject({
      left: 949.5,
      width: 384,
      fontSize: 21.6,
      lineHeight: 35.64,
      align: "left",
    });
    expect(layout.wrap).toEqual({
      bounds: { left: 24, right: 1843 },
      exclusions: [
        {
          kind: "ellipse",
          rect: {
            left: 757.5,
            right: 1109.5,
            top: 127.5,
            bottom: 622.5,
            width: 352,
            height: 495,
          },
        },
        {
          kind: "rounded-rectangle",
          rect: {
            left: 789.5,
            right: 1077.5,
            top: 67.5,
            bottom: 135.5,
            width: 288,
            height: 68,
          },
          radius: 16,
        },
      ],
      gap: 16,
    });
    expect(layout.speechBubble).toEqual({
      rect: {
        left: 789.5,
        right: 1077.5,
        top: 67.5,
        bottom: 151.5,
        width: 288,
        height: 84,
      },
      tailHeight: 16,
      cornerRadius: 16,
      fontSize: 18,
      lineHeight: 24,
    });
  });

  test("matches the compact mobile profile columns and exclusion", () => {
    const layout = resolveHeroChapterLayout(
      { width: 390, height: 844 },
      "self",
    );

    expect(layout.kind).toBe("profile");
    if (layout.kind !== "profile") {
      throw new Error("Expected the self chapter to use the profile layout.");
    }
    expect(layout.index.left).toBeCloseTo(97.5, 12);
    expect(layout.index.width).toBeCloseTo(97.5, 12);
    expect(layout.heading.right).toBeCloseTo(195, 12);
    expect(layout.heading.top).toBeCloseTo(194.04, 12);
    expect(layout.heading.fontSize).toBeCloseTo(37.05, 12);
    expect(layout.intro.left).toBeCloseTo(195, 12);
    expect(layout.intro.width).toBeCloseTo(97.5, 12);
    expect(layout.wrap.bounds).toEqual({ left: 2, right: 388 });
    expect(layout.wrap.gap).toBe(2);
    expect(layout.wrap.exclusions[0]?.rect.width).toBeCloseTo(164.2, 12);
    expect(layout.wrap.exclusions[1]).toEqual({
      kind: "rounded-rectangle",
      rect: {
        ...layout.speechBubble.rect,
        bottom:
          layout.speechBubble.rect.bottom - layout.speechBubble.tailHeight,
        height:
          layout.speechBubble.rect.height - layout.speechBubble.tailHeight,
      },
      radius: 14,
    });
    expect(layout.speechBubble.rect.width).toBeCloseTo(179.4, 12);
    expect(layout.speechBubble.tailHeight).toBe(14);
    expect(layout.speechBubble.cornerRadius).toBe(14);
  });

  test("matches the standard chapter body lead instead of an old frame", () => {
    const layout = resolveHeroChapterLayout(
      { width: 1280, height: 720 },
      "axioms",
    );

    expect(layout.kind).toBe("standard");
    expect(layout.index.left).toBeCloseTo(89.6, 12);
    expect(layout.index.top).toBeCloseTo(129.6, 12);
    expect(layout.index.fontSize).toBe(16);
    expect(layout.index.align).toBe("left");
    expect(layout.heading.left).toBeCloseTo(89.6, 12);
    expect(layout.heading.top).toBeCloseTo(206.4, 12);
    expect(layout.intro.align).toBe("left");
    expect(layout.intro.left).toBeCloseTo(486.4, 12);
  });

  test("caps only atlas backing pixels while retaining logical viewport coordinates", () => {
    const layout = resolveHeroChapterLayout(
      { width: 2400, height: 1800 },
      "self",
    );
    const resolution = resolveHeroChapterAtlasResolution({
      width: 2400,
      height: 1800,
    });

    expect(layout.viewport).toEqual({ width: 2400, height: 1800 });
    expect(resolution).toEqual({ tileWidth: 1024, tileHeight: 768 });
  });
});
