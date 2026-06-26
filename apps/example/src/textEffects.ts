import { defineWebGLEffect } from "@project/dom-webgl-runtime";

import { clampNumber } from "./effectMath";
import { readTargetLocalPointer } from "./surfacePointer";

type TextWaveParams = {
  kind: "example.textWave";
  amplitude?: number;
};

type TextRevealParams = {
  kind: "example.textReveal";
  color?: string;
};

type TextSpotlightParams = {
  kind: "example.textSpotlight";
  color?: string;
  radius?: number;
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

export const exampleTextSpotlightEffect = defineWebGLEffect<TextSpotlightParams>({
  kind: "example.textSpotlight",
  source: "snapshot/text",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "snapshot/text") {
      return;
    }

    const pointer = readTargetLocalPointer({
      layout: ctx.layout,
      pointer: ctx.pointer,
    });
    const radius = clampNumber(params.radius, 48, 360, 180);
    const phase = 0.5 + Math.sin(ctx.time / 700) * 0.5;
    const fallbackX = ctx.layout.width * (0.2 + phase * 0.6);
    const fallbackY = ctx.layout.height * 0.5;
    const spotlightX = pointer.active ? pointer.x : fallbackX;
    const spotlightY = pointer.active ? pointer.y : fallbackY;
    const highlightColor = params.color ?? "#f6c453";

    ctx.source.textLayer?.setGlyphs((glyphs) =>
      glyphs.map((glyph) => {
        const centerX = glyph.x + glyph.width * 0.5;
        const centerY = glyph.y + glyph.height * 0.5;
        const distance = Math.hypot(centerX - spotlightX, centerY - spotlightY);
        const intensity = Math.max(0, 1 - distance / radius);
        const scale = 0.92 + intensity * 0.2;

        return {
          index: glyph.index,
          char: glyph.char,
          color: intensity > 0.28 ? highlightColor : "#1d2a2e",
          opacity: 0.28 + intensity * 0.72,
          scaleX: scale,
          scaleY: scale,
        };
      }),
    );
  },
});
