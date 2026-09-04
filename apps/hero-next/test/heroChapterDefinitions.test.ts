import { describe, expect, test } from "vitest";

import {
  formatHeroChapterCounter,
  getHeroChapterDefinition,
  heroChapterDefinitions,
  heroChapterOrder,
} from "../src/chapters/definitions";

describe("hero chapter definitions", () => {
  test("binds every narrative chapter to content, entry, body, and exit signals", () => {
    expect(heroChapterOrder).toEqual(["self", "axioms", "builds", "signals"]);
    expect(
      heroChapterOrder.map(
        (chapterId) => getHeroChapterDefinition(chapterId).signals,
      ),
    ).toEqual([
      {
        content: "hero.chapter-1.content",
        entry: "hero.chapter-1.entry",
        body: "hero.chapter-1.body",
        exit: "hero.chapter-1.exit",
      },
      {
        content: "hero.chapter-2.content",
        entry: "hero.chapter-2.entry",
        body: "hero.chapter-2.body",
        exit: "hero.chapter-2.exit",
      },
      {
        content: "hero.chapter-3.content",
        entry: "hero.chapter-3.entry",
        body: "hero.chapter-3.body",
        exit: "hero.chapter-3.exit",
      },
      {
        content: "hero.chapter-4.content",
        entry: "hero.chapter-4.entry",
        body: "hero.chapter-4.body",
        exit: "hero.chapter-4.exit",
      },
    ]);
    expect(
      new Set(
        heroChapterOrder.map((chapterId) =>
          heroChapterDefinitions[chapterId].atlas.uvOffset.join(","),
        ),
      ).size,
    ).toBe(heroChapterOrder.length);
    expect(
      new Set(
        heroChapterOrder.map((chapterId) =>
          heroChapterDefinitions[chapterId].face.normal.join(","),
        ),
      ).size,
    ).toBe(heroChapterOrder.length);
    expect(formatHeroChapterCounter(heroChapterDefinitions.self)).toBe(
      "01 / 04",
    );
  });
});
