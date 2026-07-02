import { defineWebGLEffect } from "@project/dom-webgl-runtime";

import { clampNumber } from "./effectMath";

type PinnedRevealParams = {
  kind: "example.pinnedReveal";
  progressKey: string;
  color?: string;
};

export const examplePinnedRevealEffect = defineWebGLEffect<PinnedRevealParams>({
  kind: "example.pinnedReveal",
  source: "dom/text",
  update(ctx, _state, params) {
    const text = ctx.object.text;
    if (!text) {
      return;
    }

    const progress = clampNumber(ctx.progress.get(params.progressKey), 0, 1, 0);
    const color = params.color ?? "#172124";

    text.setGlyphs((glyphs) => {
      const visibleCount = Math.ceil(glyphs.length * progress);

      return glyphs.map((glyph) => ({
        index: glyph.index,
        char: glyph.char,
        opacity: glyph.index < visibleCount ? 1 : 0.32,
        scaleX: glyph.index < visibleCount ? 1 : 0.78,
        scaleY: glyph.index < visibleCount ? 1 : 0.78,
        color,
      }));
    });
  },
});
