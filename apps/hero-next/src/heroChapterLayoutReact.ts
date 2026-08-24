import { useMemo, useSyncExternalStore, type CSSProperties } from "react";

import {
  readHeroChapterViewport,
  resolveHeroChapterLayout,
  type HeroChapterLayout,
} from "./heroChapterLayout";
import type { HeroViewport } from "./heroHoldTransition";

export type HeroChapterFrameStyle = CSSProperties & {
  readonly "--hero-frame-width": string;
  readonly "--hero-frame-height": string;
  readonly "--hero-frame-inset": string;
  readonly "--hero-small-font-size": string;
  readonly "--hero-small-line-height": string;
  readonly "--hero-header-letter-spacing": string;
  readonly "--hero-card-letter-spacing": string;
  readonly "--hero-heading-font-size": string;
  readonly "--hero-heading-line-height": string;
  readonly "--hero-heading-letter-spacing": string;
  readonly "--hero-heading-margin-top": string;
  readonly "--hero-heading-margin-bottom": string;
  readonly "--hero-summary-max-width": string;
  readonly "--hero-cards-top": string;
  readonly "--hero-card-gap": string;
  readonly "--hero-card-height": string;
  readonly "--hero-card-padding": string;
  readonly "--hero-card-border-width": string;
  readonly "--hero-card-label-gap": string;
};

const serverViewport: HeroViewport = { width: 1_440, height: 900 };
let viewportSnapshot: HeroViewport = serverViewport;
const viewportListeners = new Set<() => void>();
let listening = false;

export function useHeroChapterFrameStyle(): HeroChapterFrameStyle {
  const viewport = useSyncExternalStore(
    subscribeToViewport,
    readViewportSnapshot,
    readServerViewportSnapshot,
  );
  const layout = useMemo(
    () => resolveHeroChapterLayout(viewport),
    [viewport.height, viewport.width],
  );

  return useMemo(() => createHeroChapterFrameStyle(layout), [layout]);
}

export function createHeroChapterFrameStyle(
  layout: HeroChapterLayout,
): HeroChapterFrameStyle {
  return {
    "--hero-frame-width": pixels(layout.viewport.width),
    "--hero-frame-height": pixels(layout.viewport.height),
    "--hero-frame-inset": pixels(layout.inset),
    "--hero-small-font-size": pixels(layout.smallFontSize),
    "--hero-small-line-height": pixels(layout.smallLineHeight),
    "--hero-header-letter-spacing": pixels(layout.headerLetterSpacing),
    "--hero-card-letter-spacing": pixels(layout.cardLetterSpacing),
    "--hero-heading-font-size": pixels(layout.headingFontSize),
    "--hero-heading-line-height": pixels(layout.headingLineHeight),
    "--hero-heading-letter-spacing": pixels(layout.headingLetterSpacing),
    "--hero-heading-margin-top": pixels(layout.headingMarginTop),
    "--hero-heading-margin-bottom": pixels(layout.headingMarginBottom),
    "--hero-summary-max-width": pixels(layout.summaryMaxWidth),
    "--hero-cards-top": pixels(layout.cardsTop),
    "--hero-card-gap": pixels(layout.cardsGap),
    "--hero-card-height": pixels(layout.cardHeight),
    "--hero-card-padding": pixels(layout.cardPadding),
    "--hero-card-border-width": pixels(layout.cardBorderWidth),
    "--hero-card-label-gap": pixels(layout.cardLabelGap),
  } satisfies HeroChapterFrameStyle;
}

function subscribeToViewport(listener: () => void): () => void {
  viewportListeners.add(listener);
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("resize", publishViewport, { passive: true });
  }
  publishViewport();

  return () => {
    viewportListeners.delete(listener);
    if (listening && viewportListeners.size === 0) {
      window.removeEventListener("resize", publishViewport);
      listening = false;
    }
  };
}

function readViewportSnapshot(): HeroViewport {
  const next = readHeroChapterViewport();
  if (
    next.width !== viewportSnapshot.width ||
    next.height !== viewportSnapshot.height
  ) {
    viewportSnapshot = next;
  }
  return viewportSnapshot;
}

function readServerViewportSnapshot(): HeroViewport {
  return serverViewport;
}

function publishViewport(): void {
  viewportSnapshot = readHeroChapterViewport();
  for (const listener of viewportListeners) {
    listener();
  }
}

function pixels(value: number): string {
  return `${value}px`;
}
