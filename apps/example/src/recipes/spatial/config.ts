import type { FourFaces, SpatialPalette } from "./types";
import type { Vector3 } from "./math";

type Face = {
  readonly normal: Vector3;
  readonly up: Vector3;
  readonly right: Vector3;
  readonly targetRotation: Vector3;
  readonly uvOffset: readonly [number, number];
};

// Face bases match the runtime's tetrahedron geometry and the declared camera.
export const faceDefinitions = [
  {
    normal: [-1, 1, 1],
    up: [2, 1, 1],
    right: [0, -1, 1],
    targetRotation: [-0.5158110562, 0.7853981634, 1.5707963268],
    uvOffset: [0, 0.5],
  },
  {
    normal: [1, 1, -1],
    up: [1, 1, 2],
    right: [-1, 1, 0],
    targetRotation: [-2.086607383, 0, -2.3561944902],
    uvOffset: [0.5, 0.5],
  },
  {
    normal: [1, -1, 1],
    up: [1, 2, 1],
    right: [1, 0, -1],
    targetRotation: [-0.5158110562, -0.7853981634, 0],
    uvOffset: [0, 0],
  },
  {
    normal: [-1, -1, -1],
    up: [-1, 2, -1],
    right: [-1, 0, 1],
    targetRotation: [2.6257815974, 0.7853981634, -3.1415926536],
    uvOffset: [0.5, 0],
  },
] as const satisfies FourFaces<Face>;

export const defaultSpatialPalette = {
  background: "#e9e4d6",
  foreground: "#172124",
} as const satisfies SpatialPalette;

export const spatialConfig = {
  geometry: { radius: 0.52 },
  chapterGeometry: {
    cameraDistance: 3.2,
    cameraFov: 38,
    cameraTargetY: 0.32,
    lockTriangleWidthFraction: 1,
    lockTriangleMaxHeightFraction: 1,
    revealOverscan: 1.035,
    approachArcX: 0.34,
    approachArcY: 0.16,
    approachPullback: 0.18,
    approachBank: 0.14,
  },
  motion: {
    baseScale: 1.12,
    mobileScaleFactor: 0.72,
    mobileBreakpoint: 700,
    desktopYOffset: 0.32,
    mobileYOffset: 0.32,
  },
} as const;

export const spatialCameraPosition = [0, 0, 3.2] as const;
export const spatialCameraTarget = [0, 0.32, 0] as const;
export const spatialBaseRotation = [-0.6, 0.82, 0.08] as const;
