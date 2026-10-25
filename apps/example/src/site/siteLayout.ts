import type { WebGLSectionProgressRange } from "@viselora/dom-webgl/react";

export const siteProgressKey = "site";
export const siteChapters = [
  "hero",
  "layers",
  "glyphs",
  "glass",
  "budget",
  "catalog",
  "install",
] as const;
export type SiteChapter = (typeof siteChapters)[number];

export type SiteBlock = { readonly top: number; readonly height: number };

export type SiteLayout = {
  /** Page progress at which each chapter reaches the middle of the viewport. */
  readonly starts: readonly number[];
  /** The hero title comes into register over this range. */
  readonly register: WebGLSectionProgressRange;
  /** The layer stack separates and closes while its block is pinned. */
  readonly layers: WebGLSectionProgressRange;
  readonly glyphs: WebGLSectionProgressRange;
  readonly ink: WebGLSectionProgressRange;
};

const range = (from: number, to: number): WebGLSectionProgressRange => ({
  key: siteProgressKey,
  from,
  to: Math.max(from + 1e-4, to),
});

export const initialSiteLayout: SiteLayout = {
  starts: [0, 0.12, 0.3, 0.5, 0.65, 0.78, 0.92],
  register: range(0, 0.06),
  layers: range(0.1, 0.28),
  glyphs: range(0.28, 0.48),
  ink: range(0.45, 0.65),
};

/** Ranges come from where the chapter blocks are, measured after layout. */
export function measureSiteLayout(
  blocks: Readonly<Record<SiteChapter, SiteBlock>>,
  scrollHeight: number,
  viewportHeight: number,
): SiteLayout {
  const scrollable = Math.max(1, scrollHeight - viewportHeight);
  const at = (offset: number) => Math.min(1, Math.max(0, offset / scrollable));
  const { hero, layers, glyphs, glass } = blocks;
  return {
    starts: siteChapters.map((name, index) =>
      index === 0 ? 0 : at(blocks[name].top - viewportHeight / 2),
    ),
    // In register once the hero has scrolled 45% of its height.
    register: range(0, at(hero.top + hero.height * 0.45)),
    // The pinned stretch: from the block's top to its bottom leaving the viewport.
    layers: range(at(layers.top), at(layers.top + layers.height - viewportHeight)),
    glyphs: range(
      at(glyphs.top - viewportHeight * 0.85),
      at(glyphs.top + glyphs.height - viewportHeight * 0.75),
    ),
    ink: range(at(glass.top - viewportHeight), at(glass.top + glass.height)),
  };
}
