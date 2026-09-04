import { getHeroChapterDefinition } from "../chapters/definitions";
import { resolveHeroChapterCameraFrame } from "../chapters/geometry";
import type { HeroChapterScrollState } from "../chapters/scrollState";
import type { HeroViewport } from "../shared/viewport";
import type { HeroMotionState } from "../tetrahedron/motion";
import { resolveHeroTetrahedronTransformFrame } from "../tetrahedron/transform";
import type { HeroHoldTransitionState } from "../transition/holdTransition";
import { heroTransitionConfig } from "../transition/transitionConfig";

type Vector3 = readonly [number, number, number];
type Quaternion = readonly [number, number, number, number];

export type HeroProfileModelFrame = {
  readonly visible: boolean;
  readonly position: Vector3;
  readonly rotation: Vector3;
  readonly scale: Vector3;
};

const fullTurn = Math.PI * 2;
const mobileBreakpoint = 700;
const faceReliefOffset = 0.022;
const faceReliefScale = 0.27;
const faceReliefDepthScale = 0.045;

export function resolveHeroProfileModelFrame(input: {
  readonly chapter: HeroChapterScrollState;
  readonly spinProgress: number;
  readonly viewport: HeroViewport;
  readonly reducedMotion: boolean;
  readonly motion: Pick<HeroMotionState, "tiltX" | "tiltY">;
  readonly time: number;
  readonly transition: Pick<
    HeroHoldTransitionState,
    "coverage" | "phase" | "shakeActive"
  >;
}): HeroProfileModelFrame {
  const spinProgress = resolveProfileSpinProgress(
    input.chapter,
    input.spinProgress,
  );
  const spin =
    input.reducedMotion || spinProgress === 0 ? 0 : -spinProgress * fullTurn;
  const tetrahedron = resolveHeroTetrahedronTransformFrame({
    motion: input.motion,
    time: input.time,
    transition: input.transition,
    viewport: input.viewport,
    reducedMotion: input.reducedMotion,
    chapter: input.chapter,
  });
  const faceFrame = resolveFaceReliefFrame(tetrahedron, spin);
  const mobile = input.viewport.width <= mobileBreakpoint;
  const bodyScale = mobile ? 0.63 : 1;
  const bodyFrame = {
    position: [0, mobile ? 0.32 : 0.3, 0.18],
    rotation: [0, spin, 0],
    scale: [bodyScale, bodyScale, bodyScale],
  } satisfies Omit<HeroProfileModelFrame, "visible">;
  const projectedBodyFrame = resolveProjectedBodyFrame(
    bodyFrame,
    faceFrame.position,
  );
  const profileChapterActive = input.chapter.chapterId === "self";
  const reveal = profileChapterActive
    ? clampProgress(input.chapter.triangleReveal)
    : 0;
  const rotation =
    reveal <= 0
      ? faceFrame.rotation
      : reveal >= 1
        ? bodyFrame.rotation
        : eulerFromQuaternion(
            slerpQuaternions(
              quaternionFromEuler(faceFrame.rotation),
              quaternionFromEuler(bodyFrame.rotation),
              reveal,
            ),
          );

  return {
    visible: profileChapterActive || !input.chapter.domContentActive,
    position:
      reveal <= 0
        ? faceFrame.position
        : reveal >= 1
          ? bodyFrame.position
          : lerpVector(faceFrame.position, projectedBodyFrame.position, reveal),
    rotation,
    scale:
      reveal <= 0
        ? faceFrame.scale
        : reveal >= 1
          ? bodyFrame.scale
          : lerpVector(faceFrame.scale, projectedBodyFrame.scale, reveal),
  };
}

function resolveProfileSpinProgress(
  chapter: HeroChapterScrollState,
  progress: number,
): number {
  if (chapter.chapterId !== "self" || chapter.exitProgress > 0) {
    return 1;
  }
  if (chapter.phase !== "dom-content") {
    return 0;
  }
  return clampProgress(progress);
}

function resolveProjectedBodyFrame(
  bodyFrame: Omit<HeroProfileModelFrame, "visible">,
  surfacePosition: Vector3,
): Omit<HeroProfileModelFrame, "visible"> {
  const camera = resolveHeroChapterCameraFrame();
  const bodyOffset: Vector3 = [
    bodyFrame.position[0] - camera.position[0],
    bodyFrame.position[1] - camera.position[1],
    bodyFrame.position[2] - camera.position[2],
  ];
  const surfaceOffset: Vector3 = [
    surfacePosition[0] - camera.position[0],
    surfacePosition[1] - camera.position[1],
    surfacePosition[2] - camera.position[2],
  ];
  const bodyDepth = Math.max(1e-6, dotVector(bodyOffset, camera.forward));
  const surfaceDepth = Math.max(1e-6, dotVector(surfaceOffset, camera.forward));
  const depthRatio = surfaceDepth / bodyDepth;

  return {
    position: addVectors(camera.position, scaleVector(bodyOffset, depthRatio)),
    rotation: bodyFrame.rotation,
    scale: scaleVector(bodyFrame.scale, depthRatio),
  };
}

function resolveFaceReliefFrame(
  tetrahedron: ReturnType<typeof resolveHeroTetrahedronTransformFrame>,
  spin: number,
): Omit<HeroProfileModelFrame, "visible"> {
  const face = getHeroChapterDefinition("self").face;
  const parentRotation = quaternionFromEuler(tetrahedron.rotation);
  const normal = normalizeVector(face.normal);
  const faceCenterDistance =
    heroTransitionConfig.geometry.radius / 3 + faceReliefOffset;
  const localPosition = scaleVector(
    normal,
    faceCenterDistance * tetrahedron.scale,
  );
  const worldOffset = rotateVector(localPosition, parentRotation);
  const faceRotation = quaternionFromBasis(
    normalizeVector(face.right),
    normalizeVector(face.up),
    normal,
  );

  return {
    position: addVectors(tetrahedron.position, worldOffset),
    rotation: eulerFromQuaternion(
      multiplyQuaternions(
        multiplyQuaternions(parentRotation, faceRotation),
        quaternionFromEuler([0, spin, 0]),
      ),
    ),
    scale: [
      tetrahedron.scale * faceReliefScale,
      tetrahedron.scale * faceReliefScale,
      tetrahedron.scale * faceReliefDepthScale,
    ],
  };
}

function quaternionFromBasis(
  right: Vector3,
  up: Vector3,
  forward: Vector3,
): Quaternion {
  const m11 = right[0];
  const m12 = up[0];
  const m13 = forward[0];
  const m21 = right[1];
  const m22 = up[1];
  const m23 = forward[1];
  const m31 = right[2];
  const m32 = up[2];
  const m33 = forward[2];
  const trace = m11 + m22 + m33;

  if (trace > 0) {
    const scale = 0.5 / Math.sqrt(trace + 1);
    return normalizeQuaternion([
      (m32 - m23) * scale,
      (m13 - m31) * scale,
      (m21 - m12) * scale,
      0.25 / scale,
    ]);
  }
  if (m11 > m22 && m11 > m33) {
    const scale = 2 * Math.sqrt(1 + m11 - m22 - m33);
    return normalizeQuaternion([
      0.25 * scale,
      (m12 + m21) / scale,
      (m13 + m31) / scale,
      (m32 - m23) / scale,
    ]);
  }
  if (m22 > m33) {
    const scale = 2 * Math.sqrt(1 + m22 - m11 - m33);
    return normalizeQuaternion([
      (m12 + m21) / scale,
      0.25 * scale,
      (m23 + m32) / scale,
      (m13 - m31) / scale,
    ]);
  }

  const scale = 2 * Math.sqrt(1 + m33 - m11 - m22);
  return normalizeQuaternion([
    (m13 + m31) / scale,
    (m23 + m32) / scale,
    0.25 * scale,
    (m21 - m12) / scale,
  ]);
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
  const safeProgress = clampProgress(progress);
  let target = end;
  let cosine = dotQuaternion(start, target);
  if (cosine < 0) {
    target = scaleQuaternion(target, -1);
    cosine = -cosine;
  }

  if (cosine > 0.9995) {
    return normalizeQuaternion(
      addQuaternions(
        scaleQuaternion(start, 1 - safeProgress),
        scaleQuaternion(target, safeProgress),
      ),
    );
  }

  const theta = Math.acos(Math.max(-1, Math.min(1, cosine)));
  const sine = Math.sin(theta);
  return addQuaternions(
    scaleQuaternion(start, Math.sin((1 - safeProgress) * theta) / sine),
    scaleQuaternion(target, Math.sin(safeProgress * theta) / sine),
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

function rotateVector(vector: Vector3, quaternion: Quaternion): Vector3 {
  const [x, y, z] = vector;
  const [qx, qy, qz, qw] = quaternion;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

function normalizeVector(vector: Vector3): Vector3 {
  const length = Math.hypot(...vector);
  return scaleVector(vector, 1 / length);
}

function normalizeQuaternion(quaternion: Quaternion): Quaternion {
  const length = Math.hypot(...quaternion);
  return scaleQuaternion(quaternion, 1 / length);
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

function lerpVector(start: Vector3, end: Vector3, progress: number): Vector3 {
  return [
    lerp(start[0], end[0], progress),
    lerp(start[1], end[1], progress),
    lerp(start[2], end[2], progress),
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

function dotVector(left: Vector3, right: Vector3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function lerp(start: number, end: number, progress: number): number {
  const safeProgress = clampProgress(progress);
  return start + (end - start) * safeProgress;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
