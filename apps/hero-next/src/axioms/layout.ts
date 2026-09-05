import type { HeroViewport } from "../shared/viewport";
import { axiomsReaderConfig } from "./config";
import type { AxiomsPaperOptions } from "./model";

export type AxiomsRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type AxiomsLayout = {
  readonly viewport: HeroViewport;
  readonly header: AxiomsRect;
  readonly fan: AxiomsRect;
  readonly radius: number;
  readonly focusY: number;
  readonly paperArea: AxiomsRect;
  readonly papers: readonly AxiomsRect[];
  readonly paperOverflow: readonly number[];
  readonly padding: number;
  readonly titleSize: number;
  readonly bodySize: number;
  readonly labelSize: number;
  readonly fanSize: number;
};

export function resolveAxiomsLayout(
  viewport: HeroViewport,
  articles: readonly AxiomsPaperOptions[],
  contentTop = 0,
): AxiomsLayout {
  const { width: w, height: h } = viewport;
  const compact = w <= axiomsReaderConfig.compactBreakpoint;
  const inset = compact ? 16 : Math.max(32, w * 0.045);
  const top = Math.max(contentTop, h * (compact ? 0.29 : 0.26));
  const paperArea = {
    x: w * (compact ? 0.355 : 0.43),
    y: top,
    width: w * (compact ? 0.645 : 0.57) - inset,
    height: h - top - Math.max(28, h * 0.065),
  };
  return {
    viewport,
    header: {
      x: inset,
      y: Math.max(34, h * 0.065),
      width: w - inset * 2,
      height: top - Math.max(34, h * 0.065) - 16,
    },
    fan: {
      x: w * (compact ? 0.012 : 0.065),
      y: 0,
      width: w * (compact ? 0.32 : 0.265),
      height: compact ? 86 : Math.min(112, h * 0.14),
    },
    radius: compact ? h * 0.44 : Math.max(w * 0.4, h * 0.55),
    focusY: top + paperArea.height * 0.48,
    paperArea,
    papers: articles.map((article, i) => {
      const size =
        article.paper ??
        axiomsReaderConfig.paperSizes[i % axiomsReaderConfig.paperSizes.length];
      const { width, height } = size;
      if (!(width > 0 && width <= 1 && height > 0 && height <= 1)) {
        throw new Error(
          "Axioms paper dimensions must be fractions greater than zero and at most one.",
        );
      }
      return {
        x: paperArea.x + (1 - width) * paperArea.width * 0.4,
        y: top,
        width: paperArea.width * width,
        height: paperArea.height * height,
      };
    }),
    padding: compact ? 15 : Math.min(44, w * 0.03),
    paperOverflow: articles.map(() => 0),
    titleSize: compact ? 20 : Math.min(46, w * 0.034),
    bodySize: compact ? 14 : Math.min(21, w * 0.015),
    labelSize: compact ? 10 : 12,
    fanSize: compact ? Math.min(13, w * 0.0347) : Math.min(26, w * 0.019),
  };
}
