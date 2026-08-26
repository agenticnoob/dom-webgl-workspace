import type { HeroViewport } from "../shared/viewport";
import { heroTransitionConfig } from "../transition/transitionConfig";
import { getHeroChapterDefinition, type HeroChapterId } from "./definitions";
import type { HeroChapterScrollState } from "./scrollState";

type Vector3 = readonly [number, number, number];

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
  const cameraTarget: Vector3 = [
    0,
    heroTransitionConfig.chapterGeometry.cameraTargetY,
    0,
  ];
  const approachPosition = lerpVector(
    cameraTarget,
    lockFrame.position,
    chapter.approach,
  );
  const hubPositionY =
    viewport.width <= heroTransitionConfig.motion.mobileBreakpoint
      ? heroTransitionConfig.motion.mobileYOffset
      : heroTransitionConfig.motion.desktopYOffset;
  const alignedApproachPosition: Vector3 = [
    approachPosition[0],
    lerp(hubPositionY, approachPosition[1], chapter.orientation),
    approachPosition[2],
  ];
  const targetFace = resolveHeroChapterFace(chapter.chapterId);

  return {
    position: lerpVector(
      alignedApproachPosition,
      revealFrame.position,
      chapter.triangleReveal,
    ),
    rotation: lerpVector(
      hubRotation,
      targetFace.targetRotation,
      chapter.orientation,
    ),
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

function lerp(start: number, end: number, progress: number): number {
  const safeProgress = Math.max(0, Math.min(1, progress));
  return start + (end - start) * safeProgress;
}

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
