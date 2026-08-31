import { describe, expect, test } from "vitest";

import {
  resolveHeroChapterAtlasResolution,
  resolveHeroChapterLayout,
} from "../src/chapters/layout";
import { createHeroChapterFrameStyle } from "../src/chapters/useChapterFrameStyle";

describe("hero chapter shared layout", () => {
  test("derives desktop atlas and DOM anchors from one viewport model", () => {
    const layout = resolveHeroChapterLayout({ width: 1280, height: 720 });
    const style = createHeroChapterFrameStyle(layout);

    expect(layout.mobile).toBe(false);
    expect(layout.inset).toBeCloseTo(39.6, 12);
    expect(layout.smallFontSize).toBeCloseTo(17.92, 12);
    expect(layout.smallLineHeight).toBeCloseTo(26.88, 12);
    expect(layout.headingFontSize).toBeCloseTo(82.8, 12);
    expect(layout.headingLineHeight).toBeCloseTo(74.52, 12);
    expect(layout.headingMarginTop).toBeCloseTo(72, 12);
    expect(layout.headingMarginBottom).toBeCloseTo(28.8, 12);
    expect(layout.cardsTop).toBeCloseTo(439.2, 12);
    expect(layout.cardsGap).toBeCloseTo(23.04, 12);
    expect(layout.cardHeight).toBeCloseTo(158.4, 12);
    expect(layout.cardPadding).toBeCloseTo(25.6, 12);
    expect(style).toMatchObject({
      "--hero-frame-width": "1280px",
      "--hero-frame-height": "720px",
      "--hero-heading-margin-top": "72px",
      "--hero-cards-top": "439.2px",
      "--hero-card-padding": "25.6px",
    });
  });

  test("derives the mobile single-column composition without pixel offsets", () => {
    const layout = resolveHeroChapterLayout({ width: 390, height: 844 });

    expect(layout.mobile).toBe(true);
    expect(layout.inset).toBe(22);
    expect(layout.smallFontSize).toBe(16);
    expect(layout.headingMarginTop).toBeCloseTo(101.28, 12);
    expect(layout.headingLetterSpacing).toBeCloseTo(-2.38875, 12);
    expect(layout.cardsTop).toBeCloseTo(455.76, 12);
    expect(layout.cardWidth).toBe(346);
    expect(layout.cardHeight).toBeCloseTo(109.72, 12);
    expect(layout.cardPadding).toBe(16);
    expect(layout.cardBorderWidth).toBe(2);
    expect(layout.cardLabelGap).toBe(12);
    const compactLayout = resolveHeroChapterLayout({ width: 320, height: 568 });
    const cardsBottom =
      compactLayout.cardsTop +
      compactLayout.cardHeight * 2 +
      compactLayout.cardsGap;

    expect(compactLayout.cardHeight).toBe(92);
    expect(cardsBottom).toBeLessThanOrEqual(
      compactLayout.viewport.height - compactLayout.inset,
    );
  });

  test("caps only atlas backing pixels while retaining logical viewport coordinates", () => {
    const layout = resolveHeroChapterLayout({ width: 2400, height: 1800 });
    const resolution = resolveHeroChapterAtlasResolution({
      width: 2400,
      height: 1800,
    });

    expect(layout.viewport).toEqual({ width: 2400, height: 1800 });
    expect(resolution).toEqual({ tileWidth: 1600, tileHeight: 1200 });
  });
});
