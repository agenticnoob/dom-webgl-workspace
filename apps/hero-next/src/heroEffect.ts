import { defineWebGLSceneObjectEffect } from "@viselora/dom-webgl";

type HeroEffectParams = {
  kind: "hero.tetrahedron.motion";
  baseScale?: number;
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

type HeroTarget = {
  position: { set(x: number, y: number, z: number): void };
  rotation: { set(x: number, y: number, z: number): void };
  scale: { setScalar(value: number): void };
};

type HeroMaterialTarget = {
  material: {
    color: { set(value: string): void };
    emissive: { set(value: string, intensity: number): void };
    metalness: number;
    roughness: number;
    opacity: number;
  };
};

export function applyHeroMaterial(mesh: HeroMaterialTarget): void {
  mesh.material.color.set("#30343b");
  mesh.material.emissive.set("#0d0a12", 0.06);
  mesh.material.metalness = 0.9;
  mesh.material.roughness = 0.12;
  mesh.material.opacity = 1;
}

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
  state: HeroMotionState,
  time: number,
  baseScale: number,
  yOffset = 0,
): void {
  target.scale.setScalar(baseScale);
  target.position.set(0, yOffset, 0);

  if (state.reducedMotion) {
    target.rotation.set(-0.45, 0.92, 0.08);
    return;
  }

  const phase = (time / 48_000) * Math.PI * 2;
  target.rotation.set(
    -0.45 + Math.sin(phase * 0.6) * 0.05 + state.tiltX,
    0.92 + phase + state.tiltY,
    0.08 + Math.sin(phase * 0.35) * 0.03,
  );
}

export function resolveHeroBaseScale(
  viewportWidth: number,
  baseScale: number,
): number {
  return viewportWidth <= 700 ? baseScale * 0.6 : baseScale;
}

export function resolveHeroYOffset(viewportWidth: number): number {
  return viewportWidth <= 700 ? 0.19 : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export const heroTetrahedronEffect = defineWebGLSceneObjectEffect<
  HeroEffectParams,
  HeroMotionState
>({
  kind: "hero.tetrahedron.motion",
  source: "model/glb",
  schedule: "frame",
  setup(ctx) {
    ctx.object.model?.meshes.forEach(applyHeroMaterial);
    return createHeroMotionState(prefersReducedMotion());
  },
  update(ctx, state, params) {
    stepHeroMotionState(state, {
      time: ctx.time,
      delta: ctx.delta,
      pointerInside: ctx.pointer.isInside,
      pointerX: ctx.pointer.normalizedX,
      pointerY: ctx.pointer.normalizedY,
    });
    const baseScale = params.baseScale ?? 1.12;
    const viewportWidth =
      typeof window === "undefined" ? Number.POSITIVE_INFINITY : window.innerWidth;
    applyHeroFrame(
      ctx.object,
      state,
      ctx.time,
      resolveHeroBaseScale(viewportWidth, baseScale),
      resolveHeroYOffset(viewportWidth),
    );
    ctx.object.visible = true;
  },
});

export const heroEffects = [heroTetrahedronEffect] as const;
