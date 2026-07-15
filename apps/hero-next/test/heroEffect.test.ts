import { describe, expect, test, vi } from "vitest";

import {
  applyHeroFrame,
  createHeroMotionState,
  heroTetrahedronEffect,
  resolveHeroBaseScale,
  resolveHeroYOffset,
  stepHeroMotionState,
} from "../src/heroEffect";

describe("hero tetrahedron effect", () => {
  test("breathes and floats without time-driven rotation", () => {
    const target = {
      position: { set: vi.fn() },
      rotation: { set: vi.fn() },
      scale: { setScalar: vi.fn() },
    };
    const state = createHeroMotionState(false);
    state.tiltX = 0.02;
    state.tiltY = -0.03;

    applyHeroFrame(target, state, 1_500, 1.08, 0.365);
    applyHeroFrame(target, state, 4_500, 1.08, 0.365);

    expect(target.scale.setScalar).toHaveBeenNthCalledWith(
      1,
      expect.closeTo(1.08 * 1.012, 6),
    );
    expect(target.position.set).toHaveBeenNthCalledWith(
      1,
      0,
      expect.closeTo(0.365 + Math.sin((1_500 / 8_000) * Math.PI * 2) * 0.018, 6),
      0,
    );
    expect(target.rotation.set).toHaveBeenNthCalledWith(
      1,
      expect.closeTo(-0.58, 6),
      expect.closeTo(0.79, 6),
      0.08,
    );
    expect(target.rotation.set).toHaveBeenNthCalledWith(
      2,
      expect.closeTo(-0.58, 6),
      expect.closeTo(0.79, 6),
      0.08,
    );
  });

  test("adds proximity tilt while moving and returns after 120ms idle", () => {
    const state = createHeroMotionState(false);

    stepHeroMotionState(state, {
      time: 16,
      delta: 16,
      pointerInside: true,
      pointerX: 0.4,
      pointerY: -0.2,
    });
    expect(state.targetTiltX).toBeCloseTo(0.016, 6);
    expect(state.targetTiltY).toBeCloseTo(0.04, 6);

    stepHeroMotionState(state, {
      time: 160,
      delta: 16,
      pointerInside: true,
      pointerX: 0.4,
      pointerY: -0.2,
    });
    expect(state.targetTiltX).toBe(0);
    expect(state.targetTiltY).toBe(0);
  });

  test("keeps reduced motion static", () => {
    const target = {
      position: { set: vi.fn() },
      rotation: { set: vi.fn() },
      scale: { setScalar: vi.fn() },
    };
    const state = createHeroMotionState(true);
    stepHeroMotionState(state, {
      time: 24_000,
      delta: 16,
      pointerInside: true,
      pointerX: 0.4,
      pointerY: -0.2,
    });
    applyHeroFrame(target, state, 24_000, 1.08, 0);

    expect(target.rotation.set).toHaveBeenCalledWith(-0.6, 0.85, 0.08);
  });

  test("declares managed mesh frame scheduling and responsive framing", () => {
    expect(heroTetrahedronEffect).toMatchObject({
      kind: "hero.tetrahedron.motion",
      source: "mesh",
      schedule: "frame",
    });
    expect(resolveHeroBaseScale(1440, 1.08)).toBe(1.08);
    expect(resolveHeroBaseScale(390, 1.08)).toBeCloseTo(0.648, 6);
    expect(resolveHeroYOffset(1440)).toBe(0.365);
    expect(resolveHeroYOffset(390)).toBe(0.555);
  });
});
