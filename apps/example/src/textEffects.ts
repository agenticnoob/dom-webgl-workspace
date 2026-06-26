import { defineWebGLEffect } from "@project/dom-webgl-runtime";

import { clampNumber } from "./effectMath";

type TextWaveParams = {
  kind: "example.textWave";
  amplitude?: number;
};

type TextRevealParams = {
  kind: "example.textReveal";
  color?: string;
};

export const exampleTextWaveEffect = defineWebGLEffect<TextWaveParams>({
  kind: "example.textWave",
  source: "snapshot/text",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "snapshot/text") {
      return;
    }

    const amplitude = clampNumber(params.amplitude, 0, 24, 6);
    const phase = ctx.time / 450;
    ctx.source.textLayer?.setGlyphs((glyphs) =>
      glyphs.map((glyph) => ({
        index: glyph.index,
        char: glyph.char,
        y: glyph.y + Math.sin(phase + glyph.index * 0.42) * amplitude,
        color: "#1d2a2e",
      })),
    );
  },
});

export const exampleTextRevealEffect = defineWebGLEffect<TextRevealParams>({
  kind: "example.textReveal",
  source: "snapshot/text",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "snapshot/text") {
      return;
    }

    const progress = clampNumber(ctx.scrollProgress, 0, 1, 0);
    const color = params.color ?? "#f6c453";

    ctx.source.textLayer?.setGlyphs((glyphs) => {
      const visibleCount = Math.ceil(glyphs.length * progress);

      return glyphs.map((glyph) => ({
        index: glyph.index,
        char: glyph.char,
        opacity: glyph.index < visibleCount ? 1 : 0.18,
        scaleX: glyph.index < visibleCount ? 1 : 0.82,
        scaleY: glyph.index < visibleCount ? 1 : 0.82,
        color,
      }));
    });
  },
});
