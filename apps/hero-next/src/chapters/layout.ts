import type { HeroViewport } from "../shared/viewport";
import { heroTransitionConfig } from "../transition/transitionConfig";
import type {
  HeroProfileHorizontalBounds,
  HeroProfileWrapExclusion,
  HeroProfileWrapRect,
} from "../profile/wrap";
import type { HeroChapterId } from "./definitions";

const rootFontSize = 16;
const atlasMaxTileWidth = 1_024;
const atlasMaxTileHeight = 1_024;
const arialChWidthRatio = 0.55615234375;

export type HeroChapterTextLayout = {
  readonly left: number;
  readonly right: number;
  readonly width: number;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly letterSpacing: number;
  readonly fontWeight: 400 | 700;
  readonly align: "left" | "right";
  readonly balance: boolean;
};

export type HeroChapterPositionedTextLayout = HeroChapterTextLayout & {
  readonly top: number;
};

export type HeroProfileSpeechBubbleLayout = {
  readonly rect: HeroProfileWrapRect;
  readonly tailHeight: number;
  readonly cornerRadius: number;
  readonly fontSize: number;
  readonly lineHeight: number;
};

type HeroChapterBaseLayout = {
  readonly viewport: HeroViewport;
  readonly index: HeroChapterPositionedTextLayout;
  readonly heading: HeroChapterPositionedTextLayout;
  readonly intro: HeroChapterTextLayout;
};

export type HeroChapterLayout =
  | (HeroChapterBaseLayout & {
      readonly kind: "profile";
      readonly wrap: {
        readonly bounds: HeroProfileHorizontalBounds;
        readonly exclusions: readonly HeroProfileWrapExclusion[];
        readonly gap: number;
      };
      readonly speechBubble: HeroProfileSpeechBubbleLayout;
    })
  | (HeroChapterBaseLayout & {
      readonly kind: "standard";
      readonly introGap: number;
    });

export type HeroChapterAtlasResolution = {
  readonly tileWidth: number;
  readonly tileHeight: number;
};

export function resolveHeroChapterLayout(
  viewport: HeroViewport,
  chapterId: HeroChapterId = "self",
): HeroChapterLayout {
  const width = positive(viewport.width, 1_440);
  const height = positive(viewport.height, 900);
  const normalizedViewport = { width, height } as const;
  const mobile = width <= heroTransitionConfig.motion.mobileBreakpoint;
  return chapterId === "self"
    ? resolveProfileLayout(normalizedViewport, mobile)
    : resolveStandardLayout(normalizedViewport, mobile);
}

export function resolveHeroChapterAtlasResolution(
  viewport: HeroViewport,
): HeroChapterAtlasResolution {
  const width = positive(viewport.width, 1_440);
  const height = positive(viewport.height, 900);
  const scale = Math.min(
    1,
    atlasMaxTileWidth / width,
    atlasMaxTileHeight / height,
  );

  return {
    tileWidth: Math.max(1, Math.round(width * scale)),
    tileHeight: Math.max(1, Math.round(height * scale)),
  };
}

function resolveProfileLayout(
  viewport: HeroViewport,
  mobile: boolean,
): Extract<HeroChapterLayout, { readonly kind: "profile" }> {
  const { width, height } = viewport;
  const pageInset = mobile ? rootFontSize : Math.max(24, width * 0.06);
  const flowWidth = Math.min(60 * rootFontSize, width - pageInset * 2);
  const flowLeft = (width - flowWidth) / 2;
  const columnWidth = mobile
    ? clamp(width * 0.25, 5.5 * rootFontSize, 9 * rootFontSize)
    : clamp(width * 0.28, 16 * rootFontSize, 25 * rootFontSize);
  const columnGap = mobile
    ? 0
    : clamp(width * 0.025, rootFontSize, 2 * rootFontSize);
  const gridWidth = columnWidth * 2 + columnGap;
  const gridLeft = flowLeft + (flowWidth - gridWidth) / 2;
  const indexFontSize = 0.75 * rootFontSize;
  const indexLineHeight = indexFontSize * 1.4;
  const indexTop = height * (mobile ? 0.12 : 0.14);
  const headingFontSize = mobile
    ? clamp(width * 0.095, 2 * rootFontSize, 3 * rootFontSize)
    : clamp(width * 0.057, 2.75 * rootFontSize, 6 * rootFontSize);
  const headingWidth = Math.min(
    columnWidth,
    headingFontSize * arialChWidthRatio * 7,
  );
  const headingRight = gridLeft + columnWidth;
  const introFontSize = mobile
    ? clamp(width * 0.035, 0.82 * rootFontSize, rootFontSize)
    : clamp(width * 0.0155, rootFontSize, 1.35 * rootFontSize);
  const exclusionWidth = mobile
    ? clamp(width * 0.38 + rootFontSize, 9.5 * rootFontSize, 13 * rootFontSize)
    : clamp(width * 0.26, 17 * rootFontSize, 22 * rootFontSize);
  const exclusionHeight = mobile
    ? clamp(height * 0.48, 23 * rootFontSize, 29 * rootFontSize)
    : clamp(height * 0.66, 28 * rootFontSize, 36 * rootFontSize);
  const modelExclusion = centeredRect(
    width,
    height,
    exclusionWidth,
    exclusionHeight,
  );
  const speechBubbleWidth = mobile
    ? clamp(width * 0.46, 11 * rootFontSize, 13 * rootFontSize)
    : clamp(width * 0.18, 14 * rootFontSize, 18 * rootFontSize);
  const speechBubbleHeight = mobile
    ? clamp(height * 0.11, 4.75 * rootFontSize, 5.5 * rootFontSize)
    : clamp(height * 0.112, 4.5 * rootFontSize, 5.25 * rootFontSize);
  const speechBubbleOverlap = mobile ? 28 : 24;
  const speechBubbleTailHeight = mobile ? 14 : 16;
  const speechBubbleCornerRadius = mobile ? 14 : 16;
  const speechBubbleRect = rectFromBottomCenter(
    width,
    modelExclusion.top + speechBubbleOverlap,
    speechBubbleWidth,
    speechBubbleHeight,
  );
  const speechBubbleBalloonRect = {
    ...speechBubbleRect,
    bottom: speechBubbleRect.bottom - speechBubbleTailHeight,
    height: speechBubbleRect.height - speechBubbleTailHeight,
  } satisfies HeroProfileWrapRect;

  return {
    kind: "profile",
    viewport,
    index: createTextLayout({
      left: gridLeft,
      top: indexTop,
      width: columnWidth,
      fontSize: indexFontSize,
      lineHeight: indexLineHeight,
      letterSpacing: indexFontSize * 0.16,
      fontWeight: 400,
      align: "right",
    }),
    heading: createTextLayout({
      left: headingRight - headingWidth,
      top: indexTop + indexLineHeight + height * (mobile ? 0.09 : 0.1),
      width: headingWidth,
      fontSize: headingFontSize,
      lineHeight: headingFontSize * 0.96,
      letterSpacing: headingFontSize * (mobile ? -0.04 : -0.055),
      fontWeight: 700,
      align: "right",
      balance: true,
    }),
    intro: createTextLayout({
      left: gridLeft + columnWidth + columnGap,
      width: Math.min(columnWidth, 24 * rootFontSize),
      fontSize: introFontSize,
      lineHeight: introFontSize * (mobile ? 1.55 : 1.65),
      letterSpacing: 0,
      fontWeight: 400,
      align: "left",
    }),
    wrap: {
      bounds: {
        left: mobile ? 2 : 24,
        right: width - (mobile ? 2 : 24),
      },
      exclusions: [
        { kind: "ellipse", rect: modelExclusion },
        {
          kind: "rounded-rectangle",
          rect: speechBubbleBalloonRect,
          radius: speechBubbleCornerRadius,
        },
      ],
      gap: mobile ? 2 : 16,
    },
    speechBubble: {
      rect: speechBubbleRect,
      tailHeight: speechBubbleTailHeight,
      cornerRadius: speechBubbleCornerRadius,
      fontSize: mobile ? 14 : 18,
      lineHeight: mobile ? 20 : 24,
    },
  };
}

function resolveStandardLayout(
  viewport: HeroViewport,
  mobile: boolean,
): Extract<HeroChapterLayout, { readonly kind: "standard" }> {
  const { width, height } = viewport;
  const inset = Math.max(24, width * 0.07);
  const availableWidth = width - inset * 2;
  const indexFontSize = rootFontSize;
  const indexLineHeight = indexFontSize * 1.2;
  const indexTop = height * (mobile ? 0.14 : 0.18);
  const headingFontSize = clamp(
    width * 0.08,
    3 * rootFontSize,
    8 * rootFontSize,
  );
  const headingWidth = Math.min(
    availableWidth,
    headingFontSize * arialChWidthRatio * 11,
  );
  const introWidth = Math.min(44 * rootFontSize, availableWidth);
  const introLeft = mobile ? inset : width - inset - introWidth;
  const introFontSize = clamp(
    width * 0.0225,
    1.2 * rootFontSize,
    2.2 * rootFontSize,
  );

  return {
    kind: "standard",
    viewport,
    index: createTextLayout({
      left: inset,
      top: indexTop,
      width: availableWidth,
      fontSize: indexFontSize,
      lineHeight: indexLineHeight,
      letterSpacing: indexFontSize * 0.15,
      fontWeight: 400,
      align: "left",
    }),
    heading: createTextLayout({
      left: inset,
      top: indexTop + indexLineHeight + height * 0.08,
      width: headingWidth,
      fontSize: headingFontSize,
      lineHeight: headingFontSize * 0.95,
      letterSpacing: headingFontSize * (mobile ? -0.035 : -0.055),
      fontWeight: 700,
      align: "left",
      balance: mobile,
    }),
    intro: createTextLayout({
      left: introLeft,
      width: introWidth,
      fontSize: introFontSize,
      lineHeight: introFontSize * 1.35,
      letterSpacing: 0,
      fontWeight: 400,
      align: "left",
    }),
    introGap: height * 0.08,
  };
}

function createTextLayout(
  input: Omit<HeroChapterPositionedTextLayout, "right" | "balance"> & {
    readonly balance?: boolean;
  },
): HeroChapterPositionedTextLayout;
function createTextLayout(
  input: Omit<HeroChapterTextLayout, "right" | "balance"> & {
    readonly balance?: boolean;
  },
): HeroChapterTextLayout;
function createTextLayout(
  input: Omit<HeroChapterTextLayout, "right" | "balance"> & {
    readonly top?: number;
    readonly balance?: boolean;
  },
): HeroChapterTextLayout | HeroChapterPositionedTextLayout {
  return {
    ...input,
    right: input.left + input.width,
    balance: input.balance ?? false,
  };
}

function centeredRect(
  viewportWidth: number,
  viewportHeight: number,
  width: number,
  height: number,
): HeroProfileWrapRect {
  const left = (viewportWidth - width) / 2;
  const top = (viewportHeight - height) / 2;
  return {
    left,
    right: left + width,
    top,
    bottom: top + height,
    width,
    height,
  };
}

function rectFromBottomCenter(
  viewportWidth: number,
  bottom: number,
  width: number,
  height: number,
): HeroProfileWrapRect {
  const left = (viewportWidth - width) / 2;
  const top = bottom - height;
  return {
    left,
    right: left + width,
    top,
    bottom,
    width,
    height,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
