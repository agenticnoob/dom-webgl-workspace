import { describe, expect, test, vi } from "vitest";
import { createAxiomsArtwork } from "../src/axioms/artwork";
import {
  getAxiomsContent,
  heroAxiomsArticles,
  localizeAxiomsArticles,
} from "../src/axioms/content";
import { resolveAxiomsScrollHeight } from "../src/axioms/config";
import {
  resolveAxiomsFrame,
  resolveAxiomsReadingStops,
} from "../src/axioms/frame";
import { resolveAxiomsLayout } from "../src/axioms/layout";
import {
  createAxiomsProgram,
  createAxiomsUniforms,
} from "../src/axioms/program";
import { resolveAxiomsTextureLayout } from "../src/axioms/texture";
import { resolveAxiomsStamp, traceAxiomsStamp } from "../src/axioms/stamp";

const measure = {
  font: "",
  letterSpacing: "",
  measureText: (text: string) => ({ width: text.length * 8 }),
};
const viewport = { width: 1440, height: 900 };

describe("data-driven axioms articles", () => {
  test.each([0, 1, 4, 7, 12])(
    "renders and reaches every article for count %i",
    (count) => {
      const sections = Array.from({ length: count }, (_, index) => ({
        id: `article-${index}`,
        label: `Article ${index}`,
        title: "A working proposition",
        body: "Evidence and interpretation.",
      }));
      const content = { ...getAxiomsContent("en").body, sections };
      const artwork = createAxiomsArtwork(
        measure,
        viewport,
        content,
        "02 / 04 · AXIOMS",
      );
      expect(artwork.layout.fan.height).toBeGreaterThan(0);
      const packed = resolveAxiomsTextureLayout([
        artwork.header,
        ...artwork.fans,
        ...artwork.papers,
      ]);
      const canvas = document.createElement("canvas");
      canvas.width = packed.width;
      canvas.height = packed.height;
      const texture = { ...packed, canvas };
      expect(texture.tiles).toHaveLength(1 + 2 * count);
      expect(texture.columns * texture.rows).toBeGreaterThanOrEqual(
        texture.tiles.length,
      );
      expect(texture.canvas.width).toBeLessThanOrEqual(4096);
      expect(texture.canvas.height).toBeLessThanOrEqual(4096);
      const frame = resolveAxiomsFrame(1, artwork.layout);
      expect(frame.selected).toBe(count - 1);
      const program = createAxiomsProgram(artwork, texture, frame);
      expect(program.uniforms?.stampPitches).toEqual(
        count
          ? artwork.layout.papers.map((paper) => {
              const stamp = resolveAxiomsStamp(paper.width, paper.height);
              return [stamp.pitchX, stamp.pitchY];
            })
          : [[1, 1]],
      );
      expect(program.uniforms?.stampRadii).toEqual(
        count
          ? artwork.layout.papers.map((paper) => [
              resolveAxiomsStamp(paper.width, paper.height).radius,
              0,
            ])
          : [[0, 0]],
      );
      expect(program.uniforms?.tileOrigins).toEqual(
        packed.tiles.map((_, i) => [
          (i % packed.columns) * packed.cellWidth + packed.gutter,
          Math.floor(i / packed.columns) * packed.cellHeight + packed.gutter,
        ]),
      );
      expect(program.fragmentShader).not.toContain("mod(float(index)");
      expect(program.fragmentShader).not.toContain("floor(float(index)");
      expect(program.fragmentShader).toContain(`tileSizes[${1 + 2 * count}]`);
      expect(program.fragmentShader).toContain(
        `origins[${Math.max(1, 2 * count)}]`,
      );
      for (let i = 0; i < count; i++) {
        const selected = resolveAxiomsFrame(
          resolveAxiomsReadingStops(artwork.layout)[i].arrival,
          artwork.layout,
        );
        expect(selected.selected).toBe(i);
        expect(selected.papers[i].emphasis).toBe(1);
        const uniforms = createAxiomsUniforms(artwork, selected, false);
        expect(uniforms.motions).toEqual(
          [...selected.fans, ...selected.papers].map((sheet) => [
            sheet.angle,
            Number(sheet.visible),
          ]),
        );
        for (const sheet of selected.papers.filter((paper) => paper.visible)) {
          expect(sheet.rect.y).toBeGreaterThan(artwork.layout.header.y);
          expect(sheet.rect.y + sheet.rect.height).toBeLessThan(
            viewport.height,
          );
        }
      }
      const samples = [0, 0.21, 0.5, 0.77, 1];
      const forward = samples.map((progress) =>
        resolveAxiomsFrame(progress, artwork.layout),
      );
      const reverse = [...samples]
        .reverse()
        .map((progress) => resolveAxiomsFrame(progress, artwork.layout))
        .reverse();
      expect(reverse).toEqual(forward);
    },
  );

  test("traces inward postage perforations on all four edges using shader geometry", () => {
    const context = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
    };
    const width = 720;
    const height = 480;
    const stamp = resolveAxiomsStamp(width, height);
    traceAxiomsStamp(context, width, height);
    expect(context.arc).toHaveBeenCalledTimes(2 * (stamp.columns + stamp.rows));
    expect(context.arc).toHaveBeenCalledWith(
      stamp.pitchX / 2,
      0,
      stamp.radius,
      Math.PI,
      0,
      true,
    );
    expect(context.arc).toHaveBeenCalledWith(
      width,
      stamp.pitchY / 2,
      stamp.radius,
      -Math.PI / 2,
      Math.PI / 2,
      true,
    );
    expect(context.arc).toHaveBeenCalledWith(
      stamp.pitchX / 2,
      height,
      stamp.radius,
      0,
      Math.PI,
      true,
    );
    expect(context.arc).toHaveBeenCalledWith(
      0,
      stamp.pitchY / 2,
      stamp.radius,
      Math.PI / 2,
      -Math.PI / 2,
      true,
    );
    expect(context.closePath).toHaveBeenCalledOnce();
  });

  test("fits complete perforation repeats to any paper size without overlapping holes", () => {
    for (const [width, height] of [
      [720, 480],
      [183, 221],
      [25, 40],
    ]) {
      const stamp = resolveAxiomsStamp(width, height);
      expect(stamp.pitchX * stamp.columns).toBeCloseTo(width);
      expect(stamp.pitchY * stamp.rows).toBeCloseTo(height);
      expect(stamp.radius * 2).toBeLessThan(
        Math.min(stamp.pitchX, stamp.pitchY),
      );
    }
    expect(resolveAxiomsStamp(183, 221).radius).toBeLessThan(
      resolveAxiomsStamp(720, 480).radius,
    );
  });

  test("keeps each article identity, size and translation together when reordered", () => {
    expect(new Set(heroAxiomsArticles.map((article) => article.id)).size).toBe(
      heroAxiomsArticles.length,
    );
    const reversed = [...heroAxiomsArticles].reverse();
    for (const locale of ["zh", "en"] as const) {
      const articles = localizeAxiomsArticles(reversed, locale);
      expect(articles.map((article) => article.id)).toEqual(
        reversed.map((article) => article.id),
      );
      expect(articles[0].title).toBe(reversed[0].translations[locale].title);
    }
  });

  test("extends reading distance instead of compressing additional articles into a fixed runway", () => {
    expect(resolveAxiomsScrollHeight(0)).toBe(100);
    expect(resolveAxiomsScrollHeight(4)).toBeCloseTo(460);
    expect(resolveAxiomsScrollHeight(8) - 100).toBe(
      2 * (resolveAxiomsScrollHeight(4) - 100),
    );
  });

  test("supports explicit paper proportions and rejects invalid dimensions", () => {
    const papers = [{ paper: { width: 0.91, height: 0.77 } }];
    const layout = resolveAxiomsLayout(viewport, papers);
    expect(layout.papers[0].width).toBeCloseTo(layout.paperArea.width * 0.91);
    expect(layout.papers[0].height).toBeCloseTo(layout.paperArea.height * 0.77);
    expect(() =>
      resolveAxiomsLayout(viewport, [{ paper: { width: 2, height: 0 } }]),
    ).toThrow(/fractions/);
  });

  test("prevents distant fan titles from wrapping around the circle into view", () => {
    const layout = resolveAxiomsLayout(
      viewport,
      Array.from({ length: 24 }, () => ({})),
    );
    const first = resolveAxiomsFrame(0, layout);
    expect(first.fans[0].visible).toBe(true);
    expect(first.fans[19].visible).toBe(false);
    const later = resolveAxiomsFrame(19 / 23, layout);
    expect(later.fans[19].visible).toBe(true);
    expect(later.fans[0].visible).toBe(false);
  });
});
