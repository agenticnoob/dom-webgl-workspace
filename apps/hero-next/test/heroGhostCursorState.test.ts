import { describe, expect, test } from "vitest";

import {
  createHeroGhostCursorState,
  stepHeroGhostCursorState,
} from "../src/ghost/cursorState";

describe("hero Ghost Cursor state", () => {
  test("smooths active pointer input and prepends a background trail", () => {
    const state = createHeroGhostCursorState("background", 1000, 800, false);

    stepHeroGhostCursorState(state, {
      active: true,
      x: 700,
      y: 300,
    });

    expect(state.pointerX).toBe(588);
    expect(state.pointerY).toBe(356);
    expect(state.intensity).toBe(0.36);
    expect(state.trail[0]).toEqual([588, 356]);
    expect(state.trail).toHaveLength(36);
  });

  test("decays foreground smoke faster than background smoke", () => {
    const background = createHeroGhostCursorState("background", 1000, 800, false);
    const foreground = createHeroGhostCursorState("foreground", 1000, 800, false);
    background.intensity = 1;
    foreground.intensity = 1;

    stepHeroGhostCursorState(background, { active: false, x: 500, y: 400 });
    stepHeroGhostCursorState(foreground, { active: false, x: 500, y: 400 });

    expect(background.intensity).toBe(0.82);
    expect(foreground.intensity).toBe(0.68);
  });

  test("freezes a static background and removes foreground in reduced motion", () => {
    const background = createHeroGhostCursorState("background", 1000, 800, true);
    const foreground = createHeroGhostCursorState("foreground", 1000, 800, true);

    stepHeroGhostCursorState(background, { active: true, x: 900, y: 100 });
    stepHeroGhostCursorState(foreground, { active: true, x: 900, y: 100 });

    expect(background.intensity).toBe(0.22);
    expect(background.pointerX).toBe(500);
    expect(background.pointerY).toBe(400);
    expect(foreground.intensity).toBe(0);
  });
});
