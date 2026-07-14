import { describe, expect, test } from "vitest";

import {
  heroGhostBackgroundEffect,
  heroGhostEffects,
  resolveHeroGhostOverscanScale,
} from "../src/heroGhostEffects";

describe("hero Ghost Cursor effects", () => {
  test("registers only the frame-scheduled background effect", () => {
    expect(heroGhostBackgroundEffect).toMatchObject({
      kind: "hero.ghost.background",
      source: "dom/element",
      schedule: "frame",
    });
    expect(heroGhostEffects).toEqual([heroGhostBackgroundEffect]);
  });

  test("resolves responsive world scale with six-percent overscan", () => {
    expect(
      resolveHeroGhostOverscanScale({
        width: 2048,
        height: 403,
        viewportHeight: 403,
        depth: 5,
        fov: 38,
        overscan: 1.06,
      }),
    ).toEqual([
      expect.closeTo(18.548236455, 9),
      expect.closeTo(3.649872701, 9),
      1,
    ]);
  });
});
