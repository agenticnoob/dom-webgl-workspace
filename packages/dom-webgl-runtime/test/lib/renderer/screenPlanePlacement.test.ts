import { describe, expect, test } from "vitest";

import {
  projectScreenPlaneLayout,
  type ScreenPlanePlacementPlane,
} from "../../../src/lib/renderer/screenPlanePlacement";

const camera = {
  type: "perspective",
  mode: "perspective-stage",
  fov: 50,
  position: [0, 0, 500],
  target: [0, 0, 0],
} as const;

const plane = {
  id: "floor",
  sceneId: "world",
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
  size: [800, 600],
} satisfies ScreenPlanePlacementPlane;

describe("screen-plane placement", () => {
  test("reports a descriptor-only diagnostic when the named plane is missing", () => {
    expect(
      projectScreenPlaneLayout({
        sceneProjection: "perspective-stage",
        camera,
        placement: {
          mode: "screen-plane",
          planeId: "missing",
          offset: [0, 0, 0],
          scale: 1,
        },
        measurement: { left: 300, top: 250, width: 200, height: 100 },
        viewport: { width: 800, height: 600 },
      }),
    ).toEqual({
      x: 0,
      y: 0,
      z: 0,
      width: 0,
      height: 0,
      placementDiagnostic: {
        kind: "screen-plane-missing-plane",
        planeId: "missing",
      },
    });
  });

  test("reports unsupported projection without exposing raw camera or plane data", () => {
    expect(
      projectScreenPlaneLayout({
        sceneProjection: "screen",
        camera,
        plane,
        placement: {
          mode: "screen-plane",
          planeId: "floor",
          offset: [0, 0, 0],
          scale: 1,
        },
        measurement: { left: 300, top: 250, width: 200, height: 100 },
        viewport: { width: 800, height: 600 },
      }).placementDiagnostic,
    ).toEqual({
      kind: "screen-plane-unsupported-scene",
      planeId: "floor",
    });
  });

  test("projects the DOM rect center through the camera onto the named plane", () => {
    const layout = projectScreenPlaneLayout({
      sceneProjection: "perspective-stage",
      camera,
      plane,
      placement: {
        mode: "screen-plane",
        planeId: "floor",
        offset: [10, 20, 5],
        scale: [2, 0.5],
      },
      measurement: { left: 300, top: 250, width: 200, height: 100 },
      viewport: { width: 800, height: 600 },
    });

    expect(layout.x).toBeCloseTo(10);
    expect(layout.y).toBeCloseTo(20);
    expect(layout.z).toBeCloseTo(5);
    expect(layout.width).toBeCloseTo(310.8718, 3);
    expect(layout.height).toBeCloseTo(38.859, 3);
    expect(layout.rotation).toEqual([0, 0, 0]);
  });

  test("reports no intersection when the camera ray is parallel to the plane", () => {
    expect(
      projectScreenPlaneLayout({
        sceneProjection: "perspective-stage",
        camera,
        plane: {
          ...plane,
          rotation: [Math.PI / 2, 0, 0],
        },
        placement: {
          mode: "screen-plane",
          planeId: "floor",
          offset: [0, 0, 0],
          scale: 1,
        },
        measurement: { left: 300, top: 250, width: 200, height: 100 },
        viewport: { width: 800, height: 600 },
      }).placementDiagnostic,
    ).toEqual({
      kind: "screen-plane-no-intersection",
      planeId: "floor",
    });
  });
});
