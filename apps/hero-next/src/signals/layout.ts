import type { HeroViewport } from "../shared/viewport";

/** Shared with the DOM's viewport-relative directory geometry. */
export function resolveSignalsLayout({ width, height }: HeroViewport) {
  return {
    inset: Math.max(24, width * 0.07),
    top: height * 0.21,
    rowHeight: height * 0.12,
    fontSize: Math.min(width * 0.105, height * 0.09, 108),
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
  const x =
    pointer.x + gap + size.width <= viewport.width - inset
      ? pointer.x + gap
      : pointer.x - gap - size.width;
  // Keep the card alongside its row so the pointer can enter it horizontally.
  const y = pointer.y - size.height / 2;
  return {
    x: Math.max(inset, Math.min(x, viewport.width - size.width - inset)),
    y: Math.max(inset, Math.min(y, viewport.height - size.height - inset)),
  };
}
