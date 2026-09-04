import { defineWebGLSceneObjectEffect } from "@viselora/dom-webgl";

import { readHeroChapterScrollState } from "../chapters/scrollState";
import { readHeroViewport } from "../shared/viewport";
import {
  createHeroMotionState,
  stepHeroMotionState,
  type HeroMotionState,
} from "../tetrahedron/motion";
import {
  resolveHeroTransitionVisual,
  type HeroHoldTransitionState,
} from "../transition/holdTransition";
import { readHeroTransitionSignals } from "../transition/signals";
import {
  resolveHeroProfileModelFrame,
  type HeroProfileModelFrame,
} from "./frame";
import {
  heroProfileMaterialShader,
  heroProfileMaterialShaderKey,
} from "./materialShader";

export type HeroProfileModelEffectParams = {
  readonly kind: "hero.profile.model";
  readonly spinProgressKey: string;
};

type HeroProfileModelEffectState = {
  readonly reducedMotion: boolean;
  readonly motion: HeroMotionState;
};

export {
  resolveHeroProfileModelFrame,
  type HeroProfileModelFrame,
} from "./frame";

export const heroProfileModelEffect = defineWebGLSceneObjectEffect<
  HeroProfileModelEffectParams,
  HeroProfileModelEffectState
>({
  kind: "hero.profile.model",
  source: "model/glb",
  schedule: "frame",
  setup(ctx) {
    ctx.object.model?.meshes.forEach((mesh) => {
      mesh.material.shader?.onBeforeCompile(heroProfileMaterialShader);
    });
    const reducedMotion = prefersReducedMotion();
    return {
      reducedMotion,
      motion: createHeroMotionState(reducedMotion),
    };
  },
  update(ctx, state, params) {
    stepHeroMotionState(state.motion, {
      time: ctx.time,
      delta: ctx.delta,
      pointerInside: ctx.pointer.isInside,
      pointerX: ctx.pointer.normalizedX,
      pointerY: ctx.pointer.normalizedY,
    });
    const transitionSignals = readHeroTransitionSignals(ctx.progress);
    const transition = {
      coverage: transitionSignals.coverage,
      phase: transitionSignals.phase,
      shakeActive: transitionSignals.phase === "expanding",
    } satisfies Pick<
      HeroHoldTransitionState,
      "coverage" | "phase" | "shakeActive"
    >;
    const frame = resolveHeroProfileModelFrame({
      chapter: readHeroChapterScrollState(ctx.progress),
      spinProgress: ctx.progress.get(params.spinProgressKey),
      viewport: readHeroViewport(),
      reducedMotion: state.reducedMotion,
      motion: state.motion,
      time: ctx.time,
      transition,
    });
    const profileMaterialColor =
      resolveHeroTransitionVisual(transitionSignals).committed.background;

    ctx.object.visible = frame.visible;
    ctx.object.position.set(...frame.position);
    ctx.object.rotation.set(...frame.rotation);
    ctx.object.scale.set(...frame.scale);
    ctx.object.model?.meshes.forEach((mesh) => {
      mesh.material.color.set(profileMaterialColor);
      mesh.material.emissive.set(profileMaterialColor, 0);
      mesh.material.metalness = 0;
      mesh.material.roughness = 1;
    });
  },
  dispose(ctx) {
    ctx.object.model?.meshes.forEach((mesh) => {
      mesh.material.shader?.remove(heroProfileMaterialShaderKey);
      mesh.material.restore();
    });
  },
});

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
