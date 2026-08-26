import { describe, expect, test } from "vitest";

import {
  getHeroChapterDefinition,
  heroChapterDefinitions,
  heroChapterOrder,
} from "../src/chapters/definitions";

describe("hero chapter definitions", () => {
  test("binds every narrative chapter to one signal pair, face, and atlas slot", () => {
    expect(heroChapterOrder).toEqual(["self", "axioms", "builds", "signals"]);
    expect(
      heroChapterOrder.map((chapterId) =>
        getHeroChapterDefinition(chapterId).signals,
      ),
    ).toEqual([
      { entry: "hero.chapter-1.entry", exit: "hero.chapter-1.exit" },
      { entry: "hero.chapter-2.entry", exit: "hero.chapter-2.exit" },
      { entry: "hero.chapter-3.entry", exit: "hero.chapter-3.exit" },
      { entry: "hero.chapter-4.entry", exit: "hero.chapter-4.exit" },
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
  });
});
