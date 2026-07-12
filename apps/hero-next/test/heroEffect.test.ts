import { describe, expect, test, vi } from "vitest";
import {
  applyHeroFrame,
  heroTetrahedronEffect,
  resolveHeroBaseScale,
  resolveHeroYOffset,
  type HeroMotionState,
} from "../src/heroEffect";

describe("hero tetrahedron effect", () => {
  test("applies restrained multi-axis breath motion", () => {
    const target = {
      position: { set: vi.fn() },
      rotation: { set: vi.fn() },
      scale: { setScalar: vi.fn() },
    };
    const state = {
      breath: 1,
      float: 0.5,
      phase: Math.PI / 2,
      reducedMotion: false,
    } satisfies HeroMotionState;

    applyHeroFrame(target, state, 1.08);

    expect(target.scale.setScalar).toHaveBeenCalledWith(
      expect.closeTo(1.1016, 6),
    );
    expect(target.position.set).toHaveBeenCalledWith(0, 0.0175, 0);
    expect(target.rotation.set).toHaveBeenCalledWith(-0.37, 0.92, 0.08);
  });

  test("reduced motion is static", () => {
    const target = {
      position: { set: vi.fn() },
      rotation: { set: vi.fn() },
      scale: { setScalar: vi.fn() },
    };

    applyHeroFrame(
      target,
      { breath: 1, float: 1, phase: Math.PI, reducedMotion: true },
      1.08,
    );

    expect(target.scale.setScalar).toHaveBeenCalledWith(1.08);
    expect(target.position.set).toHaveBeenCalledWith(0, 0, 0);
    expect(target.rotation.set).toHaveBeenCalledWith(-0.45, 0.92, 0.08);
  });

  test("declares managed GLB model frame scheduling", () => {
    expect(heroTetrahedronEffect.kind).toBe("hero.tetrahedron.breathe");
    expect(heroTetrahedronEffect.source).toBe("model/glb");
    expect(heroTetrahedronEffect.schedule).toBe("frame");
  });

  test("reduces the managed scale for portrait-width viewports", () => {
    expect(resolveHeroBaseScale(1440, 1.08)).toBe(1.08);
    expect(resolveHeroBaseScale(390, 1.08)).toBeCloseTo(0.648, 6);
    expect(resolveHeroYOffset(1440)).toBe(0);
    expect(resolveHeroYOffset(390)).toBe(0.19);
  });
});
