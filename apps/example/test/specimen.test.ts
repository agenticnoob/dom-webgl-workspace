import { describe, expect, it } from "vitest";

import { blurField } from "../src/showcase/GlassTitle";
import { glyphPhase } from "../src/showcase/GlyphScatter";
import { createSimulation } from "../src/showcase/InkField";
import { measureSpecimenLayout } from "../src/specimen/Specimen";

describe("glyph scatter phases", () => {
  it("assembles in the first 35% and dissolves in the last 30%", () => {
    expect(glyphPhase(0)).toEqual({ assemble: 0, dissolve: 0 });
    expect(glyphPhase(0.35)).toEqual({ assemble: 1, dissolve: 0 });
    expect(glyphPhase(0.5)).toEqual({ assemble: 1, dissolve: 0 });
    expect(glyphPhase(0.7).dissolve).toBe(0);
    expect(glyphPhase(1)).toEqual({ assemble: 1, dissolve: 1 });
    // Scroll-driven: the same progress gives the same state in either direction.
    expect(glyphPhase(0.2)).toEqual(glyphPhase(0.2));
    expect(glyphPhase(0.2).assemble).toBeGreaterThan(glyphPhase(0.1).assemble);
  });
});

describe("glass height map blur", () => {
  it("keeps the total of a uniform field and spreads a point evenly", () => {
    const flat = blurField(new Float32Array(25).fill(0.5), 5, 5, 1);
    expect(Array.from(flat).every((value) => Math.abs(value - 0.5) < 1e-6)).toBe(true);
    const point = new Float32Array(49);
    point[24] = 1;
    const spread = blurField(point, 7, 7, 1);
    expect(spread[24]).toBeCloseTo(1 / 9);
    expect(spread[16]).toBeCloseTo(1 / 9);
    expect(spread[32]).toBeCloseTo(1 / 9);
    expect(spread[0]).toBe(0);
  });
});

describe("ink simulation", () => {
  it("sizes its grids from the canvas aspect and disposes them", () => {
    const sim = createSimulation(64, 256, 2);
    expect(sim.sizes.grid).toEqual([128, 64]);
    expect(sim.sizes.dye).toEqual([512, 256]);
    expect(sim.dye()).not.toBeNull();
    expect(() => {
      sim.dispose();
    }).not.toThrow();
  });
});

describe("specimen layout", () => {
  it("measures chapters and the glyph range from the blocks", () => {
    const layout = measureSpecimenLayout(
      {
        title: { top: 0, height: 900 },
        glyphs: { top: 900, height: 2000 },
        specimen: { top: 2900, height: 1100 },
        outro: { top: 4000, height: 600 },
      },
      4600,
      1000,
    );
    expect(layout.starts).toEqual([0, 400 / 3600, 2400 / 3600, 3500 / 3600]);
    expect(layout.glyphs.from).toBeCloseTo(50 / 3600);
    expect(layout.glyphs.to).toBeCloseTo(2150 / 3600);
    expect(layout.glyphs.key).toBe("specimen");
  });
});
