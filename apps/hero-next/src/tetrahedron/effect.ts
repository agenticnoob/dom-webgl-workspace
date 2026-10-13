import type { BufferGeometry, Mesh, MeshStandardMaterial } from "three";

import type { HeroChapterAtlas } from "../chapters/atlas";
import type { HeroViewport } from "../shared/viewport";
import {
  resolveHeroChapterScrollState,
  type HeroChapterScrollState,
} from "../chapters/scrollState";
import {
  createHeroHoldTransitionState,
  resolveHeroTransitionVisual,
  stepHeroHoldTransition,
  type HeroHoldTransitionInput,
  type HeroHoldTransitionState,
} from "../transition/holdTransition";
import { heroTransitionConfig } from "../transition/transitionConfig";
import {
  publishHeroTransitionSignals,
  type HeroTransitionSignalWriter,
} from "../transition/signals";
import type { HeroThemeStore } from "../preferences/theme";
import { createHeroMotionState, type HeroMotionState } from "./motion";
import { resolveHeroTetrahedronTransformFrame } from "./transform";

export {
  createHeroMotionState,
  stepHeroMotionState,
  type HeroMotionInput,
  type HeroMotionState,
} from "./motion";

export function advanceHeroHoldTransition(
  state: HeroEffectState,
  input: Omit<HeroHoldTransitionInput, "reducedMotion">,
  signals: HeroTransitionSignalWriter,
  theme: HeroThemeStore,
): void {
  const previousScheme = state.transition.committedScheme;
  state.transition = stepHeroHoldTransition(state.transition, {
    ...input,
    reducedMotion: state.reducedMotion,
  });
  if (state.transition.committedScheme !== previousScheme) {
    theme.commit(state.transition.committedScheme);
  }
  publishHeroTransitionSignals(signals, state.transition);
}

export type HeroEffectState = {
  readonly reducedMotion: boolean;
  readonly motion: HeroMotionState;
  transition: HeroHoldTransitionState;
  chapterAtlas: HeroChapterAtlas | undefined;
};

type HeroTarget = Mesh<BufferGeometry, MeshStandardMaterial>;

export function createHeroEffectState(
  reducedMotion: boolean,
  committedScheme: HeroHoldTransitionState["committedScheme"] = "initial",
  chapterAtlas?: HeroChapterAtlas,
): HeroEffectState {
  return {
    reducedMotion,
    motion: createHeroMotionState(reducedMotion),
    transition: createHeroHoldTransitionState(committedScheme),
    chapterAtlas,
  };
}

export function applyHeroFrame(
  target: HeroTarget,
  motion: HeroMotionState,
  time: number,
  transition: HeroHoldTransitionState,
  viewport: HeroViewport,
  reducedMotion: boolean,
  chapter: HeroChapterScrollState = resolveHeroChapterScrollState(0, 0),
): void {
  const frame = resolveHeroTetrahedronTransformFrame({
    motion,
    time,
    transition,
    viewport,
    reducedMotion,
    chapter,
  });

  target.scale.setScalar(frame.scale);
  target.position.set(...frame.position);
  target.rotation.set(...frame.rotation);

  const visual = resolveHeroTransitionVisual(transition);
  const opacity = lerp(
    heroTransitionConfig.motion.initialOpacity,
    1,
    chapter.screenLock,
  );
  target.visible = !chapter.domContentActive;
  target.material.color.set(visual.committed.foreground);
  target.material.emissive.set(visual.committed.foreground);
  target.material.emissiveIntensity =
    heroTransitionConfig.motion.emissiveIntensity;
  target.material.opacity = opacity;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * clamp(progress, 0, 1);
}
