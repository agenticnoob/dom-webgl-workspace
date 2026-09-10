import type { HeroChapterBodyContent } from "../chapters/content";
import type { HeroLocale } from "../preferences/locale";
import type { HeroViewport } from "../shared/viewport";

export const signalsHoverQuery =
  "(min-width: 901px) and (hover: hover) and (pointer: fine)";

export function signalsHoverEnabled() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(signalsHoverQuery).matches
  );
}

/** Shared with the DOM's viewport-relative directory geometry. */
export function resolveSignalsLayout(
  { width, height }: HeroViewport,
  locale: HeroLocale = "zh",
) {
  return {
    inset: Math.max(24, width * 0.07),
    top: height * 0.21,
    rowHeight: height * 0.12,
    fontSize: Math.min(
      width * (locale === "en" ? 0.059 : 0.076),
      height * 0.11,
      128,
    ),
    captionSize: Math.min(16, Math.max(11, width * 0.018)),
  };
}

export function resolveSignalPreviewPosition(
  pointer: { readonly x: number; readonly y: number },
  viewport: HeroViewport,
  size: { readonly width: number; readonly height: number },
) {
  const gap = 24;
  const inset = 16;
  // Clamp continuously at the edges rather than flipping across the pointer.
  const x = pointer.x + gap;
  const y = pointer.y - size.height / 2;
  return {
    x: Math.max(inset, Math.min(x, viewport.width - size.width - inset)),
    y: Math.max(inset, Math.min(y, viewport.height - size.height - inset)),
  };
}

/** Mirrors the always-visible content layout on touch and narrow screens. */
export function resolveSignalsMobileLayout(
  viewport: HeroViewport,
  content: HeroChapterBodyContent,
) {
  const fontSize = Math.min(64, Math.max(40, viewport.width * 0.105));
  const imageWidth = Math.min(viewport.width * 0.64, 260);
  let top = viewport.height * 0.18;
  const rows = content.sections.map((item) => {
    const contentHeight = item.image
      ? (imageWidth * item.image.height) / item.image.width
      : 104;
    const height = 152 + fontSize * 1.1 + contentHeight;
    const row = {
      top,
      height,
      contentTop: top + 120 + fontSize * 1.1,
      contentHeight,
    };
    top += height;
    return row;
  });
  return {
    fontSize,
    imageWidth,
    rows,
    footerTop: top,
    height: top + viewport.height * 0.14,
  };
}
