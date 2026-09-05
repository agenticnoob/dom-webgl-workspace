import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getAxiomsContent } from "../src/axioms/content";
import { axiomsReaderConfig } from "../src/axioms/config";

import {
  createHeroChapterAtlas,
  heroChapterAtlasMatchesViewport,
} from "../src/chapters/atlas";

const fillText = vi.fn();
const fillRect = vi.fn<CanvasRenderingContext2D["fillRect"]>();
const clip = vi.fn<() => void>();
const rect = vi.fn<CanvasRenderingContext2D["rect"]>();
const fillStyles: string[] = [];
const strokeStyles: string[] = [];
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const context: Partial<CanvasRenderingContext2D> & {
  fillStyle: string;
  font: string;
  letterSpacing: string;
  measureText(value: string): TextMetrics;
} = {
  fillStyle: "",
  font: "",
  letterSpacing: "0px",
  globalAlpha: 1,
  textBaseline: "alphabetic",
  strokeStyle: "",
  lineWidth: 1,
  lineJoin: "miter",
  beginPath: vi.fn(),
  arc: vi.fn(),
  bezierCurveTo: vi.fn(),
  clip,
  closePath: vi.fn(),
  fill: vi.fn(() => fillStyles.push(context.fillStyle)),
  fillRect,
  fillText,
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  measureText(value: string): TextMetrics {
    const fontSize = Number.parseFloat(
      context.font.match(/([\d.]+)px/)?.[1] ?? "16",
    );
    const letterSpacing = Number.parseFloat(context.letterSpacing) || 0;
    const glyphWidth = Array.from(value).reduce(
      (width, glyph) =>
        width +
        (/\p{Script=Han}/u.test(glyph) ? fontSize * 0.95 : fontSize * 0.56),
      0,
    );
    return {
      width:
        glyphWidth + Math.max(0, Array.from(value).length - 1) * letterSpacing,
      actualBoundingBoxAscent: fontSize * 0.8,
      actualBoundingBoxDescent: fontSize * 0.2,
      fontBoundingBoxAscent: fontSize * 0.8,
      fontBoundingBoxDescent: fontSize * 0.2,
    } as TextMetrics;
  },
  rect,
  restore: vi.fn(),
  rotate: vi.fn(),
  save: vi.fn(),
  scale: vi.fn(),
  stroke: vi.fn(() => strokeStyles.push(String(context.strokeStyle))),
  translate: vi.fn(),
};

describe("hero chapter atlas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fillStyles.length = 0;
    strokeStyles.length = 0;
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

  test("draws all four localized faces from their body content", () => {
    const atlas = createHeroChapterAtlas({ width: 1280, height: 720 });

    expect(atlas).toMatchObject({
      tileWidth: 1024,
      tileHeight: 576,
      layoutWidth: 1280,
      layoutHeight: 720,
    });
    expect(atlas.canvas).toMatchObject({ width: 2048, height: 2304 });
    expect(atlas.locale).toBe("zh");
    const renderedText = fillText.mock.calls
      .map(([text]) => text)
      .join("")
      .replace(/\s/g, "");
    expect(fillText).toHaveBeenCalledWith(
      "01 / 04",
      expect.any(Number),
      expect.any(Number),
    );
    expect(renderedText).toContain("我不是沿一条直线抵达这里。");
    expect(renderedText).toContain("这是我的正面");
    expect(fillText).toHaveBeenCalledWith(
      "直线抵达",
      expect.any(Number),
      expect.any(Number),
    );
    expect(fillText).toHaveBeenCalledWith(
      "这里。",
      expect.any(Number),
      expect.any(Number),
    );
    expect(renderedText).toContain("真正的颠覆，不只是更好的答案。");
    expect(renderedText).toContain("把未完成的思考，放进真实交流。");
    expect(renderedText).not.toContain("SELF/NOOBLI");
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
    fillText.mockClear();
    createHeroChapterAtlas({ width: 1280, height: 720 }, "en");
    const renderedEnglish = fillText.mock.calls
      .map(([text]) => text)
      .join("")
      .replace(/\s/g, "");
    expect(renderedEnglish).toContain("Ididnotarrivehereinastraightline.");
  });

  test("clips and packs body-derived entry and tail tiles without bleed", () => {
    createHeroChapterAtlas({ width: 1280, height: 720 });

    const backgroundDraws = fillRect.mock.calls.filter(
      ([x, y, width, height]) =>
        x === 0 && y === 0 && width === 1280 && height === 720,
    );
    expect(backgroundDraws).toHaveLength(8);
    expect(context.stroke).toHaveBeenCalled();
    expect(fillStyles).toContain("white");
    expect(strokeStyles).toContain("black");
    expect(context.translate).toHaveBeenCalledWith(0, 1152);
    // Each endpoint clips its fan viewport, visible fan titles and article sheets.
    const articleCount = getAxiomsContent("zh").body.sections.length;
    const visibleFanCount = Math.min(
      articleCount,
      Math.floor(
        axiomsReaderConfig.fan.maxAngle / axiomsReaderConfig.fan.angleStep,
      ) + 1,
    );
    const clipCount = 8 + 2 * (1 + visibleFanCount) + 1 + articleCount;
    expect(rect).toHaveBeenCalledTimes(clipCount);
    expect(clip).toHaveBeenCalledTimes(clipCount + 1 + articleCount);
    expect(
      rect.mock.calls.filter(
        ([, , width, height]) => width === 1024 && height === 576,
      ),
    ).toHaveLength(8);
    expect(fillText).not.toHaveBeenCalledWith(
      "SELF / TRACE",
      expect.any(Number),
      expect.any(Number),
    );
  });

  test("derives the returning face from the chapter's real tail content", () => {
    const atlas = createHeroChapterAtlas({ width: 1280, height: 720 });
    const renderedText = fillText.mock.calls
      .map(([text]) => text)
      .join("")
      .replace(/\s/g, "");

    expect(atlas.canvas.height).toBe(atlas.tileHeight * 4);
    expect(renderedText).toContain(
      "不把身份写成终点，只把它当作下一次出发前，暂时落下的坐标。",
    );
    const lastArticle = getAxiomsContent("zh").body.sections.at(-1);
    expect(lastArticle).toBeDefined();
    expect(renderedText).toContain(lastArticle?.title.replace(/\s/g, ""));
    expect(renderedText).toContain("愿与同道者共研同进，或有所得，亦未可知。");
  });

  test("caps the owned atlas for mobile-safe texture allocation", () => {
    const atlas = createHeroChapterAtlas({ width: 2400, height: 1800 });

    expect(atlas).toMatchObject({
      tileWidth: 1024,
      tileHeight: 768,
      layoutWidth: 2400,
      layoutHeight: 1800,
    });
    expect(context.scale).toHaveBeenCalledWith(1024 / 2400, 1024 / 2400);
    expect(
      heroChapterAtlasMatchesViewport(atlas, { width: 2400, height: 1800 }),
    ).toBe(true);
  });

  test("wraps the same body title and intro for the mobile face", () => {
    const atlas = createHeroChapterAtlas({ width: 390, height: 844 });

    expect(atlas).toMatchObject({ tileWidth: 390, tileHeight: 844 });
    expect(atlas.canvas).toMatchObject({ width: 780, height: 3376 });
    expect(fillText).toHaveBeenCalledWith(
      "01 / 04",
      expect.any(Number),
      expect.any(Number),
    );
  });
});
