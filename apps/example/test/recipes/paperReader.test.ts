import { describe, expect, test } from "vitest";
import { createPaperReaderArtwork } from "../../src/recipes/paper-reader/artwork";
import { resolvePaperReaderScrollHeight } from "../../src/recipes/paper-reader/config";
import {
  resolvePaperReaderFrame,
  resolvePaperReaderReadingStops,
} from "../../src/recipes/paper-reader/frame";
import { resolvePaperReaderLayout } from "../../src/recipes/paper-reader/layout";
import {
  defaultPaperReaderPalette,
  validatePaperReader,
} from "../../src/recipes/paper-reader/model";
import {
  createPaperReaderProgram,
  createPaperReaderUniforms,
} from "../../src/recipes/paper-reader/program";
import { resolvePaperReaderProgress } from "../../src/recipes/paper-reader/scroll";
import { resolvePaperReaderStamp } from "../../src/recipes/paper-reader/stamp";
import { resolvePaperReaderTextureLayout } from "../../src/recipes/paper-reader/texture";

const measure = {
  font: "",
  letterSpacing: "",
  measureText: (text: string) => ({ width: Array.from(text).length * 8 }),
};
const viewport = { width: 1200, height: 800 };
const layout = resolvePaperReaderLayout(
  viewport,
  Array.from({ length: 4 }, () => ({})),
);

describe("extracted paper reader geometry", () => {
  test("preserves a continuous circular focus and keeps older papers full-sized below new arrivals", () => {
    const first = resolvePaperReaderFrame(0, layout);
    const middle = resolvePaperReaderFrame(1 / 6, layout);
    const second = resolvePaperReaderFrame(1 / 3, layout);
    expect(second.fans[1].rect).toEqual(first.fans[0].rect);
    expect(middle.fans[0].rect.y).toBeLessThan(first.fans[0].rect.y);
    expect(middle.papers[0]).toEqual(first.papers[0]);
    expect(first.papers[1].visible).toBe(false);
    expect(first.papers[1].rect.x).toBeGreaterThan(viewport.width);
    expect(middle.papers[1].rect.width).toBe(second.papers[1].rect.width);
    expect(middle.papers[1].rect.height).toBe(second.papers[1].rect.height);
    expect(middle.papers[1].angle).toBeLessThan(0);
    expect(second.papers[1].angle).toBe(0);
    const start = first.papers[1].rect;
    const end = second.papers[1].rect;
    const rect = middle.papers[1].rect;
    const straightY =
      start.y + (end.y - start.y) * ((rect.x - start.x) / (end.x - start.x));
    expect(rect.y).toBeLessThan(straightY - 10);
    expect(new Set(layout.papers.map((paper) => paper.width)).size).toBe(4);
  });

  test("retraces identical geometry without fixed holds or history", () => {
    const samples = [0, 0.165, 0.16665, 0.16668, 0.5, 0.8, 1];
    const forward = samples.map((progress) =>
      resolvePaperReaderFrame(progress, layout),
    );
    const reverse = [...samples]
      .reverse()
      .map((progress) => resolvePaperReaderFrame(progress, layout))
      .reverse();
    expect(reverse).toEqual(forward);
    expect(
      Math.abs(forward[2].papers[1].rect.x - forward[3].papers[1].rect.x),
    ).toBeLessThan(1);
    for (let i = 0; i <= 100; i++) {
      expect(resolvePaperReaderFrame(i / 100, layout).cursor).toBeCloseTo(
        i * 0.03,
      );
    }
  });

  test("reads overflow before the next arrival and reaches the last article's final line", () => {
    const overflowing = { ...layout, paperOverflow: [400, 0, 0, 800] };
    const stops = resolvePaperReaderReadingStops(overflowing);
    expect(stops[0].readEnd).toBeCloseTo(1 / 9);
    expect(stops[3].arrival).toBeCloseTo(7 / 9);
    const reading = resolvePaperReaderFrame(1 / 18, overflowing);
    expect(reading.cursor).toBe(0);
    expect(reading.papers[0].scroll).toBeCloseTo(0.5);
    expect(reading.papers[1].visible).toBe(false);
    expect(
      resolvePaperReaderFrame(8 / 9, overflowing).papers[3].scroll,
    ).toBeCloseTo(0.5);
    expect(resolvePaperReaderFrame(1, overflowing).papers[3].scroll).toBe(1);
  });

  test.each([0, 1, 4, 7, 12])(
    "derives atlas and shader capacity from %i articles",
    (count) => {
      const sections = Array.from({ length: count }, (_, i) => ({
        id: `note-${i}`,
        title: `Observation ${i}`,
        label: "FIELD NOTE",
        body: "An observation and an experiment.",
      }));
      const artwork = createPaperReaderArtwork(
        measure,
        viewport,
        { title: "Field notes", intro: "An open collection.", sections },
        "READING ROOM",
      );
      const packed = resolvePaperReaderTextureLayout([
        artwork.header,
        ...artwork.fans,
        ...artwork.papers,
      ]);
      expect(packed.tiles).toHaveLength(1 + 2 * count);
      expect(packed.width).toBeLessThanOrEqual(4096);
      expect(packed.height).toBeLessThanOrEqual(4096);
      expect(packed.columns * packed.rows).toBeGreaterThanOrEqual(
        packed.tiles.length,
      );
      const frame = resolvePaperReaderFrame(1, artwork.layout);
      expect(frame.selected).toBe(count - 1);
      const program = createPaperReaderProgram(
        artwork,
        { ...packed, canvas: document.createElement("canvas") },
        frame,
        defaultPaperReaderPalette,
      );
      expect(program.fragmentShader).toContain(`tileSizes[${1 + 2 * count}]`);
      expect(program.fragmentShader).toContain(
        `origins[${Math.max(1, 2 * count)}]`,
      );
      expect(program.uniforms.tileOrigins.value).toEqual(
        packed.tileOrigins.flat(),
      );
      for (const [i, stop] of resolvePaperReaderReadingStops(
        artwork.layout,
      ).entries()) {
        expect(
          resolvePaperReaderFrame(stop.arrival, artwork.layout).selected,
        ).toBe(i);
      }
    },
  );

  test.each([
    "English words wrap without losing the conclusion. ".repeat(30),
    "中文排版保留每一个字，也让完整文章能够被阅读。".repeat(30),
  ])("typesets complete overflow text in a narrow container", (body) => {
    const artwork = createPaperReaderArtwork(
      measure,
      { width: 375, height: 720 },
      {
        title: "Notes",
        intro: "Read each page.",
        sections: [
          { id: "long", label: "01", title: "A longer observation", body },
        ],
      },
      "INDEX",
    );
    const paper = artwork.papers[0];
    const rendered = paper.lines
      .map((line) => line.text)
      .join("")
      .replace(/\s/g, "");
    expect(rendered).toContain(body.replace(/\s/g, ""));
    expect(artwork.layout.paperOverflow[0]).toBeGreaterThan(0);
    const final = resolvePaperReaderFrame(1, artwork.layout);
    const uniforms = createPaperReaderUniforms(
      artwork,
      final,
      defaultPaperReaderPalette,
    );
    expect(uniforms.scrolls).toEqual([
      [0, 1],
      [artwork.layout.paperOverflow[0], 0],
    ]);
    expect(final.papers[0].rect.y + final.papers[0].rect.height).toBeLessThan(
      720,
    );
  });

  test("keeps distant index entries from wrapping around into view", () => {
    const many = resolvePaperReaderLayout(
      viewport,
      Array.from({ length: 24 }, () => ({})),
    );
    expect(resolvePaperReaderFrame(0, many).fans[19].visible).toBe(false);
    expect(resolvePaperReaderFrame(19 / 23, many).fans[19].visible).toBe(true);
    expect(resolvePaperReaderFrame(19 / 23, many).fans[0].visible).toBe(false);
  });

  test("fits inward stamp holes to all four edges for custom dimensions", () => {
    for (const [width, height] of [
      [720, 480],
      [183, 221],
      [25, 40],
    ]) {
      const stamp = resolvePaperReaderStamp(width, height);
      expect(stamp.pitchX * stamp.columns).toBeCloseTo(width);
      expect(stamp.pitchY * stamp.rows).toBeCloseTo(height);
      expect(stamp.radius * 2).toBeLessThan(
        Math.min(stamp.pitchX, stamp.pitchY),
      );
      expect(stamp.radius).toBeGreaterThan(0);
    }
  });

  test("uses local sticky travel, clamps endpoints, and expands the runway with content", () => {
    expect(resolvePaperReaderProgress(64, 2800, 700, 64)).toBe(0);
    expect(resolvePaperReaderProgress(-986, 2800, 700, 64)).toBe(0.5);
    expect(resolvePaperReaderProgress(-2036, 2800, 700, 64)).toBe(1);
    expect(resolvePaperReaderProgress(1000, 2800, 700)).toBe(0);
    expect(resolvePaperReaderProgress(-5000, 2800, 700)).toBe(1);
    expect(resolvePaperReaderProgress(0, 700, 700)).toBe(0);
    expect(resolvePaperReaderScrollHeight(8) - 100).toBe(
      2 * (resolvePaperReaderScrollHeight(4) - 100),
    );
  });

  test("rejects ambiguous ids, invalid fractions and unsupported colors before GPU registration", () => {
    const article = { id: "one", title: "Note", label: "01", body: "Text" };
    expect(() => validatePaperReader({ id: "", articles: [] })).toThrow(
      /non-empty/,
    );
    expect(() =>
      validatePaperReader({ id: "notes", articles: [article, article] }),
    ).toThrow(/unique/);
    expect(() =>
      validatePaperReader({
        id: "notes",
        articles: [{ ...article, paper: { width: 0, height: 1 } }],
      }),
    ).toThrow(/fractions/);
    expect(() =>
      validatePaperReader({
        id: "notes",
        articles: [],
        palette: { background: "red", foreground: "#ffffff" },
      }),
    ).toThrow(/hex/);
  });
});
