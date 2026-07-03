import { describe, expect, test } from "vitest";

import {
  projectDOMRectToSceneLayout,
  projectTargetLayout,
} from "../../../src/lib/renderer/projectionPolicies";

describe("projection policies", () => {
  test("preserves current dom-aligned rect mapping", () => {
    const rect = { left: 100, top: 120, width: 220, height: 140 };
    const viewport = { width: 800, height: 600 };

    expect(projectDOMRectToSceneLayout(rect, viewport)).toEqual({
      x: 210,
      y: 410,
      width: 220,
      height: 140,
    });
  });

  test("projects screen anchored placement from viewport anchor and offset", () => {
    expect(
      projectTargetLayout({
        sceneProjection: "screen",
        camera: { type: "orthographic", mode: "screen" },
        placement: {
          mode: "screen-anchored",
          anchor: "top-right",
          offset: [-32, 32],
          size: [180, 48],
        },
        measurement: { left: 0, top: 0, width: 1, height: 1 },
        viewport: { width: 800, height: 600 },
      }),
    ).toEqual({
      x: 768,
      y: 568,
      z: 0,
      width: 180,
      height: 48,
    });
  });

  test("projects perspective screen-depth placement at a fixed camera depth", () => {
    expect(
      projectTargetLayout({
        sceneProjection: "perspective-stage",
        camera: {
          type: "perspective",
          mode: "perspective-stage",
          fov: 50,
          position: [0, 0, 500],
          target: [0, 0, 0],
        },
        placement: { mode: "screen-depth", depth: 500, size: "dom" },
        measurement: { left: 300, top: 250, width: 200, height: 100 },
        viewport: { width: 800, height: 600 },
      }),
    ).toEqual({
      x: 0,
      y: 0,
      z: 0,
      width: expect.any(Number),
      height: expect.any(Number),
    });
  });

  test("projects stage-local placement from explicit coordinates", () => {
    expect(
      projectTargetLayout({
        sceneProjection: "perspective-stage",
        camera: {
          type: "perspective",
          mode: "perspective-stage",
          fov: 50,
          position: [0, 0, 500],
          target: [0, 0, 0],
        },
        placement: {
          mode: "stage-local",
          position: [10, 20, -30],
          rotation: [0, Math.PI, 0],
          scale: 2,
          size: [240, 120],
        },
        measurement: { left: 0, top: 0, width: 1, height: 1 },
        viewport: { width: 800, height: 600 },
      }),
    ).toMatchObject({
      x: 10,
      y: 20,
      z: -30,
      width: 240,
      height: 120,
      rotation: [0, Math.PI, 0],
      scale: 2,
    });
  });
});
