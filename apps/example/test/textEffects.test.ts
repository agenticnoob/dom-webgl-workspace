import { describe, expect, test, vi } from "vitest";

import type { WebGLTextGlyphRenderCommand } from "@project/dom-webgl-runtime";

import { createEffectContext, createGlyph } from "./effectContext";
import {
  exampleTextPressureEffect,
  exampleTextRevealEffect,
  exampleTextScrambleEffect,
  exampleTextSpotlightPressureScrambleWaveEffect,
  exampleTextSpotlightEffect,
  exampleTextWaveEffect,
} from "../src/textEffects";

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

  test("text pressure scales WebGL glyphs near the local pointer", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "dom",
        type: "text",
        element: document.createElement("p"),
        text: "Pressure",
        textLayer,
      },
      layout: { left: 20, top: 10, width: 360, height: 180 },
      pointer: { x: 74, y: 52, isInside: true },
    });

    exampleTextPressureEffect.update(context, undefined, {
      kind: "example.textPressure",
      color: "#f4f4f5",
      radius: 140,
    });

    expect(exampleTextPressureEffect.source).toBe("dom/text");
    const transform = textLayer.setGlyphs.mock.calls[0]?.[0];
    const nearGlyph = { ...createGlyph(0, "P"), x: 42, y: 32, width: 18, height: 28 };
    const farGlyph = { ...createGlyph(1, "r"), x: 280, y: 32, width: 18, height: 28 };
    const commands = transform?.([nearGlyph, farGlyph]);

    expect(commands?.[0]).toMatchObject({
      index: 0,
      char: "P",
      color: "#f4f4f5",
      scaleX: expect.any(Number),
      scaleY: expect.any(Number),
      opacity: 1,
    });
    expect(commands?.[0]?.scaleX).toBeGreaterThan(commands?.[1]?.scaleX ?? 0);
    expect(commands?.[0]?.scaleY).toBeGreaterThan(commands?.[1]?.scaleY ?? 0);
    expect(commands?.[1]).toMatchObject({
      index: 1,
      char: "r",
      color: "#f4f4f5",
      opacity: 1,
    });
  });

  test("text pressure reflows the whole line after nearby glyphs expand", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "dom",
        type: "text",
        element: document.createElement("p"),
        text: "ABCD",
        textLayer,
      },
      layout: { left: 0, top: 0, width: 240, height: 120 },
      pointer: { x: 103, y: 24, isInside: true },
    });

    exampleTextPressureEffect.update(context, undefined, {
      kind: "example.textPressure",
      color: "#f4f4f5",
      radius: 90,
    });

    const transform = textLayer.setGlyphs.mock.calls[0]?.[0];
    const glyphs = [
      { ...createGlyph(0, "A"), x: 0, y: 10, width: 24, height: 28 },
      { ...createGlyph(1, "B"), x: 36, y: 10, width: 24, height: 28 },
      { ...createGlyph(2, "C"), x: 72, y: 10, width: 24, height: 28 },
      { ...createGlyph(3, "D"), x: 108, y: 10, width: 24, height: 28 },
    ];
    const commands = transform?.(glyphs) as
      | readonly WebGLTextGlyphRenderCommand[]
      | undefined;

    expect(commands?.map((command) => command.index)).toEqual([0, 1, 2, 3]);
    expect(commands?.every((command) => typeof command.x === "number")).toBe(true);
    expect(commands?.[2]?.scaleX).toBeGreaterThan(1);
    expect(commands?.[0]?.scaleX).toBeLessThan(1);
    expect(commands?.[1]?.scaleX).toBeLessThan(commands?.[2]?.scaleX ?? 0);
    expect(commands?.[1]?.x).not.toBe(glyphs[1]?.x);
    expect(commands?.[3]?.x).not.toBe(glyphs[3]?.x);
    expect(commands?.[3]?.x ?? 0).toBeGreaterThan(commands?.[2]?.x ?? 0);
  });

  test("text pressure does not collapse the entire line on pointer enter", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "dom",
        type: "text",
        element: document.createElement("p"),
        text: "PRESSURE",
        textLayer,
      },
      layout: { left: 0, top: 0, width: 320, height: 120 },
      pointer: { x: 18, y: 24, isInside: true },
    });

    exampleTextPressureEffect.update(context, undefined, {
      kind: "example.textPressure",
      color: "#f4f4f5",
      radius: 70,
    });

    const transform = textLayer.setGlyphs.mock.calls[0]?.[0];
    const glyphs = Array.from("PRESSURE").map((char, index) => ({
      ...createGlyph(index, char),
      x: index * 30,
      y: 10,
      width: 22,
      height: 28,
    }));
    const commands = transform?.(glyphs) as
      | readonly WebGLTextGlyphRenderCommand[]
      | undefined;
    const originalStart = glyphs[0]?.x ?? 0;
    const originalEnd = (glyphs.at(-1)?.x ?? 0) + (glyphs.at(-1)?.width ?? 0);
    const commandStart = commands?.[0]?.x ?? 0;
    const lastCommand = commands?.at(-1);
    const commandEnd =
      (lastCommand?.x ?? 0) +
      (glyphs.at(-1)?.width ?? 0) * (lastCommand?.scaleX ?? 1);

    expect(commands?.some((command) => (command.scaleX ?? 1) > 1)).toBe(true);
    expect(commands?.every((command) => (command.scaleX ?? 1) >= 0.82)).toBe(true);
    expect(commandEnd - commandStart).toBeGreaterThan((originalEnd - originalStart) * 0.92);
  });

  test("text pressure stays neutral until the pointer enters the target", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "dom",
        type: "text",
        element: document.createElement("p"),
        text: "Pressure",
        textLayer,
      },
      layout: { left: 20, top: 10, width: 360, height: 180 },
      pointer: { x: 0, y: 0, isInside: false },
      time: 1200,
    });

    exampleTextPressureEffect.update(context, undefined, {
      kind: "example.textPressure",
      color: "#f4f4f5",
      radius: 140,
    });

    const transform = textLayer.setGlyphs.mock.calls[0]?.[0];
    const commands = transform?.([
      { ...createGlyph(0, "P"), x: 42, y: 32, width: 18, height: 28 },
      { ...createGlyph(1, "r"), x: 280, y: 32, width: 18, height: 28 },
    ]);

    expect(commands).toEqual([
      { index: 0, char: "P", color: "#f4f4f5", opacity: 1, scaleX: 1, scaleY: 1 },
      { index: 1, char: "r", color: "#f4f4f5", opacity: 1, scaleX: 1, scaleY: 1 },
    ]);
  });

  test("text scramble replaces nearby WebGL glyph chars deterministically", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "dom",
        type: "text",
        element: document.createElement("p"),
        text: "Scramble",
        textLayer,
      },
      layout: { left: 20, top: 10, width: 360, height: 180 },
      pointer: { x: 74, y: 52, isInside: true },
      time: 640,
    });

    exampleTextScrambleEffect.update(context, undefined, {
      kind: "example.textScramble",
      color: "#172124",
      scrambleChars: ".:",
      radius: 120,
      speed: 0.42,
    });

    expect(exampleTextScrambleEffect.source).toBe("dom/text");
    const transform = textLayer.setGlyphs.mock.calls[0]?.[0];
    const nearGlyph = { ...createGlyph(0, "S"), x: 42, y: 32, width: 18, height: 28 };
    const farGlyph = { ...createGlyph(1, "c"), x: 280, y: 32, width: 18, height: 28 };
    const commands = transform?.([nearGlyph, farGlyph]);

    expect(commands?.[0]).toMatchObject({
      index: 0,
      color: "#172124",
      opacity: expect.any(Number),
    });
    expect([".", ":"]).toContain(commands?.[0]?.char);
    expect(commands?.[1]).toMatchObject({
      index: 1,
      char: "c",
      color: "#172124",
      opacity: expect.any(Number),
    });
  });

  test("text spotlight pressure scramble wave composes glyph motion in one pass", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "dom",
        type: "text",
        element: document.createElement("p"),
        text: "Fusion",
        textLayer,
      },
      layout: { left: 20, top: 10, width: 420, height: 180 },
      pointer: { x: 76, y: 52, isInside: true },
      time: 720,
    });

    exampleTextSpotlightPressureScrambleWaveEffect.update(context, undefined, {
      kind: "example.textSpotlightPressureScrambleWave",
      spotlightColor: "#f6c453",
      baseColor: "#f4f4f5",
      scrambleChars: "01",
      radius: 128,
      amplitude: 7,
      speed: 0.42,
    });

    expect(exampleTextSpotlightPressureScrambleWaveEffect.source).toBe("dom/text");
    expect(textLayer.setGlyphs).toHaveBeenCalledTimes(1);
    const transform = textLayer.setGlyphs.mock.calls[0]?.[0];
    const nearGlyph = { ...createGlyph(0, "F"), x: 42, y: 32, width: 18, height: 28 };
    const farGlyph = { ...createGlyph(1, "u"), x: 300, y: 32, width: 18, height: 28 };
    const commands = transform?.([nearGlyph, farGlyph]) as
      | readonly WebGLTextGlyphRenderCommand[]
      | undefined;

    expect(commands?.[0]).toMatchObject({
      index: 0,
      color: "#f6c453",
      opacity: expect.any(Number),
      scaleX: expect.any(Number),
      scaleY: expect.any(Number),
    });
    expect(["0", "1"]).toContain(commands?.[0]?.char);
    expect(commands?.[0]?.scaleX).toBeGreaterThan(commands?.[1]?.scaleX ?? 0);
    expect(commands?.[0]?.y).not.toBe(nearGlyph.y);
    expect(commands?.[1]).toMatchObject({
      index: 1,
      char: "u",
      color: "#f4f4f5",
    });
  });
});
