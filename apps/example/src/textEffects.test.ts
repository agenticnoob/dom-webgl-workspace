import { describe, expect, test, vi } from "vitest";

import { createEffectContext, createGlyph } from "../test/effectContext";
import {
  exampleTextRevealEffect,
  exampleTextSpotlightEffect,
  exampleTextWaveEffect,
} from "./textEffects";

describe("text example effects", () => {
  test("text wave rewrites glyph commands using elapsed runtime time", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "dom",
        type: "text",
        element: document.createElement("p"),
        text: "Wave",
        textLayer,
      },
      time: 1000,
    });

    exampleTextWaveEffect.update(context, undefined, {
      kind: "example.textWave",
      amplitude: 8,
    });

    expect(exampleTextWaveEffect.source).toBe("dom/text");
    expect(textLayer.setGlyphs).toHaveBeenCalledTimes(1);
    const transform = textLayer.setGlyphs.mock.calls[0]?.[0];
    const commands = transform?.([
      createGlyph(0, "W"),
      createGlyph(1, "a"),
    ]);
    expect(commands?.[0]).toMatchObject({ index: 0, char: "W" });
    expect(commands?.[0]?.y).not.toBe(0);
  });

  test("text reveal maps scroll progress to glyph opacity and scale", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "dom",
        type: "text",
        element: document.createElement("p"),
        text: "Reveal",
        textLayer,
      },
      layout: { top: 354, height: 60, viewport: { width: 1024, height: 768 } },
      scrollProgress: 0.5,
    });

    exampleTextRevealEffect.update(context, undefined, {
      kind: "example.textReveal",
      color: "#d95f42",
    });

    expect(exampleTextRevealEffect.source).toBe("dom/text");
    const transform = textLayer.setGlyphs.mock.calls[0]?.[0];
    const commands = transform?.([
      createGlyph(0, "R"),
      createGlyph(1, "e"),
      createGlyph(2, "v"),
      createGlyph(3, "e"),
    ]);
    expect(commands?.[0]).toMatchObject({ index: 0, opacity: 1, color: "#d95f42" });
    expect(commands?.[3]).toMatchObject({ index: 3, opacity: 0.18, scaleX: 0.82 });
  });

  test("text reveal uses target viewport position when global scroll progress is still low", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "dom",
        type: "text",
        element: document.createElement("p"),
        text: "Reveal",
        textLayer,
      },
      layout: { top: 120, height: 240, viewport: { width: 1024, height: 768 } },
      scrollProgress: 0,
    });

    exampleTextRevealEffect.update(context, undefined, {
      kind: "example.textReveal",
      color: "#d95f42",
    });

    const transform = textLayer.setGlyphs.mock.calls[0]?.[0];
    const commands = transform?.([
      createGlyph(0, "R"),
      createGlyph(1, "e"),
      createGlyph(2, "v"),
      createGlyph(3, "e"),
    ]);

    expect(commands?.[0]).toMatchObject({ index: 0, opacity: 1 });
    expect(commands?.[1]).toMatchObject({ index: 1, opacity: 1 });
  });

  test("text spotlight highlights glyphs near the local pointer", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "dom",
        type: "text",
        element: document.createElement("p"),
        text: "Spotlight",
        textLayer,
      },
      layout: { left: 20, top: 10, width: 320, height: 160 },
      pointer: { x: 68, y: 48, isInside: true },
    });

    exampleTextSpotlightEffect.update(context, undefined, {
      kind: "example.textSpotlight",
      color: "#f6c453",
      radius: 80,
    });

    expect(exampleTextSpotlightEffect.source).toBe("dom/text");
    expect(textLayer.setGlyphs).toHaveBeenCalledTimes(1);
    const transform = textLayer.setGlyphs.mock.calls[0]?.[0];
    const nearGlyph = { ...createGlyph(0, "近"), x: 40, y: 30 };
    const farGlyph = { ...createGlyph(1, "远"), x: 240, y: 30 };
    const commands = transform?.([nearGlyph, farGlyph]);

    expect(commands?.[0]).toMatchObject({
      index: 0,
      char: "近",
      color: "#f6c453",
      opacity: expect.any(Number),
      scaleX: expect.any(Number),
      scaleY: expect.any(Number),
    });
    expect(commands?.[1]).toMatchObject({
      index: 1,
      char: "远",
      color: "#1d2a2e",
      opacity: 0.28,
    });
  });
});
