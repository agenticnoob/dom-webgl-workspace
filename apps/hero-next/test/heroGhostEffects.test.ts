import type { WebGLEffectLightsFacade } from "@viselora/dom-webgl";
import { describe, expect, test, vi } from "vitest";

import {
  createHeroPointerLightState,
  disposeHeroPointerLight,
  heroGhostBackgroundEffect,
  heroGhostEffects,
  heroPointerLightKey,
  resolveHeroPointerLightTarget,
  resolveHeroGhostOverscanScale,
  updateHeroPointerLight,
} from "../src/heroGhostEffects";

describe("hero Ghost Cursor effects", () => {
  test("registers only the frame-scheduled background effect", () => {
    expect(heroGhostBackgroundEffect).toMatchObject({
      kind: "hero.ghost.background",
      source: "dom/element",
      schedule: "frame",
      dispose: expect.any(Function),
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

  test("maps target-local pointer coordinates around the tetrahedron", () => {
    expect(
      resolveHeroPointerLightTarget({
        localX: 500,
        localY: 250,
        width: 1000,
        height: 500,
      }),
    ).toEqual([0, 0.365, 1.1]);
    expect(
      resolveHeroPointerLightTarget({
        localX: 1000,
        localY: 0,
        width: 1000,
        height: 500,
      }),
    ).toEqual([1.05, 1.085, 1.1]);
  });

  test("damps pointer-light position and updates one stable light key", () => {
    const { lights } = createLightsFacade();
    const state = createHeroPointerLightState(false);

    updateHeroPointerLight(lights, state, {
      active: true,
      localX: 1000,
      localY: 0,
      width: 1000,
      height: 500,
      delta: 16,
    });
    updateHeroPointerLight(lights, state, {
      active: true,
      localX: 1000,
      localY: 0,
      width: 1000,
      height: 500,
      delta: 16,
    });

    expect(state.x).toBeGreaterThan(0);
    expect(state.x).toBeLessThan(1.05);
    expect(state.y).toBeGreaterThan(0.365);
    expect(state.y).toBeLessThan(1.085);
    expect(lights.point).toHaveBeenCalledTimes(2);
    expect(lights.point.mock.calls.map(([key]) => key)).toEqual([
      heroPointerLightKey,
      heroPointerLightKey,
    ]);
    expect(lights.point).toHaveBeenLastCalledWith(heroPointerLightKey, {
      color: "#a883ff",
      intensity: state.intensity,
      distance: 1.8,
      decay: 3,
      position: [state.x, state.y, state.z],
      follow: "none",
    });
  });

  test("raises the focused pointer light toward intensity ten", () => {
    const { lights } = createLightsFacade();
    const state = createHeroPointerLightState(false);

    for (let frame = 0; frame < 20; frame += 1) {
      updateHeroPointerLight(lights, state, {
        active: true,
        localX: 500,
        localY: 250,
        width: 1000,
        height: 500,
        delta: 64,
      });
    }

    expect(state.intensity).toBeCloseTo(10, 3);
  });

  test("fades pointer-light intensity after the pointer leaves", () => {
    const { lights } = createLightsFacade();
    const state = createHeroPointerLightState(false);

    updateHeroPointerLight(lights, state, {
      active: true,
      localX: 500,
      localY: 250,
      width: 1000,
      height: 500,
      delta: 64,
    });
    const activeIntensity = state.intensity;
    updateHeroPointerLight(lights, state, {
      active: false,
      localX: 0,
      localY: 0,
      width: 1000,
      height: 500,
      delta: 16,
    });

    expect(activeIntensity).toBeGreaterThan(0);
    expect(state.intensity).toBeGreaterThan(0);
    expect(state.intensity).toBeLessThan(activeIntensity);
  });

  test("keeps a static low-intensity light under reduced motion", () => {
    const { lights } = createLightsFacade();
    const state = createHeroPointerLightState(true);

    updateHeroPointerLight(lights, state, {
      active: true,
      localX: 1000,
      localY: 0,
      width: 1000,
      height: 500,
      delta: 16,
    });
    updateHeroPointerLight(lights, state, {
      active: true,
      localX: 0,
      localY: 500,
      width: 1000,
      height: 500,
      delta: 16,
    });

    expect(state).toMatchObject({
      x: 0,
      y: 0.365,
      z: 1.1,
      intensity: 0.45,
    });
    expect(lights.point.mock.calls[0]?.[1]).toEqual(
      lights.point.mock.calls[1]?.[1],
    );
  });

  test("safely no-ops without a lights facade", () => {
    const state = createHeroPointerLightState(false);

    expect(() =>
      updateHeroPointerLight(undefined, state, {
        active: true,
        localX: 1000,
        localY: 0,
        width: 1000,
        height: 500,
        delta: 16,
      }),
    ).not.toThrow();
  });

  test("removes the stable pointer light through the managed facade", () => {
    const { lights } = createLightsFacade();

    disposeHeroPointerLight(lights);
    disposeHeroPointerLight(undefined);

    expect(lights.remove).toHaveBeenCalledOnce();
    expect(lights.remove).toHaveBeenCalledWith(heroPointerLightKey);
  });
});

function createLightsFacade() {
  const lightHandle = {
    setVisible: vi.fn(),
    remove: vi.fn(),
    dispose: vi.fn(),
  };
  const lights = {
    ambient: vi.fn(() => lightHandle),
    directional: vi.fn(() => lightHandle),
    point: vi.fn(() => lightHandle),
    remove: vi.fn(),
  } satisfies WebGLEffectLightsFacade;

  return { lights };
}
