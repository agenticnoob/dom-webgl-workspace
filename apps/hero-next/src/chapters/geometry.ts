import type { HeroViewport } from "../shared/viewport";
import { heroTransitionConfig } from "../transition/transitionConfig";
import { getHeroChapterDefinition, type HeroChapterId } from "./definitions";
import type { HeroChapterScrollState } from "./scrollState";

type Vector3 = readonly [number, number, number];
type Quaternion = readonly [number, number, number, number];

export type HeroChapterGeometryFrame = {
  readonly position: Vector3;
  readonly rotation: Vector3;
  readonly scale: number;
};

export type HeroChapterCameraFrame = {
  readonly position: Vector3;
  readonly forward: Vector3;
  readonly facing: Vector3;
  readonly up: Vector3;
};

export type HeroChapterLockProjection = {
  readonly widthFraction: number;
  readonly heightFraction: number;
};

type ChapterTransformState = Pick<
  HeroChapterScrollState,
  "chapterId" | "orientation" | "approach" | "triangleReveal"
>;

export function resolveHeroChapterGeometryFrame(
  viewport: HeroViewport,
  chapter: ChapterTransformState,
  hubRotation: Vector3,
  reducedMotion = false,
): HeroChapterGeometryFrame {
  const scale = resolveHeroHubScale(viewport);
  const lockProjection = resolveHeroChapterLockProjection(viewport);
  const lockFrame = resolveProjectedFaceFrame(
    scale,
    lockProjection.heightFraction,
    0,
  );
  const revealHeightFraction = resolveRevealHeightFraction(viewport);
  const revealCentroidNdcY =
    -heroTransitionConfig.chapterGeometry.revealOverscan +
    (2 * revealHeightFraction) / 3;
  const revealFrame = resolveProjectedFaceFrame(
    scale,
    revealHeightFraction,
    revealCentroidNdcY,
  );
  const hubPositionY =
    viewport.width <= heroTransitionConfig.motion.mobileBreakpoint
      ? heroTransitionConfig.motion.mobileYOffset
      : heroTransitionConfig.motion.desktopYOffset;
  const targetFace = resolveHeroChapterFace(chapter.chapterId);
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

export function resolveHeroChapterFace(chapterId: HeroChapterId) {
  return getHeroChapterDefinition(chapterId).face;
}

export function resolveHeroChapterLockProjection(
  viewport: HeroViewport,
): HeroChapterLockProjection {
  const aspect = positive(viewport.width, 1) / positive(viewport.height, 1);
  const geometry = heroTransitionConfig.chapterGeometry;
  const heightFraction = Math.min(
    geometry.lockTriangleMaxHeightFraction,
    geometry.lockTriangleWidthFraction * aspect * (Math.sqrt(3) / 2),
  );

  return {
    widthFraction: heightFraction / (aspect * (Math.sqrt(3) / 2)),
    heightFraction,
  };
}

export function resolveHeroChapterCameraFrame(): HeroChapterCameraFrame {
  const { cameraDistance, cameraTargetY } =
    heroTransitionConfig.chapterGeometry;
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
  const camera = resolveHeroChapterCameraFrame();
  const { cameraFov } = heroTransitionConfig.chapterGeometry;
  const radius = heroTransitionConfig.geometry.radius;
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

function resolveRevealHeightFraction(viewport: HeroViewport): number {
  const aspect = positive(viewport.width, 1) / positive(viewport.height, 1);
  const geometry = heroTransitionConfig.chapterGeometry;
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

  const geometry = heroTransitionConfig.chapterGeometry;
  const camera = resolveHeroChapterCameraFrame();
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
      heroTransitionConfig.chapterGeometry.approachBank *
      direction,
  );
  return eulerFromQuaternion(multiplyQuaternions(orientation, bank));
}

function resolveHeroHubScale(viewport: HeroViewport): number {
  return viewport.width <= heroTransitionConfig.motion.mobileBreakpoint
    ? heroTransitionConfig.motion.baseScale *
        heroTransitionConfig.motion.mobileScaleFactor
    : heroTransitionConfig.motion.baseScale;
}

function lerpVector(start: Vector3, end: Vector3, progress: number): Vector3 {
  return [
    lerp(start[0], end[0], progress),
    lerp(start[1], end[1], progress),
    lerp(start[2], end[2], progress),
  ];
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

function quaternionFromEuler([x, y, z]: Vector3): Quaternion {
  const cosineX = Math.cos(x / 2);
  const cosineY = Math.cos(y / 2);
  const cosineZ = Math.cos(z / 2);
  const sineX = Math.sin(x / 2);
  const sineY = Math.sin(y / 2);
  const sineZ = Math.sin(z / 2);

  return [
    sineX * cosineY * cosineZ + cosineX * sineY * sineZ,
    cosineX * sineY * cosineZ - sineX * cosineY * sineZ,
    cosineX * cosineY * sineZ + sineX * sineY * cosineZ,
    cosineX * cosineY * cosineZ - sineX * sineY * sineZ,
  ];
}

function quaternionFromAxisAngle(axis: Vector3, angle: number): Quaternion {
  const halfAngle = angle / 2;
  const sine = Math.sin(halfAngle);
  return [axis[0] * sine, axis[1] * sine, axis[2] * sine, Math.cos(halfAngle)];
}

function multiplyQuaternions(left: Quaternion, right: Quaternion): Quaternion {
  const [leftX, leftY, leftZ, leftW] = left;
  const [rightX, rightY, rightZ, rightW] = right;
  return [
    leftX * rightW + leftW * rightX + leftY * rightZ - leftZ * rightY,
    leftY * rightW + leftW * rightY + leftZ * rightX - leftX * rightZ,
    leftZ * rightW + leftW * rightZ + leftX * rightY - leftY * rightX,
    leftW * rightW - leftX * rightX - leftY * rightY - leftZ * rightZ,
  ];
}

function slerpQuaternions(
  start: Quaternion,
  end: Quaternion,
  progress: number,
): Quaternion {
  let target = end;
  let cosine = dotQuaternion(start, target);
  if (cosine < 0) {
    target = scaleQuaternion(target, -1);
    cosine = -cosine;
  }

  if (cosine > 0.9995) {
    return normalizeQuaternion(
      addQuaternions(
        scaleQuaternion(start, 1 - progress),
        scaleQuaternion(target, progress),
      ),
    );
  }

  const theta = Math.acos(Math.max(-1, Math.min(1, cosine)));
  const sine = Math.sin(theta);
  return addQuaternions(
    scaleQuaternion(start, Math.sin((1 - progress) * theta) / sine),
    scaleQuaternion(target, Math.sin(progress * theta) / sine),
  );
}

function eulerFromQuaternion([x, y, z, w]: Quaternion): Vector3 {
  const matrix11 = 1 - 2 * (y * y + z * z);
  const matrix12 = 2 * (x * y - z * w);
  const matrix13 = 2 * (x * z + y * w);
  const matrix22 = 1 - 2 * (x * x + z * z);
  const matrix23 = 2 * (y * z - x * w);
  const matrix32 = 2 * (y * z + x * w);
  const matrix33 = 1 - 2 * (x * x + y * y);
  const rotationY = Math.asin(Math.max(-1, Math.min(1, matrix13)));

  if (Math.abs(matrix13) < 0.9999999) {
    return [
      Math.atan2(-matrix23, matrix33),
      rotationY,
      Math.atan2(-matrix12, matrix11),
    ];
  }

  return [Math.atan2(matrix32, matrix22), rotationY, 0];
}

function addVectors(left: Vector3, right: Vector3): Vector3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function scaleVector(vector: Vector3, multiplier: number): Vector3 {
  return [
    vector[0] * multiplier,
    vector[1] * multiplier,
    vector[2] * multiplier,
  ];
}

function addQuaternions(left: Quaternion, right: Quaternion): Quaternion {
  return [
    left[0] + right[0],
    left[1] + right[1],
    left[2] + right[2],
    left[3] + right[3],
  ];
}

function scaleQuaternion(
  quaternion: Quaternion,
  multiplier: number,
): Quaternion {
  return [
    quaternion[0] * multiplier,
    quaternion[1] * multiplier,
    quaternion[2] * multiplier,
    quaternion[3] * multiplier,
  ];
}

function dotQuaternion(left: Quaternion, right: Quaternion): number {
  return (
    left[0] * right[0] +
    left[1] * right[1] +
    left[2] * right[2] +
    left[3] * right[3]
  );
}

function normalizeQuaternion(quaternion: Quaternion): Quaternion {
  const length = Math.hypot(...quaternion);
  return scaleQuaternion(quaternion, 1 / length);
}

function lerp(start: number, end: number, progress: number): number {
  const safeProgress = Math.max(0, Math.min(1, progress));
  return start + (end - start) * safeProgress;
}

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
