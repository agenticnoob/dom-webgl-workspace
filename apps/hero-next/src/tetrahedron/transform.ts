import { resolveHeroChapterGeometryFrame } from "../chapters/geometry";
import type { HeroChapterScrollState } from "../chapters/scrollState";
import type { HeroViewport } from "../shared/viewport";
import {
  resolveHeroShake,
  type HeroHoldTransitionState,
} from "../transition/holdTransition";
import { heroTransitionConfig } from "../transition/transitionConfig";
import type { HeroMotionState } from "./motion";

type Vector3 = readonly [number, number, number];

export type HeroTetrahedronTransformFrame = {
  readonly position: Vector3;
  readonly rotation: Vector3;
  readonly scale: number;
};

export function resolveHeroTetrahedronTransformFrame(input: {
  readonly motion: Pick<HeroMotionState, "tiltX" | "tiltY">;
  readonly time: number;
  readonly transition: Pick<
    HeroHoldTransitionState,
    "coverage" | "phase" | "shakeActive"
  >;
  readonly viewport: HeroViewport;
  readonly reducedMotion: boolean;
  readonly chapter: HeroChapterScrollState;
}): HeroTetrahedronTransformFrame {
  const activeAttempt =
    input.transition.phase === "expanding" ||
    input.transition.phase === "retracting";
  const hubMotionWeight = activeAttempt
    ? 1 - smoothstep(input.transition.coverage)
    : 1;
  const ambientWeight = input.reducedMotion
    ? 0
    : input.chapter.hubInteractive
      ? hubMotionWeight
      : input.chapter.domContentActive
        ? 0
        : heroTransitionConfig.motion.transitionAmbientFactor;
  const interactionWeight =
    input.reducedMotion || input.chapter.domContentActive
      ? 0
      : input.chapter.hubInteractive
        ? hubMotionWeight
        : heroTransitionConfig.motion.transitionPointerFactor *
          (1 - input.chapter.screenLock);
  const shake = resolveHeroShake(
    input.time,
    input.transition,
    input.reducedMotion,
  );
  const baseRotation = input.reducedMotion
    ? heroTransitionConfig.motion.reducedRotation
    : heroTransitionConfig.motion.baseRotation;
  const breathingPhase = (input.time / 6_000) * Math.PI * 2;
  const floatingPhase = (input.time / 8_000) * Math.PI * 2;
  const frame = resolveHeroChapterGeometryFrame(
    input.viewport,
    input.chapter,
    baseRotation,
    input.reducedMotion,
  );

  return {
    scale:
      frame.scale *
      (1 +
        Math.sin(breathingPhase) *
          heroTransitionConfig.motion.breathingScaleAmplitude *
          ambientWeight),
    position: [
      frame.position[0] + shake.position[0],
      frame.position[1] +
        Math.sin(floatingPhase) *
          heroTransitionConfig.motion.floatingAmplitude *
          ambientWeight +
        shake.position[1],
      frame.position[2] + shake.position[2],
    ],
    rotation: [
      frame.rotation[0] +
        input.motion.tiltX * interactionWeight +
        shake.rotation[0],
      frame.rotation[1] +
        input.motion.tiltY * interactionWeight +
        shake.rotation[1],
      frame.rotation[2] + shake.rotation[2],
    ],
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value: number): number {
  const safeValue = clamp(value, 0, 1);
  return safeValue * safeValue * (3 - 2 * safeValue);
}
