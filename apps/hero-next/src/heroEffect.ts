import { defineWebGLSceneObjectEffect } from "@viselora/dom-webgl";
import gsap from "gsap";

type HeroEffectParams = {
  kind: "hero.tetrahedron.breathe";
  baseScale?: number;
};

export type HeroMotionState = {
  breath: number;
  float: number;
  phase: number;
  reducedMotion: boolean;
};

type HeroTarget = {
  position: { set(x: number, y: number, z: number): void };
  rotation: { set(x: number, y: number, z: number): void };
  scale: { setScalar(value: number): void };
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function applyHeroFrame(
  target: HeroTarget,
  state: HeroMotionState,
  baseScale: number,
): void {
  if (state.reducedMotion) {
    target.scale.setScalar(baseScale);
    target.position.set(0, 0, 0);
    target.rotation.set(-0.22, 0.58, 0.05);
    return;
  }

  target.scale.setScalar(baseScale * (1 + state.breath * 0.02));
  target.position.set(0, state.float * 0.035, 0);
  target.rotation.set(
    -0.22 + Math.sin(state.phase) * 0.08,
    0.58 + Math.cos(state.phase) * 0.06,
    0.05,
  );
}

export const heroTetrahedronEffect = defineWebGLSceneObjectEffect<
  HeroEffectParams,
  HeroMotionState
>({
  kind: "hero.tetrahedron.breathe",
  source: "model/glb",
  schedule: "frame",
  setup(ctx) {
    const state = {
      breath: 0,
      float: -0.5,
      phase: 0,
      reducedMotion: prefersReducedMotion(),
    } satisfies HeroMotionState;

    ctx.object.model?.meshes.forEach((mesh) => {
      mesh.material.color.set("#050607");
      mesh.material.emissive.set("#08090b", 0.08);
      mesh.material.metalness = 0.94;
      mesh.material.roughness = 0.16;
      mesh.material.opacity = 1;
    });

    if (!state.reducedMotion) {
      const breath = gsap.to(state, {
        breath: 1,
        duration: 2.5,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
      const float = gsap.to(state, {
        float: 0.5,
        duration: 2.8,
        delay: 0.35,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
      const phase = gsap.to(state, {
        phase: Math.PI * 2,
        duration: 24,
        ease: "none",
        repeat: -1,
      });

      ctx.resources.addDisposable(() => {
        breath.kill();
        float.kill();
        phase.kill();
      });
    }

    return state;
  },
  update(ctx, state, params) {
    ctx.object.visible = true;
    applyHeroFrame(ctx.object, state, params.baseScale ?? 1.08);
  },
});

export const heroEffects = [heroTetrahedronEffect] as const;
