import { describe, expect, it } from "vitest";
import {
  createHoldState,
  radialRadius,
  resolveHoldShake,
  resolvePortalFrame,
  stepHold,
} from "../../src/recipes/spatial/frame";
import {
  resolvePortalCameraFrame,
  resolvePortalGeometryFrame,
} from "../../src/recipes/spatial/geometry";
import {
  faceDefinitions,
  spatialBaseRotation,
} from "../../src/recipes/spatial/config";
import {
  dotVector,
  normalizeVector,
  quaternionFromEuler,
  rotateVector,
} from "../../src/recipes/spatial/math";
import { resolveReliefFrame } from "../../src/recipes/spatial/relief";
import type { SpatialViewport } from "../../src/recipes/spatial/types";

describe("spatial hold", () => {
  it("limits hold tremor to the active hold and honors reduced motion", () => {
    const state = {
      ...createHoldState(),
      phase: "expanding" as const,
      coverage: 0.5,
    };
    const still = { position: [0, 0, 0], rotation: [0, 0, 0] };
    const shake = resolveHoldShake(123, state, false);
    expect(shake).not.toEqual(still);
    expect(shake.position.every((value) => Math.abs(value) <= 0.008)).toBe(
      true,
    );
    expect(shake.rotation.every((value) => Math.abs(value) <= 0.018)).toBe(
      true,
    );
    expect(resolveHoldShake(123, state, true)).toEqual(still);
    expect(
      resolveHoldShake(123, { ...state, phase: "retracting" }, false),
    ).toEqual(still);
    expect(resolveHoldShake(123, { ...state, coverage: 1 }, false)).toEqual(
      still,
    );
  });
  const input = {
    hit: true,
    down: true,
    origin: [0.2, 0.7] as const,
    delta: 50,
    holdMs: 1000,
  };
  it("requires a real hit and commits once until the primary pointer is released", () => {
    expect(stepHold(createHoldState(), { ...input, hit: false }).coverage).toBe(
      0,
    );
    let state = createHoldState();
    for (let index = 0; index < 20; index++) state = stepHold(state, input);
    expect(state.phase).toBe("awaiting-release");
    expect(state.scheme).toBe(1);
    for (let index = 0; index < 40; index++) state = stepHold(state, input);
    expect(state.scheme).toBe(1);
    state = stepHold(state, { ...input, down: false });
    expect(state.phase).toBe("idle");
    expect(state.coverage).toBe(0);
  });
  it("retracts a cancelled attempt without committing or changing its origin", () => {
    let state = stepHold(createHoldState(), input);
    state = stepHold(state, { ...input, down: false });
    for (let i = 0; i < 10; i++)
      state = stepHold(state, { ...input, hit: false, down: false });
    expect(state.phase).toBe("idle");
    expect(state.scheme).toBe(0);
    expect(state.coverage).toBe(0);
    expect(state.origin).toEqual([0.2, 0.7]);
  });
  it("covers the farthest corner at wide, narrow, and off-center origins", () => {
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ]) {
      const radius = radialRadius(1, [0.1, 0.9], width, height);
      expect(radius).toBeGreaterThan(Math.hypot(width * 0.9, height * 0.9));
      expect(radialRadius(0, [0.1, 0.9], width, height)).toBe(0);
    }
  });
});

describe("portal projection", () => {
  const camera = resolvePortalCameraFrame();
  const viewport = (width: number, height: number): SpatialViewport => ({
    width,
    height,
    left: 0,
    top: 0,
    windowWidth: width,
    windowHeight: height,
  });
  it("rotates every tetrahedron face toward the same declared camera", () => {
    for (const index of [0, 1, 2, 3] as const) {
      const frame = resolvePortalFrame(1, 0, index);
      const geometry = resolvePortalGeometryFrame(
        viewport(1440, 900),
        frame,
        spatialBaseRotation,
      );
      const normal = rotateVector(
        normalizeVector(faceDefinitions[index].normal),
        quaternionFromEuler(geometry.rotation),
      );
      expect(dotVector(normal, camera.facing)).toBeCloseTo(1, 8);
    }
  });
  it("replays the same screen lock and restores a hub after a full return", () => {
    const forward = [0, 0.3, 0.62, 0.8, 1].map((p) => resolvePortalFrame(p, 0));
    const reverse = [1, 0.8, 0.62, 0.3, 0]
      .map((p) => resolvePortalFrame(p, 0))
      .reverse();
    expect(reverse).toEqual(forward);
    expect(resolvePortalFrame(1, 0).domContentActive).toBe(true);
    expect(resolvePortalFrame(1, 0.001).domContentActive).toBe(false);
    expect(resolvePortalFrame(1, 1).approach).toBe(0);
    expect(resolvePortalFrame(1, 1).triangleReveal).toBe(0);
  });
  it("keeps the same projected model center and scale across full-screen handoff", () => {
    for (const size of [viewport(1440, 900), viewport(390, 844)]) {
      const model = { src: "/model.glb", bodyScale: 1.3 };
      const project = (entry: number) => {
        const frame = resolvePortalFrame(entry, 0);
        const mesh = resolvePortalGeometryFrame(
          size,
          frame,
          spatialBaseRotation,
        );
        const relief = resolveReliefFrame(mesh, frame, size, model);
        const offset = relief.position.map(
          (value, index) => value - camera.position[index],
        );
        const depth =
          offset[0] * camera.forward[0] +
          offset[1] * camera.forward[1] +
          offset[2] * camera.forward[2];
        return {
          x: offset[0] / depth,
          y:
            (offset[0] * camera.up[0] +
              offset[1] * camera.up[1] +
              offset[2] * camera.up[2]) /
            depth,
          scale: relief.scale[0] / depth,
        };
      };
      const before = project(1 - 1e-6);
      const after = project(1);
      expect(before.x).toBeCloseTo(after.x, 6);
      expect(before.y).toBeCloseTo(after.y, 6);
      expect(before.scale).toBeCloseTo(after.scale, 6);
    }
  });
});
