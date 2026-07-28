import {
  defineWebGLSceneObjectEffect,
  type WebGLEffectMaterialFacade,
} from "@viselora/dom-webgl";

import {
  createHeroHoldTransitionState,
  resolveHeroShake,
  resolveHeroTransitionVisual,
  stepHeroHoldTransition,
  type HeroHoldTransitionState,
  type HeroViewport,
} from "./heroHoldTransition";
import { heroTransitionConfig } from "./heroTransitionConfig";
import {
  publishHeroTransitionSignals,
  type HeroTransitionSignalWriter,
} from "./heroTransitionSignals";
import {
  createHeroTetrahedronRadialUniforms,
  heroTetrahedronRadialShader,
} from "./heroTetrahedronShader";

export type HeroEffectParams = {
  kind: "hero.tetrahedron.motion";
  signals: HeroTransitionSignalWriter;
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
};

type HeroTarget = {
  position: { set(x: number, y: number, z: number): void };
  rotation: { set(x: number, y: number, z: number): void };
  scale: { setScalar(value: number): void };
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

export function createHeroEffectState(reducedMotion: boolean): HeroEffectState {
  return {
    reducedMotion,
    motion: createHeroMotionState(reducedMotion),
    transition: createHeroHoldTransitionState(),
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
): void {
  const activeAttempt =
    transition.phase === "expanding" || transition.phase === "retracting";
  const ambientWeight = reducedMotion
    ? 0
    : activeAttempt
      ? 1 - smoothstep(transition.coverage)
      : 1;
  const shake = resolveHeroShake(time, transition, reducedMotion);
  const baseScale =
    viewport.width <= heroTransitionConfig.motion.mobileBreakpoint
      ? heroTransitionConfig.motion.baseScale *
        heroTransitionConfig.motion.mobileScaleFactor
      : heroTransitionConfig.motion.baseScale;
  const yOffset =
    viewport.width <= heroTransitionConfig.motion.mobileBreakpoint
      ? heroTransitionConfig.motion.mobileYOffset
      : heroTransitionConfig.motion.desktopYOffset;
  const baseRotation = reducedMotion
    ? heroTransitionConfig.motion.reducedRotation
    : heroTransitionConfig.motion.baseRotation;
  const breathingPhase = (time / 6_000) * Math.PI * 2;
  const floatingPhase = (time / 8_000) * Math.PI * 2;

  target.scale.setScalar(
    baseScale * (1 + Math.sin(breathingPhase) * 0.012 * ambientWeight),
  );
  target.position.set(
    shake.position[0],
    yOffset +
      Math.sin(floatingPhase) * 0.018 * ambientWeight +
      shake.position[1],
    shake.position[2],
  );
  target.rotation.set(
    baseRotation[0] + motion.tiltX * ambientWeight + shake.rotation[0],
    baseRotation[1] + motion.tiltY * ambientWeight + shake.rotation[1],
    baseRotation[2] + shake.rotation[2],
  );

  const visual = resolveHeroTransitionVisual(transition);
  target.visible = true;
  target.opacity = heroTransitionConfig.motion.initialOpacity;
  if (target.material) {
    target.material.color.set(visual.committed.foreground);
    target.material.emissive.set(
      visual.committed.foreground,
      heroTransitionConfig.motion.emissiveIntensity,
    );
    target.material.opacity = heroTransitionConfig.motion.initialOpacity;
    target.material.shader?.setUniforms(
      heroTetrahedronRadialShader.key,
      createHeroTetrahedronRadialUniforms(transition, viewport),
    );
  }
}

function readHeroViewport(): HeroViewport {
  const fallback = { width: 1_440, height: 900 } as const;
  if (typeof window === "undefined") {
    return fallback;
  }

  return {
    width: positive(window.innerWidth, fallback.width),
    height: positive(window.innerHeight, fallback.height),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value: number): number {
  const safeValue = clamp(value, 0, 1);
  return safeValue * safeValue * (3 - 2 * safeValue);
}

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
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
  setup(ctx) {
    const shader = ctx.object.material?.shader;
    if (!shader) {
      throw new Error(
        "Hero tetrahedron effect requires the managed material shader facade.",
      );
    }
    shader.onBeforeCompile(heroTetrahedronRadialShader);
    return createHeroEffectState(prefersReducedMotion());
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

    state.transition = stepHeroHoldTransition(state.transition, {
      meshPressed: ctx.objectPointer.isPressed,
      primaryPointerDown,
      hitConfirmed: ctx.objectPointer.hit !== undefined,
      pointer,
      viewport,
      deltaMs: ctx.delta,
      reducedMotion: state.reducedMotion,
    });
    publishHeroTransitionSignals(params.signals, state.transition);
    applyHeroFrame(
      ctx.object,
      state.motion,
      ctx.time,
      state.transition,
      viewport,
      state.reducedMotion,
    );
  },
});

export const heroEffects = [heroTetrahedronEffect] as const;
