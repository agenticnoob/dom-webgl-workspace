import {
  defineWebGLSceneObjectEffect,
  type WebGLEffectMaterialFacade,
} from "@viselora/dom-webgl";

import {
  createHeroChapterAtlas,
  heroChapterAtlasMatchesViewport,
  type HeroChapterAtlas,
} from "../chapters/atlas";
import { readHeroViewport, type HeroViewport } from "../shared/viewport";
import {
  readHeroChapterScrollState,
  resolveHeroChapterScrollState,
  type HeroChapterScrollState,
} from "../chapters/scrollState";
import { resolveHeroChapterGeometryFrame } from "../chapters/geometry";
import {
  createHeroHoldTransitionState,
  resolveHeroShake,
  resolveHeroTransitionVisual,
  stepHeroHoldTransition,
  type HeroHoldTransitionState,
} from "../transition/holdTransition";
import { heroTransitionConfig } from "../transition/transitionConfig";
import {
  publishHeroTransitionSignals,
  type HeroTransitionSignalWriter,
} from "../transition/signals";
import {
  createHeroTetrahedronRadialShader,
  createHeroTetrahedronRadialUniforms,
  heroTetrahedronRadialShaderKey,
} from "./shader";
import type { HeroThemeStore } from "../preferences/theme";
import type { HeroLocaleStore } from "../preferences/locale";

export type HeroEffectParams = {
  kind: "hero.tetrahedron.motion";
  signals: HeroTransitionSignalWriter;
  theme: HeroThemeStore;
  locale: HeroLocaleStore;
};

export type HeroMotionState = {
  readonly reducedMotion: boolean;
  previousPointerX: number;
  previousPointerY: number;
  lastSignificantMoveTime: number;
  tiltX: number;
  tiltY: number;
  targetTiltX: number;
  targetTiltY: number;
};

export type HeroMotionInput = {
  readonly time: number;
  readonly delta: number;
  readonly pointerInside: boolean;
  readonly pointerX: number;
  readonly pointerY: number;
};

export type HeroEffectState = {
  readonly reducedMotion: boolean;
  readonly motion: HeroMotionState;
  transition: HeroHoldTransitionState;
  chapterAtlas: HeroChapterAtlas | undefined;
};

type HeroTarget = {
  position: { set(x: number, y: number, z: number): void };
  rotation: { set(x: number, y: number, z: number): void };
  scale: {
    set(x: number, y: number, z: number): void;
    setScalar(value: number): void;
  };
  visible: boolean;
  opacity: number;
  material?: WebGLEffectMaterialFacade;
};

export function createHeroMotionState(reducedMotion: boolean): HeroMotionState {
  return {
    reducedMotion,
    previousPointerX: 0,
    previousPointerY: 0,
    lastSignificantMoveTime: 0,
    tiltX: 0,
    tiltY: 0,
    targetTiltX: 0,
    targetTiltY: 0,
  };
}

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

export function stepHeroMotionState(
  state: HeroMotionState,
  input: HeroMotionInput,
): void {
  if (state.reducedMotion) {
    state.tiltX = 0;
    state.tiltY = 0;
    state.targetTiltX = 0;
    state.targetTiltY = 0;
    return;
  }

  const movement = Math.hypot(
    input.pointerX - state.previousPointerX,
    input.pointerY - state.previousPointerY,
  );
  const nearCenter = Math.hypot(input.pointerX, input.pointerY) <= 0.75;
  const moving = input.pointerInside && nearCenter && movement >= 0.0025;

  if (moving) {
    state.lastSignificantMoveTime = input.time;
    state.targetTiltX = clamp(-input.pointerY * 0.08, -0.08, 0.08);
    state.targetTiltY = clamp(input.pointerX * 0.1, -0.1, 0.1);
  } else if (input.time - state.lastSignificantMoveTime >= 120) {
    state.targetTiltX = 0;
    state.targetTiltY = 0;
  }

  const damping = 1 - Math.exp(-Math.max(0, input.delta) / 160);
  state.tiltX += (state.targetTiltX - state.tiltX) * damping;
  state.tiltY += (state.targetTiltY - state.tiltY) * damping;
  state.previousPointerX = input.pointerX;
  state.previousPointerY = input.pointerY;
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
  const activeAttempt =
    transition.phase === "expanding" || transition.phase === "retracting";
  const hubMotionWeight = activeAttempt
    ? 1 - smoothstep(transition.coverage)
    : 1;
  const ambientWeight = reducedMotion
    ? 0
    : chapter.hubInteractive
      ? hubMotionWeight
      : chapter.domContentActive
        ? 0
        : heroTransitionConfig.motion.transitionAmbientFactor;
  const interactionWeight =
    reducedMotion || chapter.domContentActive
      ? 0
      : chapter.hubInteractive
        ? hubMotionWeight
        : heroTransitionConfig.motion.transitionPointerFactor *
          (1 - chapter.screenLock);
  const shake = resolveHeroShake(time, transition, reducedMotion);
  const baseRotation = reducedMotion
    ? heroTransitionConfig.motion.reducedRotation
    : heroTransitionConfig.motion.baseRotation;
  const breathingPhase = (time / 6_000) * Math.PI * 2;
  const floatingPhase = (time / 8_000) * Math.PI * 2;
  const frame = resolveHeroChapterGeometryFrame(
    viewport,
    chapter,
    baseRotation,
    reducedMotion,
  );

  target.scale.setScalar(
    frame.scale *
      (1 +
        Math.sin(breathingPhase) *
          heroTransitionConfig.motion.breathingScaleAmplitude *
          ambientWeight),
  );
  target.position.set(
    frame.position[0] + shake.position[0],
    frame.position[1] +
      Math.sin(floatingPhase) *
        heroTransitionConfig.motion.floatingAmplitude *
        ambientWeight +
      shake.position[1],
    frame.position[2] + shake.position[2],
  );
  target.rotation.set(
    frame.rotation[0] + motion.tiltX * interactionWeight + shake.rotation[0],
    frame.rotation[1] + motion.tiltY * interactionWeight + shake.rotation[1],
    frame.rotation[2] + shake.rotation[2],
  );

  const visual = resolveHeroTransitionVisual(transition);
  const opacity = lerp(
    heroTransitionConfig.motion.initialOpacity,
    1,
    chapter.screenLock,
  );
  target.visible = !chapter.domContentActive;
  target.opacity = opacity;
  if (target.material) {
    target.material.color.set(visual.committed.foreground);
    target.material.emissive.set(
      visual.committed.foreground,
      heroTransitionConfig.motion.emissiveIntensity,
    );
    target.material.opacity = opacity;
    target.material.shader?.setUniforms(
      heroTetrahedronRadialShaderKey,
      createHeroTetrahedronRadialUniforms(transition, viewport, chapter),
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * clamp(progress, 0, 1);
}

function smoothstep(value: number): number {
  const safeValue = clamp(value, 0, 1);
  return safeValue * safeValue * (3 - 2 * safeValue);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export const heroTetrahedronEffect = defineWebGLSceneObjectEffect<
  HeroEffectParams,
  HeroEffectState
>({
  kind: "hero.tetrahedron.motion",
  source: "mesh",
  schedule: "frame",
  setup(ctx, params) {
    const shader = ctx.object.material?.shader;
    if (!shader) {
      throw new Error(
        "Hero tetrahedron effect requires the managed material shader facade.",
      );
    }
    const viewport = readHeroViewport();
    const chapterAtlas = createHeroChapterAtlas(
      viewport,
      params.locale.getSnapshot(),
    );
    shader.onBeforeCompile(
      createHeroTetrahedronRadialShader(chapterAtlas.canvas),
    );
    return createHeroEffectState(
      prefersReducedMotion(),
      params.theme.getSnapshot(),
      chapterAtlas,
    );
  },
  update(ctx, state, params) {
    stepHeroMotionState(state.motion, {
      time: ctx.time,
      delta: ctx.delta,
      pointerInside: ctx.pointer.isInside,
      pointerX: ctx.pointer.normalizedX,
      pointerY: ctx.pointer.normalizedY,
    });
    const primaryPointerDown =
      ctx.pointer.isDown &&
      (ctx.pointer.button === "primary" ||
        ctx.pointer.buttons.includes("primary"));
    const pointer = {
      x: clamp((ctx.pointer.normalizedX + 1) * 0.5, 0, 1),
      y: clamp((ctx.pointer.normalizedY + 1) * 0.5, 0, 1),
    };
    const viewport = readHeroViewport();
    const chapter = readHeroChapterScrollState(ctx.progress);
    const locale = params.locale.getSnapshot();
    const exitChapterId =
      chapter.exitProgress > 0 ? chapter.chapterId : undefined;
    if (
      state.chapterAtlas &&
      !heroChapterAtlasMatchesViewport(
        state.chapterAtlas,
        viewport,
        locale,
        exitChapterId,
      )
    ) {
      state.chapterAtlas = createHeroChapterAtlas(
        viewport,
        locale,
        exitChapterId,
      );
      ctx.object.material?.shader?.setUniforms(heroTetrahedronRadialShaderKey, {
        heroChapterAtlas: {
          kind: "canvas-texture",
          source: state.chapterAtlas.canvas,
        },
      });
    }

    const previousCommittedScheme = state.transition.committedScheme;
    state.transition = stepHeroHoldTransition(state.transition, {
      interactionEnabled: chapter.hubInteractive,
      meshPressed: ctx.objectPointer.isPressed,
      primaryPointerDown,
      hitConfirmed: ctx.objectPointer.hit !== undefined,
      pointer,
      viewport,
      deltaMs: ctx.delta,
      reducedMotion: state.reducedMotion,
    });
    if (state.transition.committedScheme !== previousCommittedScheme) {
      params.theme.commit(state.transition.committedScheme);
    }
    publishHeroTransitionSignals(params.signals, state.transition);
    applyHeroFrame(
      ctx.object,
      state.motion,
      ctx.time,
      state.transition,
      viewport,
      state.reducedMotion,
      chapter,
    );
  },
  dispose(ctx, state) {
    ctx.object.material?.shader?.remove(heroTetrahedronRadialShaderKey);
    state.chapterAtlas = undefined;
  },
});
