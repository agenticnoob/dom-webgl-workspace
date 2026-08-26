import type { HeroViewport } from "../shared/viewport";
import { heroTransitionConfig } from "../transition/transitionConfig";

const rootFontSize = 16;
const atlasMaxTileWidth = 1_600;
const atlasMaxTileHeight = 1_200;

export type HeroChapterLayout = {
  readonly viewport: HeroViewport;
  readonly mobile: boolean;
  readonly inset: number;
  readonly smallFontSize: number;
  readonly smallLineHeight: number;
  readonly headerLetterSpacing: number;
  readonly cardLetterSpacing: number;
  readonly headingFontSize: number;
  readonly headingLineHeight: number;
  readonly headingLetterSpacing: number;
  readonly headingMarginTop: number;
  readonly headingMarginBottom: number;
  readonly summaryMaxWidth: number;
  readonly cardsTop: number;
  readonly cardsGap: number;
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly cardPadding: number;
  readonly cardBorderWidth: number;
  readonly cardLabelGap: number;
};

export type HeroChapterAtlasResolution = {
  readonly tileWidth: number;
  readonly tileHeight: number;
};

export function resolveHeroChapterLayout(
  viewport: HeroViewport,
): HeroChapterLayout {
  const width = positive(viewport.width, 1_440);
  const height = positive(viewport.height, 900);
  const normalizedViewport = { width, height } as const;
  const vmin = Math.min(width, height) / 100;
  const vw = width / 100;
  const vh = height / 100;
  const mobile = width <= heroTransitionConfig.motion.mobileBreakpoint;
  const inset = Math.max(22, 5.5 * vmin);
  const smallFontSize = mobile
    ? clamp(3.4 * vw, 0.875 * rootFontSize, rootFontSize)
    : clamp(1.2 * vw, 0.78 * rootFontSize, rootFontSize);
  const cardsGap = Math.max(10, 1.8 * vw);
  const headingFontSize = mobile
    ? clamp(16 * vw, 3.2 * rootFontSize, 5.5 * rootFontSize)
    : clamp(10.5 * vmin, 3.2 * rootFontSize, 9 * rootFontSize);
  const cardWidth = mobile
    ? width - inset * 2
    : (width - inset * 2 - cardsGap) / 2;

  return {
    viewport: normalizedViewport,
    mobile,
    inset,
    smallFontSize,
    smallLineHeight: smallFontSize * 1.5,
    headerLetterSpacing: smallFontSize * 0.12,
    cardLetterSpacing: smallFontSize * 0.08,
    headingFontSize,
    headingLineHeight: headingFontSize * 0.9,
    headingLetterSpacing: headingFontSize * (mobile ? -0.035 : -0.06),
    headingMarginTop: (mobile ? 12 : 10) * vh,
    headingMarginBottom: 4 * vh,
    summaryMaxWidth: Math.min(42 * rootFontSize, width - inset * 2),
    cardsTop: height * (mobile ? 0.54 : 0.61),
    cardsGap,
    cardWidth,
    cardHeight: Math.max(mobile ? 92 : 56, height * (mobile ? 0.13 : 0.22)),
    cardPadding: clamp(2 * vw, rootFontSize, 2 * rootFontSize),
    cardBorderWidth: Math.max(2, 0.35 * vmin),
    cardLabelGap: mobile ? 0.75 * rootFontSize : rootFontSize,
  };
}

export function resolveHeroChapterAtlasResolution(
  viewport: HeroViewport,
): HeroChapterAtlasResolution {
  const layout = resolveHeroChapterLayout(viewport);
  const scale = Math.min(
    1,
    atlasMaxTileWidth / layout.viewport.width,
    atlasMaxTileHeight / layout.viewport.height,
  );

  return {
    tileWidth: Math.max(1, Math.round(layout.viewport.width * scale)),
    tileHeight: Math.max(1, Math.round(layout.viewport.height * scale)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
