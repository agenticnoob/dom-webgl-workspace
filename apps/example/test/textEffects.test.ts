import { describe, expect, test } from "vitest";
import type { DOMTextGlyph } from "@viselora/dom-webgl";
import { createTextGlyphCommands } from "../src/textEffects";
import { readTargetViewportProgress } from "../src/effectMath";

export const createGlyph = (index: number, char: string): DOMTextGlyph => ({
  index,
  char,
  line: 0,
  x: index * 16,
  y: 0,
  width: 16,
  height: 24,
  baseline: 18,
});
const input = {
  time: 1000,
  width: 360,
  height: 180,
  progress: 0.5,
  pointer: { active: true, x: 54, y: 42 },
};
const near = { ...createGlyph(0, "P"), x: 42, y: 32, width: 18, height: 28 };
const far = { ...createGlyph(1, "r"), x: 280, y: 32, width: 18, height: 28 };

describe("native text glyph animation", () => {
  test("wave uses elapsed time and preserves glyph identity", () => {
    const commands = createTextGlyphCommands(
      "wave",
      [createGlyph(0, "W"), createGlyph(1, "a")],
      input,
      { amplitude: 8 },
    );
    expect(commands[0]).toMatchObject({ index: 0, char: "W" });
    expect(commands[0].y).not.toBe(0);
    expect(
      createTextGlyphCommands(
        "wave",
        [createGlyph(0, "W")],
        { ...input, time: 0 },
        { amplitude: 8 },
      )[0].y,
    ).not.toBe(commands[0].y);
  });
  test("reveal maps progress to glyph opacity and scale", () => {
    const commands = createTextGlyphCommands(
      "reveal",
      Array.from("Reveal", (char, i) => createGlyph(i, char)),
      input,
      { color: "#d95f42" },
    );
    expect(commands[0]).toMatchObject({ opacity: 1, color: "#d95f42" });
    expect(commands[3]).toMatchObject({ opacity: 0.18, scaleX: 0.82 });
  });
  test("viewport reveal progresses independently of page scroll percentage", () => {
    const progress = readTargetViewportProgress({
      top: 120,
      height: 240,
      viewport: { height: 768 },
    });
    const commands = createTextGlyphCommands(
      "reveal",
      Array.from("Card", (c, i) => createGlyph(i, c)),
      { ...input, progress },
    );
    expect(commands[0].opacity).toBe(1);
    expect(commands[1].opacity).toBe(1);
  });
  test("keyed progress supports reversible pinned glyph reveal", () => {
    const glyphs = Array.from("Card", (c, i) => createGlyph(i, c));
    const commands = createTextGlyphCommands("reveal", glyphs, {
      ...input,
      progress: 0.25,
    });
    expect(commands[0].opacity).toBe(1);
    expect(commands[1].opacity).toBe(0.18);
    expect(
      createTextGlyphCommands("reveal", glyphs, {
        ...input,
        progress: 0,
      }).every((c) => c.opacity === 0.18),
    ).toBe(true);
  });
  test("spotlight highlights only nearby local glyphs", () => {
    const commands = createTextGlyphCommands("spotlight", [near, far], input, {
      color: "#f6c453",
      radius: 80,
    });
    expect(commands[0].color).toBe("#f6c453");
    expect(commands[1]).toMatchObject({
      char: "r",
      color: "#1d2a2e",
      opacity: 0.28,
    });
  });
  test("pressure expands nearby glyphs with bounded distant compression", () => {
    const commands = createTextGlyphCommands("pressure", [near, far], input, {
      radius: 140,
    });
    expect(commands[0].scaleX).toBeGreaterThan(commands[1].scaleX!);
    expect(commands[0].scaleY).toBeGreaterThan(commands[1].scaleY!);
    expect(commands[1].opacity).toBe(1);
  });
  test("pressure reflows a whole line in stable glyph order", () => {
    const glyphs = Array.from("ABCD", (char, index) => ({
      ...createGlyph(index, char),
      x: index * 36,
      y: 10,
      width: 24,
      height: 28,
    }));
    const commands = createTextGlyphCommands(
      "pressure",
      glyphs,
      { ...input, pointer: { active: true, x: 103, y: 24 } },
      { radius: 90 },
    );
    expect(commands.map((c) => c.index)).toEqual([0, 1, 2, 3]);
    expect(commands[2].scaleX).toBeGreaterThan(1);
    expect(commands[0].scaleX).toBeLessThan(1);
    expect(commands[1].scaleX).toBeLessThan(commands[2].scaleX!);
    expect(commands[1].x).not.toBe(glyphs[1].x);
    expect(commands[3].x).not.toBe(glyphs[3].x);
    expect(commands[3].x).toBeGreaterThan(commands[2].x!);
  });
  test("pointer entry never collapses the line", () => {
    const glyphs = Array.from("PRESSURE", (char, index) => ({
      ...createGlyph(index, char),
      x: index * 30,
      y: 10,
      width: 22,
      height: 28,
    }));
    const commands = createTextGlyphCommands(
      "pressure",
      glyphs,
      { ...input, pointer: { active: true, x: 18, y: 24 } },
      { radius: 70 },
    );
    expect(commands.some((c) => c.scaleX! > 1)).toBe(true);
    expect(commands.every((c) => c.scaleX! >= 0.82)).toBe(true);
    const last = commands.at(-1)!;
    expect(last.x! + 22 * last.scaleX! - commands[0].x!).toBeGreaterThan(
      232 * 0.92,
    );
  });
  test("pressure stays neutral while the pointer is outside", () => {
    const commands = createTextGlyphCommands("pressure", [near, far], {
      ...input,
      pointer: { active: false, x: 0, y: 0 },
    });
    expect(commands.map(({ x, y, ...command }) => command)).toEqual([
      {
        index: 0,
        char: "P",
        color: "#f4f4f5",
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
      },
      {
        index: 1,
        char: "r",
        color: "#f4f4f5",
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
      },
    ]);
  });
  test("scramble is deterministic, local and leaves distant characters intact", () => {
    const options = { scrambleChars: ".:", radius: 120, speed: 0.42 };
    const commands = createTextGlyphCommands(
      "scramble",
      [near, far],
      input,
      options,
    );
    expect([".", ":"]).toContain(commands[0].char);
    expect(commands[1].char).toBe("r");
    expect(
      createTextGlyphCommands("scramble", [near, far], input, options),
    ).toEqual(commands);
  });
  test("combined pass retains pressure, spotlight, scramble and wave", () => {
    const commands = createTextGlyphCommands(
      "combo",
      [near, far],
      { ...input, time: 720 },
      { radius: 128, amplitude: 7, speed: 0.42, scrambleChars: "01" },
    );
    expect(commands[0].color).toBe("#f6c453");
    expect(["0", "1"]).toContain(commands[0].char);
    expect(commands[0].scaleX).toBeGreaterThan(commands[1].scaleX!);
    expect(commands[0].y).not.toBe(near.y);
    expect(commands[1]).toMatchObject({ char: "r", color: "#f4f4f5" });
  });
});
