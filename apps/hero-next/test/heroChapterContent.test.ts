import { describe, expect, test } from "vitest";

import {
  getHeroChapterContent,
  heroChapterContent,
  heroPublicLinks,
} from "../src/chapters/content";
import {
  heroChapterDefinitions,
  heroChapterOrder,
} from "../src/chapters/definitions";

describe("hero chapter content", () => {
  test("defines four stable bilingual chapters in narrative order", () => {
    expect(Object.keys(heroChapterContent)).toHaveLength(
      heroChapterOrder.length,
    );
    expect(
      heroChapterOrder.map(
        (chapterId) => heroChapterDefinitions[chapterId].number,
      ),
    ).toEqual(["01", "02", "03", "04"]);

    for (const chapterId of heroChapterOrder) {
      for (const locale of ["zh", "en"] as const) {
        const content = getHeroChapterContent(chapterId, locale);
        expect(content.faceLabel.length).toBeGreaterThan(0);
        expect(content.frame.titleLines.length).toBeGreaterThan(0);
        expect(content.frame.summary.length).toBeGreaterThan(0);
        expect(content.frame.signals).toHaveLength(2);
        expect(content.portal.left.body.length).toBeGreaterThan(0);
        expect(content.portal.right.items.length).toBeGreaterThan(0);
        expect(content.body.sections.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test("uses verified public destinations without inventing private contact data", () => {
    expect(heroPublicLinks.githubProfile).toBe(
      "https://github.com/agenticnoob",
    );
    expect(heroPublicLinks.currentProject).toBe(
      "https://github.com/agenticnoob/dom-webgl-workspace",
    );
    expect(heroPublicLinks.blog).toBe("https://blog.zzzxc.com");
    expect(Object.keys(heroPublicLinks)).not.toContain("email");
    expect(Object.keys(heroPublicLinks)).not.toContain("phone");
  });
});
