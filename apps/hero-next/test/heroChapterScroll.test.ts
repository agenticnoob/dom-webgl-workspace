import { describe, expect, test } from "vitest";

import {
  readHeroChapterExitFrameIds,
  readHeroChapterScrollState,
  resolveHeroChapterScrollState,
} from "../src/chapters/scrollState";
import {
  heroChapterDefinitions,
  heroChapterOrder,
} from "../src/chapters/definitions";
import { heroTransitionConfig } from "../src/transition/transitionConfig";

describe("hero chapter scroll resolver", () => {
  test.each([
    [0, 0, "hub-start"],
    [0.1, 0, "intro-handoff"],
    [0.32, 0, "orient-approach"],
    [0.53, 0, "face-approach"],
    [0.8, 0, "triangle-reveal"],
    [1, 0, "dom-content"],
    [1, 0.2, "triangle-contract"],
    [1, 0.45, "face-retreat"],
    [1, 0.65, "face-retreat"],
    [1, 0.9, "orient-retreat"],
    [1, 1, "hub-end"],
  ] as const)(
    "resolves entry %s and exit %s to %s",
    (entry, exit, expectedPhase) => {
      expect(resolveHeroChapterScrollState(entry, exit).phase).toBe(
        expectedPhase,
      );
    },
  );

  test("hands site copy to chapter one before starting any tetrahedron flight", () => {
    const { introHandoffEnd } = heroTransitionConfig.chapterScroll.entry;
    const midpoint = resolveHeroChapterScrollState(introHandoffEnd / 2, 0);
    const handoffEnd = resolveHeroChapterScrollState(introHandoffEnd, 0);

    expect(midpoint).toMatchObject({
      phase: "intro-handoff",
      introHandoff: 0.5,
      orientation: 0,
      approach: 0,
      screenLock: 0,
      hubInteractive: true,
    });
    expect(handoffEnd).toMatchObject({
      phase: "orient-approach",
      introHandoff: 1,
      orientation: 0,
      approach: 0,
      hubInteractive: false,
    });
  });

  test("reconstructs identical frames when the same coordinates are visited in reverse", () => {
    const coordinates = [
      [0, 0],
      [0.12, 0],
      [0.38, 0],
      [0.57, 0],
      [0.86, 0],
      [1, 0],
      [1, 0.26],
      [1, 0.47],
      [1, 0.71],
      [1, 0.94],
      [1, 1],
    ] as const;
    const forward = coordinates.map(([entry, exit]) =>
      resolveHeroChapterScrollState(entry, exit),
    );
    const reverse = [...coordinates]
      .reverse()
      .map(([entry, exit]) => resolveHeroChapterScrollState(entry, exit));

    expect(reverse).toEqual([...forward].reverse());
  });

  test("locks content progressively while the final rotating approach reveals it", () => {
    const { entry, exit } = heroTransitionConfig.chapterScroll;
    const beforeLock = resolveHeroChapterScrollState(
      firstChapterFlightEntry(entry.lockEnd) - 0.001,
      0,
    );
    const entryLock = resolveHeroChapterScrollState(
      firstChapterFlightEntry(entry.lockEnd),
      0,
    );
    const revealMidpoint = resolveHeroChapterScrollState(
      firstChapterFlightEntry((entry.lockEnd + 1) / 2),
      0,
    );
    const revealed = resolveHeroChapterScrollState(1, 0);
    const beforeUnlock = resolveHeroChapterScrollState(
      1,
      exit.contractEnd - 0.001,
    );
    const detached = resolveHeroChapterScrollState(1, exit.contractEnd + 0.001);

    expect(beforeLock.screenLock).toBe(0);
    expect(beforeLock.approach).toBeLessThan(1);
    expect(entryLock).toMatchObject({
      approach: 1,
      screenLock: 0,
      triangleReveal: 0,
    });
    expect(revealMidpoint.orientation).toBeGreaterThan(entryLock.orientation);
    expect(revealMidpoint.orientation).toBeLessThan(1);
    expect(revealMidpoint.screenLock).toBeGreaterThan(0);
    expect(revealMidpoint.screenLock).toBeLessThan(1);
    expect(revealMidpoint.screenLock).toBe(revealMidpoint.triangleReveal);
    expect(revealed).toMatchObject({
      orientation: 1,
      screenLock: 1,
      triangleReveal: 1,
      domContentActive: true,
    });
    expect(beforeUnlock.screenLock).toBeGreaterThan(0);
    expect(beforeUnlock.screenLock).toBeLessThan(1);
    expect(beforeUnlock.screenLock).toBe(beforeUnlock.triangleReveal);
    expect(beforeUnlock.orientation).toBeGreaterThan(entryLock.orientation);
    expect(beforeUnlock.orientation).toBeLessThan(1);
    expect(detached).toMatchObject({
      screenLock: 0,
    });
    expect(detached.approach).toBeGreaterThan(0);
    expect(detached.approach).toBeLessThan(1);
  });

  test("rotates and approaches together through the full spatial flight", () => {
    const { entry, exit } = heroTransitionConfig.chapterScroll;
    const orientMidpoint = resolveHeroChapterScrollState(
      entry.orientEnd / 2,
      0,
      "axioms",
    );
    const aligned = resolveHeroChapterScrollState(entry.orientEnd, 0, "axioms");
    const approachMidpoint = resolveHeroChapterScrollState(
      (entry.orientEnd + entry.lockEnd) / 2,
      0,
      "axioms",
    );
    const locked = resolveHeroChapterScrollState(entry.lockEnd, 0, "axioms");
    const revealMidpoint = resolveHeroChapterScrollState(
      (entry.lockEnd + 1) / 2,
      0,
      "axioms",
    );
    const revealed = resolveHeroChapterScrollState(1, 0, "axioms");
    const retreatMidpoint = resolveHeroChapterScrollState(
      1,
      (exit.contractEnd + exit.retreatEnd) / 2,
      "axioms",
    );
    const orientRetreat = resolveHeroChapterScrollState(
      1,
      (exit.retreatEnd + 1) / 2,
      "axioms",
    );

    expect(orientMidpoint.orientation).toBeGreaterThan(0);
    expect(orientMidpoint.orientation).toBeLessThan(1);
    expect(orientMidpoint.approach).toBeGreaterThan(0);
    expect(aligned.orientation).toBeLessThan(approachMidpoint.orientation);
    expect(aligned.approach).toBeGreaterThan(orientMidpoint.approach);
    expect(aligned.approach).toBeLessThan(approachMidpoint.approach);
    expect(approachMidpoint.orientation).toBeGreaterThan(aligned.orientation);
    expect(approachMidpoint.orientation).toBeLessThan(1);
    expect(approachMidpoint.screenLock).toBe(0);
    expect(locked).toMatchObject({ approach: 1, screenLock: 0 });
    expect(locked.orientation).toBeLessThan(1);
    expect(revealMidpoint.orientation).toBeGreaterThan(locked.orientation);
    expect(revealMidpoint.orientation).toBeLessThan(1);
    expect(revealMidpoint.approach).toBe(1);
    expect(revealMidpoint.screenLock).toBeGreaterThan(0);
    expect(revealed).toMatchObject({
      orientation: 1,
      approach: 1,
      screenLock: 1,
    });

    expect(retreatMidpoint).toMatchObject({
      phase: "face-retreat",
      screenLock: 0,
    });
    expect(retreatMidpoint.orientation).toBeGreaterThan(0);
    expect(retreatMidpoint.orientation).toBeLessThan(1);
    expect(retreatMidpoint.approach).toBeLessThan(1);
    expect(orientRetreat.phase).toBe("orient-retreat");
    expect(orientRetreat.orientation).toBeLessThan(retreatMidpoint.orientation);
    expect(orientRetreat.approach).toBeGreaterThan(0);
    expect(orientRetreat.approach).toBeLessThan(retreatMidpoint.approach);
  });

  test("reads one entry and exit signal pair and gates themes only at complete Hubs", () => {
    const values = new Map<string, number>();
    const reader = { get: (key: string) => values.get(key) ?? 0 };
    const chapterOne = heroChapterDefinitions.self.signals;

    expect(readHeroChapterScrollState(reader).hubInteractive).toBe(true);
    values.set(chapterOne.entry, 0.01);
    expect(readHeroChapterScrollState(reader).hubInteractive).toBe(true);
    values.set(
      chapterOne.entry,
      heroTransitionConfig.chapterScroll.entry.introHandoffEnd + 0.01,
    );
    expect(readHeroChapterScrollState(reader).hubInteractive).toBe(false);
    values.set(chapterOne.entry, 1);
    expect(readHeroChapterScrollState(reader).domContentActive).toBe(true);
    values.set(chapterOne.exit, 1);
    expect(readHeroChapterScrollState(reader).hubInteractive).toBe(true);
  });

  test("selects the latest active chapter while preserving complete intermediate Hubs", () => {
    const values = new Map<string, number>();
    const reader = { get: (key: string) => values.get(key) ?? 0 };
    const chapterOne = heroChapterDefinitions.self.signals;
    const chapterTwo = heroChapterDefinitions.axioms.signals;
    const chapterFour = heroChapterDefinitions.signals.signals;

    expect(readHeroChapterScrollState(reader)).toMatchObject({
      chapterId: heroChapterOrder[0],
      phase: "hub-start",
      hubInteractive: true,
    });

    values.set(chapterOne.entry, 1);
    values.set(chapterOne.exit, 1);
    expect(readHeroChapterScrollState(reader)).toMatchObject({
      chapterId: "self",
      phase: "hub-end",
      hubInteractive: true,
    });

    values.set(chapterTwo.entry, 0.4);
    expect(readHeroChapterScrollState(reader)).toMatchObject({
      chapterId: "axioms",
      phase: "face-approach",
      hubInteractive: false,
    });

    values.set(chapterTwo.entry, 1);
    expect(readHeroChapterScrollState(reader)).toMatchObject({
      chapterId: "axioms",
      phase: "dom-content",
      domContentActive: true,
    });

    values.set(chapterFour.entry, 1);
    values.set(chapterFour.exit, 1);
    expect(readHeroChapterScrollState(reader)).toMatchObject({
      chapterId: "signals",
      phase: "hub-end",
      hubInteractive: true,
    });
  });

  test("retains completed exit frames across later entries and removes them only when reversed", () => {
    const values = new Map<string, number>();
    const reader = { get: (key: string) => values.get(key) ?? 0 };
    const chapterOne = heroChapterDefinitions.self.signals;
    const chapterTwo = heroChapterDefinitions.axioms.signals;

    values.set(chapterOne.exit, 1);
    values.set(chapterTwo.entry, 0.25);
    expect(readHeroChapterExitFrameIds(reader)).toEqual(["self"]);

    values.set(chapterTwo.exit, 0.01);
    expect(readHeroChapterExitFrameIds(reader)).toEqual(["self", "axioms"]);

    values.set(chapterTwo.exit, 0);
    expect(readHeroChapterExitFrameIds(reader)).toEqual(["self"]);
    values.set(chapterOne.exit, 0);
    expect(readHeroChapterExitFrameIds(reader)).toEqual([]);
  });
});

function firstChapterFlightEntry(flightProgress: number): number {
  const { introHandoffEnd } = heroTransitionConfig.chapterScroll.entry;
  return introHandoffEnd + (1 - introHandoffEnd) * flightProgress;
}
