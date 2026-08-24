import { describe, expect, test } from "vitest";

import {
  readHeroChapterScrollState,
  resolveHeroChapterScrollState,
} from "../src/heroChapterScroll";
import { heroTransitionConfig } from "../src/heroTransitionConfig";

describe("chapter one scroll resolver", () => {
  test.each([
    [0, 0, "hub-start"],
    [0.1, 0, "orient-approach"],
    [0.32, 0, "face-approach"],
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

  test("locks content only at the approach boundary and holds it through curtain motion", () => {
    const { entry, exit } = heroTransitionConfig.chapterScroll;
    const beforeLock = resolveHeroChapterScrollState(entry.lockEnd - 0.001, 0);
    const entryLock = resolveHeroChapterScrollState(
      entry.lockEnd,
      0,
    );
    const revealed = resolveHeroChapterScrollState(1, 0);
    const beforeUnlock = resolveHeroChapterScrollState(
      1,
      exit.contractEnd - 0.001,
    );
    const detached = resolveHeroChapterScrollState(
      1,
      exit.contractEnd + 0.001,
    );

    expect(beforeLock.screenLock).toBe(0);
    expect(beforeLock.approach).toBeLessThan(1);
    expect(entryLock).toMatchObject({
      approach: 1,
      screenLock: 1,
      triangleReveal: 0,
    });
    expect(revealed).toMatchObject({
      screenLock: 1,
      triangleReveal: 1,
      domContentActive: true,
    });
    expect(beforeUnlock).toMatchObject({
      screenLock: 1,
    });
    expect(detached).toMatchObject({
      screenLock: 0,
    });
    expect(detached.approach).toBeGreaterThan(0);
    expect(detached.approach).toBeLessThan(1);
  });

  test("rotates and approaches together, then keeps the aligned rotation stable", () => {
    const { entry, exit } = heroTransitionConfig.chapterScroll;
    const orientMidpoint = resolveHeroChapterScrollState(entry.orientEnd / 2, 0);
    const aligned = resolveHeroChapterScrollState(entry.orientEnd, 0);
    const approachMidpoint = resolveHeroChapterScrollState(
      (entry.orientEnd + entry.lockEnd) / 2,
      0,
    );
    const locked = resolveHeroChapterScrollState(entry.lockEnd, 0);
    const retreatMidpoint = resolveHeroChapterScrollState(
      1,
      (exit.contractEnd + exit.retreatEnd) / 2,
    );
    const orientRetreat = resolveHeroChapterScrollState(
      1,
      (exit.retreatEnd + 1) / 2,
    );

    expect(orientMidpoint.orientation).toBeGreaterThan(0);
    expect(orientMidpoint.orientation).toBeLessThan(1);
    expect(orientMidpoint.approach).toBeGreaterThan(0);
    expect(aligned.orientation).toBe(1);
    expect(aligned.approach).toBeGreaterThan(orientMidpoint.approach);
    expect(aligned.approach).toBeLessThan(approachMidpoint.approach);
    expect(approachMidpoint.orientation).toBe(1);
    expect(approachMidpoint.screenLock).toBe(0);
    expect(locked).toMatchObject({ approach: 1, screenLock: 1 });

    expect(retreatMidpoint).toMatchObject({
      phase: "face-retreat",
      orientation: 1,
      screenLock: 0,
    });
    expect(retreatMidpoint.approach).toBeLessThan(1);
    expect(orientRetreat.phase).toBe("orient-retreat");
    expect(orientRetreat.orientation).toBeLessThan(1);
    expect(orientRetreat.approach).toBeGreaterThan(0);
    expect(orientRetreat.approach).toBeLessThan(retreatMidpoint.approach);
  });

  test("reads one entry and exit signal pair and gates themes only at complete Hubs", () => {
    const values = new Map<string, number>();
    const reader = { get: (key: string) => values.get(key) ?? 0 };

    expect(readHeroChapterScrollState(reader).hubInteractive).toBe(true);
    values.set(heroTransitionConfig.signalKeys.chapterEntry, 0.01);
    expect(readHeroChapterScrollState(reader).hubInteractive).toBe(false);
    values.set(heroTransitionConfig.signalKeys.chapterEntry, 1);
    expect(readHeroChapterScrollState(reader).domContentActive).toBe(true);
    values.set(heroTransitionConfig.signalKeys.chapterExit, 1);
    expect(readHeroChapterScrollState(reader).hubInteractive).toBe(true);
  });
});
