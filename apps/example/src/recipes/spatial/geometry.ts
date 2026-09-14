import type { SpatialViewport, FaceIndex } from "./types";
import type { PortalFrame } from "./frame";
import { spatialConfig, faceDefinitions } from "./config";
import {
  addVectors,
  scaleVector,
  lerpVector,
  quaternionFromEuler,
  slerpQuaternions,
  eulerFromQuaternion,
  multiplyQuaternions,
  type Vector3,
  type Quaternion,
} from "./math";

export type PortalGeometryFrame = {
  readonly position: Vector3;
  readonly rotation: Vector3;
  readonly scale: number;
};

export type PortalCameraFrame = {
  readonly position: Vector3;
  readonly forward: Vector3;
  readonly facing: Vector3;
  readonly up: Vector3;
};

export type PortalLockProjection = {
  readonly widthFraction: number;
  readonly heightFraction: number;
};

type ChapterTransformState = Pick<
  PortalFrame,
  "faceIndex" | "orientation" | "approach" | "triangleReveal"
>;

export function resolvePortalGeometryFrame(
  viewport: SpatialViewport,
  chapter: ChapterTransformState,
  hubRotation: Vector3,
  reducedMotion = false,
): PortalGeometryFrame {
  const scale = resolveHubScale(viewport);
  const lockProjection = resolvePortalLockProjection(viewport);
  const lockFrame = resolveProjectedFaceFrame(
    scale,
    lockProjection.heightFraction,
    0,
  );
  const revealHeightFraction = resolveRevealHeightFraction(viewport);
  const revealCentroidNdcY =
    -spatialConfig.chapterGeometry.revealOverscan +
    (2 * revealHeightFraction) / 3;
  const revealFrame = resolveProjectedFaceFrame(
    scale,
    revealHeightFraction,
    revealCentroidNdcY,
  );
  const hubPositionY =
    viewport.width <= spatialConfig.motion.mobileBreakpoint
      ? spatialConfig.motion.mobileYOffset
      : spatialConfig.motion.desktopYOffset;
  const targetFace = resolvePortalFace(chapter.faceIndex);
  const flightDirection = targetFace.normal[0] >= 0 ? 1 : -1;
  const approachPosition = resolveApproachPosition(
    [0, hubPositionY, 0],
    lockFrame.position,
    chapter.approach,
    flightDirection,
    reducedMotion,
  );
  const rotation = resolveApproachRotation(
    hubRotation,
    targetFace.targetRotation,
    chapter.orientation,
    flightDirection,
    reducedMotion,
  );

  return {
    position: lerpVector(
      approachPosition,
      revealFrame.position,
      chapter.triangleReveal,
    ),
    rotation,
    scale,
  };
}

export function resolvePortalFace(faceIndex: FaceIndex) {
  return faceDefinitions[faceIndex];
}

export function resolvePortalLockProjection(
  viewport: SpatialViewport,
): PortalLockProjection {
  const aspect = positive(viewport.width, 1) / positive(viewport.height, 1);
  const geometry = spatialConfig.chapterGeometry;
  const heightFraction = Math.min(
    geometry.lockTriangleMaxHeightFraction,
    geometry.lockTriangleWidthFraction * aspect * (Math.sqrt(3) / 2),
  );

  return {
    widthFraction: heightFraction / (aspect * (Math.sqrt(3) / 2)),
    heightFraction,
  };
}

export function resolvePortalCameraFrame(): PortalCameraFrame {
  const { cameraDistance, cameraTargetY } = spatialConfig.chapterGeometry;
  const axisLength = Math.hypot(cameraDistance, cameraTargetY);
  const forward: Vector3 = [
    0,
    cameraTargetY / axisLength,
    -cameraDistance / axisLength,
  ];

  return {
    position: [0, 0, cameraDistance],
    forward,
    facing: [-forward[0], -forward[1], -forward[2]],
    up: [0, cameraDistance / axisLength, cameraTargetY / axisLength],
  };
}

function resolveProjectedFaceFrame(
  scale: number,
  heightFraction: number,
  centroidNdcY: number,
): { readonly position: Vector3 } {
  const camera = resolvePortalCameraFrame();
  const { cameraFov } = spatialConfig.chapterGeometry;
  const radius = spatialConfig.geometry.radius;
  const tangent = Math.tan((cameraFov * Math.PI) / 360);
  const faceHeight = Math.SQRT2 * radius * scale;
  const cameraToFaceDistance =
    faceHeight / (2 * positive(heightFraction, 1) * tangent);
  const cameraToOriginDistance = cameraToFaceDistance + (radius * scale) / 3;
  const centroidOffset = centroidNdcY * cameraToFaceDistance * tangent;

  return {
    position: [
      camera.position[0] +
        camera.forward[0] * cameraToOriginDistance +
        camera.up[0] * centroidOffset,
      camera.position[1] +
        camera.forward[1] * cameraToOriginDistance +
        camera.up[1] * centroidOffset,
      camera.position[2] +
        camera.forward[2] * cameraToOriginDistance +
        camera.up[2] * centroidOffset,
    ],
  };
}

function resolveRevealHeightFraction(viewport: SpatialViewport): number {
  const aspect = positive(viewport.width, 1) / positive(viewport.height, 1);
  const geometry = spatialConfig.chapterGeometry;
  return (
    Math.max(1.5, 0.75 * (Math.sqrt(3) * aspect + 1)) * geometry.revealOverscan
  );
}

function resolveApproachPosition(
  start: Vector3,
  end: Vector3,
  progress: number,
  direction: number,
  reducedMotion: boolean,
): Vector3 {
  if (reducedMotion || progress <= 0 || progress >= 1) {
    return lerpVector(start, end, progress);
  }

  const geometry = spatialConfig.chapterGeometry;
  const camera = resolvePortalCameraFrame();
  const arcOffset: Vector3 = [direction * geometry.approachArcX, 0, 0];
  const liftOffset = scaleVector(camera.up, geometry.approachArcY);
  const depthOffset = scaleVector(camera.forward, geometry.approachPullback);
  const firstControl = addVectors(
    start,
    addVectors(arcOffset, addVectors(liftOffset, depthOffset)),
  );
  const secondControl = addVectors(
    end,
    addVectors(
      scaleVector(arcOffset, 0.64),
      addVectors(scaleVector(liftOffset, 0.55), depthOffset),
    ),
  );

  return cubicBezier(start, firstControl, secondControl, end, progress);
}

function resolveApproachRotation(
  start: Vector3,
  end: Vector3,
  progress: number,
  direction: number,
  reducedMotion: boolean,
): Vector3 {
  if (progress <= 0) {
    return start;
  }
  if (progress >= 1) {
    return end;
  }

  const orientation = slerpQuaternions(
    quaternionFromEuler(start),
    quaternionFromEuler(end),
    progress,
  );
  if (reducedMotion) {
    return eulerFromQuaternion(orientation);
  }

  const bank = quaternionFromAxisAngle(
    [0, 0, 1],
    Math.sin(Math.PI * progress) *
      spatialConfig.chapterGeometry.approachBank *
      direction,
  );
  return eulerFromQuaternion(multiplyQuaternions(orientation, bank));
}

export function resolveHubScale(viewport: SpatialViewport): number {
  return viewport.width <= spatialConfig.motion.mobileBreakpoint
    ? spatialConfig.motion.baseScale * spatialConfig.motion.mobileScaleFactor
    : spatialConfig.motion.baseScale;
}

function cubicBezier(
  start: Vector3,
  firstControl: Vector3,
  secondControl: Vector3,
  end: Vector3,
  progress: number,
): Vector3 {
  const t = Math.max(0, Math.min(1, progress));
  const inverse = 1 - t;
  const startWeight = inverse * inverse * inverse;
  const firstWeight = 3 * inverse * inverse * t;
  const secondWeight = 3 * inverse * t * t;
  const endWeight = t * t * t;

  return [
    start[0] * startWeight +
      firstControl[0] * firstWeight +
      secondControl[0] * secondWeight +
      end[0] * endWeight,
    start[1] * startWeight +
      firstControl[1] * firstWeight +
      secondControl[1] * secondWeight +
      end[1] * endWeight,
    start[2] * startWeight +
      firstControl[2] * firstWeight +
      secondControl[2] * secondWeight +
      end[2] * endWeight,
  ];
}

function quaternionFromAxisAngle(axis: Vector3, angle: number): Quaternion {
  const halfAngle = angle / 2;
  const sine = Math.sin(halfAngle);
  return [axis[0] * sine, axis[1] * sine, axis[2] * sine, Math.cos(halfAngle)];
}

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
