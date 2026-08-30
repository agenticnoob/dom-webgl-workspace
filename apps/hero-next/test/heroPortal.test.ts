import { describe, expect, test } from "vitest";

import { heroChapterDefinitions } from "../src/chapters/definitions";
import { resolveHeroChapterScrollState } from "../src/chapters/scrollState";
import {
  resolveHeroPortalMotion,
  resolveHeroPortalRenderKey,
  resolveHeroPortalViewState,
} from "../src/transition/portalState";
import { heroTransitionConfig } from "../src/transition/transitionConfig";

describe("hero portal state", () => {
  test("crossfades the site introduction and first chapter while the tetrahedron stays at Hub", () => {
    const handoffEnd = heroTransitionConfig.chapterScroll.entry.introHandoffEnd;
    const initial = resolveHeroPortalViewState(
      resolveHeroChapterScrollState(0, 0),
    );
    const midpoint = resolveHeroPortalViewState(
      resolveHeroChapterScrollState(handoffEnd / 2, 0),
    );
    const completed = resolveHeroPortalViewState(
      resolveHeroChapterScrollState(handoffEnd, 0),
    );

    expect(initial).toEqual({
      activeContentId: "self",
      sitePresence: 1,
      contentPresence: 0,
    });
    expect(midpoint).toEqual({
      activeContentId: "self",
      sitePresence: 0.5,
      contentPresence: 0.5,
    });
    expect(completed).toEqual({
      activeContentId: "self",
      sitePresence: 0,
      contentPresence: 1,
    });

    expect(
      resolveHeroPortalMotion(midpoint, {
        contentId: "site",
        side: "left",
      }),
    ).toMatchObject({ opacity: 0.5, horizontalOffsetProgress: -0.5 });
    expect(
      resolveHeroPortalMotion(midpoint, {
        contentId: "self",
        side: "right",
      }),
    ).toMatchObject({ opacity: 0.5, horizontalOffsetProgress: -0.5 });
  });

  test("preselects the next chapter as soon as the covered exit begins", () => {
    const beforeExit = resolveHeroPortalViewState(
      resolveHeroChapterScrollState(1, 0, "self"),
    );
    const coveredExit = resolveHeroPortalViewState(
      resolveHeroChapterScrollState(1, 0.001, "self"),
    );
    const finalExit = resolveHeroPortalViewState(
      resolveHeroChapterScrollState(1, 0.5, "signals"),
    );
    const completedFinalExit = resolveHeroPortalViewState(
      resolveHeroChapterScrollState(1, 1, "signals"),
    );

    expect(beforeExit.activeContentId).toBe("self");
    expect(coveredExit).toMatchObject({
      activeContentId: "axioms",
      contentPresence: 1,
    });
    expect(finalExit.activeContentId).toBe("contact");
    expect(completedFinalExit).toEqual({
      activeContentId: undefined,
      sitePresence: 0,
      contentPresence: 0,
    });
    expect(
      resolveHeroPortalMotion(coveredExit, {
        contentId: "axioms",
        side: "left",
      }),
    ).toEqual({ visible: true, opacity: 1, horizontalOffsetProgress: 0 });
  });

  test("changes the React render key only at semantic handoff boundaries", () => {
    const values = new Map<string, number>();
    const reader = { get: (key: string) => values.get(key) ?? 0 };
    const first = heroChapterDefinitions.self.signals;

    expect(resolveHeroPortalRenderKey(reader)).toBe("site");
    values.set(
      first.entry,
      heroTransitionConfig.chapterScroll.entry.introHandoffEnd / 2,
    );
    expect(resolveHeroPortalRenderKey(reader)).toBe("site+content");
    values.set(first.entry, 1);
    expect(resolveHeroPortalRenderKey(reader)).toBe("self");
    values.set(first.exit, 0.001);
    expect(resolveHeroPortalRenderKey(reader)).toBe("axioms");
  });

  test("routes the last chapter exit to the terminal contact content", () => {
    const values = new Map<string, number>();
    const reader = { get: (key: string) => values.get(key) ?? 0 };
    const last = heroChapterDefinitions.signals.signals;

    values.set(last.entry, 1);
    expect(resolveHeroPortalRenderKey(reader)).toBe("signals");

    values.set(last.exit, 0.001);
    expect(resolveHeroPortalRenderKey(reader)).toBe("contact");

    values.set(last.exit, 1);
    expect(resolveHeroPortalRenderKey(reader)).toBe("none");

    values.set(last.exit, 0);
    expect(resolveHeroPortalRenderKey(reader)).toBe("signals");
  });
});
