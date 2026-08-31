import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  createHeroChapterAtlas,
  heroChapterAtlasMatchesViewport,
} from "../src/chapters/atlas";

const fillText = vi.fn();
const originalGetContext = HTMLCanvasElement.prototype.getContext;
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
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => context),
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: originalGetContext,
      writable: true,
    });
  });

  test("draws all four localized chapter faces at viewport scale", () => {
    const atlas = createHeroChapterAtlas({ width: 1280, height: 720 });

    expect(atlas).toMatchObject({
      tileWidth: 1280,
      tileHeight: 720,
      layoutWidth: 1280,
      layoutHeight: 720,
    });
    expect(atlas.canvas).toMatchObject({ width: 2560, height: 1440 });
    expect(atlas.locale).toBe("zh");
    expect(fillText).toHaveBeenCalledWith(
      "NOOBLI / 01",
      expect.any(Number),
      expect.any(Number),
    );
    expect(fillText).toHaveBeenCalledWith(
      "持续构建",
      expect.any(Number),
      expect.any(Number),
    );
    expect(fillText).toHaveBeenCalledWith(
      "AXIOMS / 02",
      expect.any(Number),
      expect.any(Number),
    );
    expect(fillText).toHaveBeenCalledWith(
      "VISELORA",
      expect.any(Number),
      expect.any(Number),
    );
    expect(fillText).toHaveBeenCalledWith(
      "SIGNALS / 04",
      expect.any(Number),
      expect.any(Number),
    );
    expect(fillText).toHaveBeenCalledWith(
      "WORDS / VIDEO",
      expect.any(Number),
      expect.any(Number),
    );
    expect(
      heroChapterAtlasMatchesViewport(atlas, { width: 1280, height: 720 }),
    ).toBe(true);
    expect(
      heroChapterAtlasMatchesViewport(
        atlas,
        { width: 1280, height: 720 },
        "en",
      ),
    ).toBe(false);
    expect(
      heroChapterAtlasMatchesViewport(
        atlas,
        { width: 1280, height: 720 },
        "zh",
        ["self"],
      ),
    ).toBe(false);

    createHeroChapterAtlas({ width: 1280, height: 720 }, "en");
    expect(fillText).toHaveBeenCalledWith(
      "BUILDING",
      expect.any(Number),
      expect.any(Number),
    );
    expect(fillText).toHaveBeenCalledWith(
      "CHANGE",
      expect.any(Number),
      expect.any(Number),
    );
  });

  test("switches only the active chapter face to its distinct exit frame", () => {
    const atlas = createHeroChapterAtlas({ width: 1280, height: 720 }, "zh", [
      "self",
    ]);

    expect(atlas.exitChapterIds).toEqual(["self"]);
    expect(fillText).toHaveBeenCalledWith(
      "SELF / TRACE",
      expect.any(Number),
      expect.any(Number),
    );
    expect(fillText).toHaveBeenCalledWith(
      "持续校正",
      expect.any(Number),
      expect.any(Number),
    );
    expect(fillText).toHaveBeenCalledWith(
      "AXIOMS / 02",
      expect.any(Number),
      expect.any(Number),
    );
    expect(
      heroChapterAtlasMatchesViewport(
        atlas,
        { width: 1280, height: 720 },
        "zh",
        ["self"],
      ),
    ).toBe(true);
  });

  test("retains completed exit frames when the following chapter starts", () => {
    const atlas = createHeroChapterAtlas({ width: 1280, height: 720 }, "zh", [
      "self",
      "axioms",
    ]);

    expect(atlas.exitChapterIds).toEqual(["self", "axioms"]);
    expect(fillText).toHaveBeenCalledWith(
      "SELF / TRACE",
      expect.any(Number),
      expect.any(Number),
    );
    expect(fillText).toHaveBeenCalledWith(
      "AXIOMS / OPEN",
      expect.any(Number),
      expect.any(Number),
    );
    expect(fillText).toHaveBeenCalledWith(
      "BUILDS / 03",
      expect.any(Number),
      expect.any(Number),
    );
    expect(
      heroChapterAtlasMatchesViewport(
        atlas,
        { width: 1280, height: 720 },
        "zh",
        ["self", "axioms"],
      ),
    ).toBe(true);
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
    expect(
      heroChapterAtlasMatchesViewport(atlas, { width: 2400, height: 1800 }),
    ).toBe(true);
  });

  test("uses the same single-column mobile card composition as the semantic frame", () => {
    const atlas = createHeroChapterAtlas({ width: 390, height: 844 });

    expect(atlas).toMatchObject({ tileWidth: 390, tileHeight: 844 });
    expect(context.fillRect).toHaveBeenCalledWith(
      22,
      844 * 0.54,
      346,
      844 * 0.13,
    );
    expect(context.fillRect).toHaveBeenCalledWith(
      22,
      844 * 0.54 + 844 * 0.13 + 10,
      346,
      844 * 0.13,
    );
  });
});
