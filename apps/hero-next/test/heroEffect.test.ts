import { describe, expect, test, vi } from "vitest";

import {
  applyHeroMaterial,
  applyHeroFrame,
  createHeroMotionState,
  heroTetrahedronEffect,
  resolveHeroBaseScale,
  resolveHeroYOffset,
  stepHeroMotionState,
} from "../src/heroEffect";

describe("hero tetrahedron effect", () => {
  test("keeps black-silver facets readable without environment lighting", () => {
    const material = {
      color: { set: vi.fn() },
      emissive: { set: vi.fn() },
      metalness: 0,
      roughness: 0,
      opacity: 0,
    };

    applyHeroMaterial({ material });

    expect(material.color.set).toHaveBeenCalledWith("#30343b");
    expect(material.emissive.set).toHaveBeenCalledWith("#0d0a12", 0.06);
    expect(material.metalness).toBe(0.9);
    expect(material.roughness).toBe(0.12);
    expect(material.opacity).toBe(1);
  });

  test("completes one slow base rotation in 48 seconds", () => {
    const target = {
      position: { set: vi.fn() },
      rotation: { set: vi.fn() },
      scale: { setScalar: vi.fn() },
    };
    const state = createHeroMotionState(false);

    applyHeroFrame(target, state, 48_000, 1.08, 0);

    expect(target.scale.setScalar).toHaveBeenCalledWith(1.08);
    expect(target.position.set).toHaveBeenCalledWith(0, 0, 0);
    expect(target.rotation.set).toHaveBeenCalledWith(
      expect.any(Number),
      expect.closeTo(0.92 + Math.PI * 2, 6),
      expect.any(Number),
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

    expect(target.rotation.set).toHaveBeenCalledWith(-0.45, 0.92, 0.08);
  });

  test("declares managed GLB frame scheduling and responsive framing", () => {
    expect(heroTetrahedronEffect).toMatchObject({
      kind: "hero.tetrahedron.motion",
      source: "model/glb",
      schedule: "frame",
    });
    expect(resolveHeroBaseScale(1440, 1.08)).toBe(1.08);
    expect(resolveHeroBaseScale(390, 1.08)).toBeCloseTo(0.648, 6);
    expect(resolveHeroYOffset(1440)).toBe(0);
    expect(resolveHeroYOffset(390)).toBe(0.19);
  });
});
