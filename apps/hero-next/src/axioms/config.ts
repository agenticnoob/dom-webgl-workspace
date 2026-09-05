import type { AxiomsPaperSize } from "./model";

// Presentation choices, independent of article count and localized copy.
export const axiomsReaderConfig = {
  compactBreakpoint: 700,
  scroll: { viewportHeightsPerArticle: 0.9 },
  fan: {
    angleStep: 0.34,
    inactiveScale: 0.88,
    clipInset: 16,
    maxAngle: Math.PI / 2,
  },
  stack: {
    verticalAlignment: 0.34,
    entryMargin: 0.08,
    entryDrop: 0.22,
    arcLift: 0.18,
    controlPosition: 0.45,
    tilt: 0.1,
  },
  texture: { maxDimension: 4096, pixelRatio: 2, gutter: 2 },
  stamp: { pitch: 18, radius: 5, referenceWidth: 420, minimumScale: 0.55 },
  paperSizes: [
    { width: 0.96, height: 0.8 },
    { width: 1, height: 0.7 },
    { width: 0.88, height: 0.88 },
    { width: 0.97, height: 0.78 },
  ] satisfies readonly AxiomsPaperSize[],
} as const;

export function resolveAxiomsScrollHeight(articleCount: number): number {
  return (
    100 *
    (1 + articleCount * axiomsReaderConfig.scroll.viewportHeightsPerArticle)
  );
}
