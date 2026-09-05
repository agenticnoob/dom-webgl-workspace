import { describe, expect, test } from "vitest";
import {
  resolveAxiomsFrame,
  resolveAxiomsReadingStops,
} from "../src/axioms/frame";
import { resolveAxiomsLayout } from "../src/axioms/layout";
import { createAxiomsArtwork } from "../src/axioms/artwork";
import { getAxiomsContent } from "../src/axioms/content";
import { createAxiomsUniforms } from "../src/axioms/program";

const layout = resolveAxiomsLayout(
  { width: 1440, height: 900 },
  Array.from({ length: 4 }, () => ({})),
);

describe("axioms scroll reader", () => {
  test.each(["zh", "en"] as const)(
    "typesets complete %s titles and body text for narrow screens",
    (locale) => {
      const measure = {
        font: "",
        letterSpacing: "0px",
        measureText(text: string) {
          const size = Number.parseFloat(
            this.font.match(/([\d.]+)px/)?.[1] ?? "16",
          );
          return {
            width: Array.from(text).reduce(
              (sum, char) =>
                sum + size * (/\p{Script=Han}/u.test(char) ? 1 : 0.6),
              0,
            ),
          };
        },
      };
      const content = getAxiomsContent(locale).body;
      const artwork = createAxiomsArtwork(
        measure,
        { width: 320, height: 568 },
        content,
        "02 / 04 · AXIOMS",
      );
      const lastHeader = artwork.header.lines.at(-1);
      expect(lastHeader).toBeDefined();
      expect(
        artwork.layout.header.y +
          (lastHeader?.y ?? 0) +
          (lastHeader?.size ?? 0),
      ).toBeLessThan(artwork.layout.paperArea.y);
      for (const [i, fan] of artwork.fans.entries()) {
        expect(
          fan.lines
            .map((line) => line.text)
            .join("")
            .replace(/\s/g, ""),
        ).toContain(content.sections[i].title.replace(/\s/g, ""));
        expect(
          Math.max(...fan.lines.map((line) => line.y + line.size)),
        ).toBeLessThan(fan.height);
        const paper = artwork.papers[i];
        expect(
          paper.lines
            .map((line) => line.text)
            .join("")
            .replace(/\s/g, ""),
        ).toContain(content.sections[i].body.replace(/\s/g, ""));
        const frame = resolveAxiomsFrame(
          resolveAxiomsReadingStops(artwork.layout)[i].readEnd,
          artwork.layout,
        );
        const uniforms = createAxiomsUniforms(artwork, frame, false);
        const scrolls = uniforms.scrolls;
        expect(scrolls).toEqual(
          expect.arrayContaining([
            [Math.max(0, paper.height - artwork.layout.papers[i].height), 0],
          ]),
        );
        expect(artwork.layout.papers[i].height).toBeGreaterThan(120);
      }
    },
  );
  test("maps every scroll increment directly to motion without fixed reading holds", () => {
    for (let i = 0; i < 4; i++) {
      const frame = resolveAxiomsFrame(i / 3, layout);
      expect(frame.selected).toBe(i);
      expect(frame.cursor).toBe(i);
      expect(frame.fans[i].emphasis).toBe(1);
      expect(frame.papers[i].rect.height).toBe(layout.papers[i].height);
    }
    for (let step = 0; step <= 100; step++) {
      expect(resolveAxiomsFrame(step / 100, layout).cursor).toBeCloseTo(
        step * 0.03,
      );
    }
    expect(resolveAxiomsFrame(1, layout).selected).toBe(3);
  });

  test("moves the old title upwards and the incoming title towards the same circular focus", () => {
    const start = resolveAxiomsFrame(0, layout);
    const middle = resolveAxiomsFrame(1 / 6, layout);
    const end = resolveAxiomsFrame(1 / 3, layout);
    expect(middle.fans[0].rect.y).toBeLessThan(start.fans[0].rect.y);
    expect(middle.fans[1].rect.y).toBeLessThan(start.fans[1].rect.y);
    expect(end.fans[1].rect).toEqual(start.fans[0].rect);
    expect(middle.papers[0]).toEqual(start.papers[0]);
    expect(middle.papers[1].rect.height).toBe(end.papers[1].rect.height);
    expect(middle.papers[1].rect.width).toBe(end.papers[1].rect.width);
    expect(start.papers[1].visible).toBe(false);
    expect(start.papers[1].rect.x).toBeGreaterThan(layout.viewport.width);
    expect(middle.papers[1].visible).toBe(true);
    expect(middle.papers[1].rect.x).toBeGreaterThan(end.papers[1].rect.x);
    expect(middle.papers[1].rect.x).toBeLessThan(start.papers[1].rect.x);
    expect(middle.papers[1].angle).not.toBe(0);
    expect(end.papers[1].angle).toBe(0);
  });

  test("keeps motion continuous through a selection boundary and retraces it in reverse", () => {
    const samples = [0, 0.16, 0.20249, 0.20251, 0.25, 0.45, 0.75, 1];
    const forward = samples.map((p) => resolveAxiomsFrame(p, layout));
    const reverse = [...samples]
      .reverse()
      .map((p) => resolveAxiomsFrame(p, layout))
      .reverse();
    expect(reverse).toEqual(forward);
    for (let i = 0; i < 4; i++) {
      expect(
        Math.abs(
          forward[2].papers[i].rect.height - forward[3].papers[i].rect.height,
        ),
      ).toBeLessThan(1);
      expect(
        Math.abs(forward[2].papers[i].rect.y - forward[3].papers[i].rect.y),
      ).toBeLessThan(1);
    }
  });

  test("finishes overflow reading before turning, including the last article", () => {
    const overflowing = { ...layout, paperOverflow: [450, 0, 0, 900] };
    const stops = resolveAxiomsReadingStops(overflowing);
    expect(stops[0].readEnd).toBeCloseTo(1 / 9);
    expect(stops[3].arrival).toBeCloseTo(7 / 9);
    expect(resolveAxiomsFrame(0, overflowing).papers[0].scroll).toBe(0);
    expect(
      resolveAxiomsFrame(1 / 18, overflowing).papers[0].scroll,
    ).toBeCloseTo(0.5);
    expect(resolveAxiomsFrame(1 / 18, overflowing).cursor).toBe(0);
    expect(
      resolveAxiomsFrame(stops[0].readEnd, overflowing).papers[0].scroll,
    ).toBe(1);
    expect(
      resolveAxiomsFrame(stops[3].arrival, overflowing).papers[3].scroll,
    ).toBe(0);
    expect(resolveAxiomsFrame(8 / 9, overflowing).papers[3].scroll).toBeCloseTo(
      0.5,
    );
    expect(resolveAxiomsFrame(1, overflowing).papers[3].scroll).toBe(1);
  });

  test("keeps full-sized older cards underneath and future cards outside the viewport", () => {
    for (let i = 0; i < layout.papers.length; i++) {
      const current = resolveAxiomsFrame(
        i / (layout.papers.length - 1),
        layout,
      );
      expect(current.papers.filter((paper) => paper.visible)).toHaveLength(
        i + 1,
      );
      for (let j = 0; j <= i; j++) {
        expect(current.papers[j].rect).toEqual(
          resolveAxiomsFrame(j / (layout.papers.length - 1), layout).papers[j]
            .rect,
        );
      }
    }
  });

  test("uses an arcing path instead of a straight slide and retraces the same incoming card", () => {
    const start = resolveAxiomsFrame(0, layout).papers[1].rect;
    const middle = resolveAxiomsFrame(1 / 6, layout).papers[1].rect;
    const end = resolveAxiomsFrame(1 / 3, layout).papers[1].rect;
    const linearY =
      start.y + (end.y - start.y) * ((middle.x - start.x) / (end.x - start.x));
    expect(middle.y).toBeLessThan(linearY - 10);
    const forward = resolveAxiomsFrame(0.22, layout);
    resolveAxiomsFrame(0.3, layout);
    expect(resolveAxiomsFrame(0.22, layout)).toEqual(forward);
  });

  test.each([
    { width: 375, height: 812 },
    { width: 320, height: 568 },
    { width: 1440, height: 900 },
  ])(
    "keeps selected paper inside the %j viewport with distinct paper sizes",
    (viewport) => {
      const responsive = resolveAxiomsLayout(
        viewport,
        Array.from({ length: 4 }, () => ({})),
      );
      expect(new Set(responsive.papers.map((paper) => paper.width)).size).toBe(
        4,
      );
      for (let i = 0; i < 4; i++) {
        const paper = resolveAxiomsFrame(i / 3, responsive).papers[i].rect;
        expect(paper.x).toBeGreaterThan(0);
        expect(paper.x + paper.width).toBeLessThan(viewport.width);
        expect(paper.y).toBeGreaterThan(responsive.header.y);
        expect(paper.y + paper.height).toBeLessThan(viewport.height);
      }
    },
  );

  test("reduced motion keeps every proposition and exact entry/exit composition", () => {
    for (const p of [0, 1 / 3, 2 / 3, 1]) {
      expect(resolveAxiomsFrame(p, layout, true)).toEqual(
        resolveAxiomsFrame(p, layout),
      );
    }
    expect(resolveAxiomsFrame(0.1, layout, true).fans[0].rect).toEqual(
      resolveAxiomsFrame(0, layout).fans[0].rect,
    );
    expect(resolveAxiomsFrame(Number.NaN, layout)).toEqual(
      resolveAxiomsFrame(0, layout),
    );
  });
});
