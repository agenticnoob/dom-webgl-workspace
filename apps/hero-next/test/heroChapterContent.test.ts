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
        expect(content).not.toHaveProperty("frame");
        expect(content).not.toHaveProperty("exitFrame");
        expect(content.body.eyebrow.length).toBeGreaterThan(0);
        expect(content.body.title.length).toBeGreaterThan(0);
        expect(content.body.intro.length).toBeGreaterThan(0);
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

  test("frames the profile as a literary path grounded in stable biography", () => {
    const profile = getHeroChapterContent("self", "zh");

    expect(profile.body.eyebrow).toContain("SELF");
    expect(profile.body.intro).toContain("1994 年生");
    expect(profile.body.sections).toHaveLength(5);
    expect(profile.body.sections.map((section) => section.label)).toEqual([
      "2012—2014 / 晨光",
      "2014—2018 / 书页",
      "2018—后来 / 像素",
      "转身 / 无固定席位",
      "此刻 / 未完成",
    ]);
    expect(profile.body.closing).toContain("暂时落下的坐标");
  });
});
