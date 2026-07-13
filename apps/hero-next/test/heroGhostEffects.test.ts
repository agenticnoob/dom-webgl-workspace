import { describe, expect, test } from "vitest";

import {
  heroGhostBackgroundEffect,
  heroGhostEffects,
  heroGhostForegroundEffect,
} from "../src/heroGhostEffects";

describe("hero Ghost Cursor effects", () => {
  test("registers two frame-scheduled dom element effects", () => {
    expect(heroGhostBackgroundEffect).toMatchObject({
      kind: "hero.ghost.background",
      source: "dom/element",
      schedule: "frame",
    });
    expect(heroGhostForegroundEffect).toMatchObject({
      kind: "hero.ghost.foreground",
      source: "dom/element",
      schedule: "frame",
    });
    expect(heroGhostEffects).toEqual([
      heroGhostBackgroundEffect,
      heroGhostForegroundEffect,
    ]);
  });
});
