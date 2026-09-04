import type { WebGLEffectLightsFacade } from "@viselora/dom-webgl";
import { describe, expect, test, vi } from "vitest";

import {
  heroGhostBackgroundEffect,
  resolveHeroGhostCursorIntensityScale,
  resolveHeroGhostProgramState,
  resolveHeroGhostOverscanScale,
  resolveHeroPointerLightIntensityScale,
} from "../src/ghost/backgroundEffect";
import {
  createHeroPointerLightState,
  disposeHeroPointerLight,
  heroPointerLightKey,
  resolveHeroPointerLightTarget,
  updateHeroPointerLight,
} from "../src/ghost/pointerLight";
import { createHeroHoldTransitionState } from "../src/transition/holdTransition";
import {
  publishHeroTransitionSignals,
  type HeroTransitionSignalReader,
  type HeroTransitionSignalWriter,
} from "../src/transition/signals";

describe("hero Ghost Cursor effects", () => {
  test("registers only the frame-scheduled background effect", () => {
    expect(heroGhostBackgroundEffect).toMatchObject({
      kind: "hero.ghost.background",
      source: "dom/element",
      schedule: "frame",
      dispose: expect.any(Function),
    });
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

  test("resolves semantic radial state from shared transition signals", () => {
    const viewport = { width: 1200, height: 835 };
    const values = new Map<string, number>();
    const writer = {
      set(key: string, value: number) {
        values.set(key, value);
      },
    } satisfies HeroTransitionSignalWriter;
    const reader = {
      get(key: string) {
        return values.get(key) ?? 0;
      },
    } satisfies HeroTransitionSignalReader;
    const idle = createHeroHoldTransitionState("initial");

    publishHeroTransitionSignals(writer, idle);
    expect(resolveHeroGhostProgramState(reader, viewport)).toEqual({
      baseBackgroundColor: "#B8B8B8",
      baseForegroundColor: "#5F5F5F",
      targetBackgroundColor: "#B8B8B8",
      targetForegroundColor: "#5F5F5F",
      radialOrigin: [0.5, 0.5],
      radialRadiusPx: 0,
      radialEdgePx: 1.5,
      sceneOpacity: 1,
    });

    const expanding = {
      ...idle,
      targetScheme: "inverted" as const,
      coverage: 0.5,
      origin: { x: 0.25, y: 0.75 },
      phase: "expanding" as const,
      shakeActive: true,
    };
    publishHeroTransitionSignals(writer, expanding);
    const expandingProgram = resolveHeroGhostProgramState(reader, viewport);
    expect(expandingProgram).toMatchObject({
      baseBackgroundColor: "#B8B8B8",
      baseForegroundColor: "#5F5F5F",
      targetBackgroundColor: "#5F5F5F",
      targetForegroundColor: "#B8B8B8",
      radialOrigin: [0.25, 0.75],
      radialRadiusPx: expect.any(Number),
      radialEdgePx: 1.5,
      sceneOpacity: 1,
    });
    expect(expandingProgram.radialRadiusPx).toBeGreaterThan(0);
    expect(expanding).toMatchObject({
      coverage: 0.5,
      origin: { x: 0.25, y: 0.75 },
      phase: "expanding",
    });

    publishHeroTransitionSignals(writer, {
      ...expanding,
      coverage: 0.25,
      phase: "retracting",
    });
    expect(resolveHeroGhostProgramState(reader, viewport)).toMatchObject({
      baseBackgroundColor: "#B8B8B8",
      targetBackgroundColor: "#5F5F5F",
      targetForegroundColor: "#B8B8B8",
      sceneOpacity: 1,
    });

    publishHeroTransitionSignals(writer, idle);
    expect(resolveHeroGhostProgramState(reader, viewport)).toMatchObject({
      baseBackgroundColor: "#B8B8B8",
      targetBackgroundColor: "#B8B8B8",
      targetForegroundColor: "#5F5F5F",
      radialRadiusPx: 0,
      sceneOpacity: 1,
    });

    publishHeroTransitionSignals(writer, {
      ...idle,
      committedScheme: "inverted",
      targetScheme: "inverted",
      coverage: 1,
      phase: "awaiting-release",
    });
    expect(resolveHeroGhostProgramState(reader, viewport)).toMatchObject({
      baseBackgroundColor: "#5F5F5F",
      baseForegroundColor: "#B8B8B8",
      targetBackgroundColor: "#5F5F5F",
      targetForegroundColor: "#B8B8B8",
      sceneOpacity: 1,
    });

    publishHeroTransitionSignals(writer, idle);
    values.set("hero.chapter-1.entry", 1);
    expect(resolveHeroGhostProgramState(reader, viewport)).toMatchObject({
      baseBackgroundColor: "#5F5F5F",
      baseForegroundColor: "#B8B8B8",
      targetBackgroundColor: "#5F5F5F",
      targetForegroundColor: "#B8B8B8",
      sceneOpacity: 1,
    });
    expect(resolveHeroPointerLightIntensityScale(reader)).toBeCloseTo(0.04);
    expect(resolveHeroGhostCursorIntensityScale(reader)).toBeCloseTo(0.1);

    values.set("hero.chapter-1.exit", 0.5);
    expect(resolveHeroPointerLightIntensityScale(reader)).toBeCloseTo(0.52);
    expect(resolveHeroGhostCursorIntensityScale(reader)).toBeCloseTo(0.55);

    values.set("hero.chapter-1.exit", 1);
    expect(resolveHeroPointerLightIntensityScale(reader)).toBe(1);
    expect(resolveHeroGhostCursorIntensityScale(reader)).toBe(1);
  });

  test("maps target-local pointer coordinates around the tetrahedron", () => {
    expect(
      resolveHeroPointerLightTarget({
        localX: 500,
        localY: 250,
        width: 1000,
        height: 500,
      }),
    ).toEqual([0, 0.365, 0.8]);
    expect(
      resolveHeroPointerLightTarget({
        localX: 1000,
        localY: 0,
        width: 1000,
        height: 500,
      }),
    ).toEqual([1.05, 1.085, 0.8]);
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
      color: "#f0f0f0",
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

  test("caps the focused pointer light at a restrained chapter intensity", () => {
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
        intensityScale: 0.04,
      });
    }

    expect(state.intensity).toBeCloseTo(0.4, 3);
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
      z: 0.8,
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
    ambient: vi.fn<WebGLEffectLightsFacade["ambient"]>(() => lightHandle),
    directional: vi.fn<WebGLEffectLightsFacade["directional"]>(
      () => lightHandle,
    ),
    point: vi.fn<WebGLEffectLightsFacade["point"]>(() => lightHandle),
    remove: vi.fn<WebGLEffectLightsFacade["remove"]>(),
  } satisfies WebGLEffectLightsFacade;

  return { lights };
}
