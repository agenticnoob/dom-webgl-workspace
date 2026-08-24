import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  createHeroChapterAtlas,
  heroChapterAtlasMatchesViewport,
} from "../src/heroChapterAtlas";

const fillText = vi.fn();
const context = {
  fillStyle: "",
  font: "",
  letterSpacing: "0px",
  globalAlpha: 1,
  textBaseline: "alphabetic",
  fillRect: vi.fn(),
  fillText,
  measureText(value: string) {
    return {
      width: value.length * 10,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
      fontBoundingBoxAscent: 8,
      fontBoundingBoxDescent: 2,
    } as TextMetrics;
  },
  restore: vi.fn(),
  save: vi.fn(),
  scale: vi.fn(),
  translate: vi.fn(),
} satisfies Partial<CanvasRenderingContext2D>;

describe("hero chapter atlas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as CanvasRenderingContext2D,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("keeps the chapter-one projection at viewport scale with shared semantic copy", () => {
    const atlas = createHeroChapterAtlas({ width: 1280, height: 720 });

    expect(atlas).toMatchObject({
      tileWidth: 1280,
      tileHeight: 720,
      layoutWidth: 1280,
      layoutHeight: 720,
    });
    expect(atlas.canvas).toMatchObject({ width: 2560, height: 1440 });
    expect(fillText).toHaveBeenCalledWith("PROTOTYPE / 01", expect.any(Number), expect.any(Number));
    expect(fillText).toHaveBeenCalledWith("FIELD", expect.any(Number), expect.any(Number));
    expect(fillText).toHaveBeenCalledWith("NOTES", expect.any(Number), expect.any(Number));
    expect(fillText).toHaveBeenCalledWith("01A", expect.any(Number), expect.any(Number));
    expect(fillText).toHaveBeenCalledWith("FACE SPACE", expect.any(Number), expect.any(Number));
    expect(
      fillText.mock.calls.some(([value]) =>
        String(value).includes("TEMPORARY CHAPTER SURFACE"),
      ),
    ).toBe(true);
    expect(heroChapterAtlasMatchesViewport(atlas, { width: 1280, height: 720 })).toBe(true);
  });

  test("caps the owned atlas for mobile-safe texture allocation", () => {
    const atlas = createHeroChapterAtlas({ width: 2400, height: 1800 });

    expect(atlas).toMatchObject({
      tileWidth: 1600,
      tileHeight: 1200,
      layoutWidth: 2400,
      layoutHeight: 1800,
    });
    expect(context.scale).toHaveBeenCalledWith(2 / 3, 2 / 3);
    expect(heroChapterAtlasMatchesViewport(atlas, { width: 2400, height: 1800 })).toBe(true);
  });

  test("uses the same single-column mobile card composition as the semantic frame", () => {
    const atlas = createHeroChapterAtlas({ width: 390, height: 844 });

    expect(atlas).toMatchObject({ tileWidth: 390, tileHeight: 844 });
    expect(context.fillRect).toHaveBeenCalledWith(
      22,
      844 * 0.58,
      346,
      844 * 0.13,
    );
    expect(context.fillRect).toHaveBeenCalledWith(
      22,
      844 * 0.58 + 844 * 0.13 + 10,
      346,
      844 * 0.13,
    );
  });
});
