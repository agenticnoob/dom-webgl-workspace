import {
  defineWebGLEffect,
  type WebGLEffectMaterialLayerHandle,
  type WebGLEffectUpdateContext,
} from "@viselora/dom-webgl";

import {
  createHeroGhostCursorMaterialProgram,
  createHeroGhostCursorUniforms,
  type HeroGhostLayer,
} from "./heroGhostCursorProgram";
import {
  createHeroGhostCursorState,
  stepHeroGhostCursorState,
  type HeroGhostCursorState,
} from "./heroGhostCursorState";

type HeroGhostBackgroundParams = {
  kind: "hero.ghost.background";
  color?: string;
  brightness?: number;
};

type HeroGhostForegroundParams = {
  kind: "hero.ghost.foreground";
  color?: string;
  brightness?: number;
};

type HeroGhostEffectState = {
  motion: HeroGhostCursorState;
  materialLayer: WebGLEffectMaterialLayerHandle | undefined;
};

export const heroGhostBackgroundEffect = defineWebGLEffect<
  HeroGhostBackgroundParams,
  HeroGhostEffectState
>({
  kind: "hero.ghost.background",
  source: "dom/element",
  schedule: "frame",
  setup(ctx, params) {
    return createEffectState("background", ctx, params);
  },
  update(ctx, state, params) {
    updateEffect("background", ctx, state, params);
  },
  dispose(_ctx, state) {
    state.materialLayer?.dispose();
    state.materialLayer = undefined;
  },
});

export const heroGhostForegroundEffect = defineWebGLEffect<
  HeroGhostForegroundParams,
  HeroGhostEffectState
>({
  kind: "hero.ghost.foreground",
  source: "dom/element",
  schedule: "frame",
  setup(ctx, params) {
    return createEffectState("foreground", ctx, params);
  },
  update(ctx, state, params) {
    updateEffect("foreground", ctx, state, params);
  },
  dispose(_ctx, state) {
    state.materialLayer?.dispose();
    state.materialLayer = undefined;
  },
});

export const heroGhostEffects = [
  heroGhostBackgroundEffect,
  heroGhostForegroundEffect,
] as const;

function createEffectState(
  layer: HeroGhostLayer,
  ctx: WebGLEffectUpdateContext,
  params: { color?: string; brightness?: number },
): HeroGhostEffectState {
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motion = createHeroGhostCursorState(
    layer,
    ctx.layout.width,
    ctx.layout.height,
    reducedMotion,
  );
  const materialLayer = ctx.object.surface?.createMaterialLayer({
    key: `hero.ghost.${layer}`,
    mode: "replace-source",
    program: createHeroGhostCursorMaterialProgram(
      layer,
      createProgramOptions(layer, ctx, motion, params),
    ),
  });

  return { motion, materialLayer };
}

function updateEffect(
  layer: HeroGhostLayer,
  ctx: WebGLEffectUpdateContext,
  state: HeroGhostEffectState,
  params: { color?: string; brightness?: number },
): void {
  const surface = ctx.object.surface;
  if (!surface) {
    return;
  }

  if (!state.materialLayer) {
    state.materialLayer = surface.createMaterialLayer({
      key: `hero.ghost.${layer}`,
      mode: "replace-source",
      program: createHeroGhostCursorMaterialProgram(
        layer,
        createProgramOptions(layer, ctx, state.motion, params),
      ),
    });
  }

  const localX = ctx.targetPointer.localX;
  const localY = ctx.targetPointer.localY;
  const active =
    ctx.targetPointer.isInside &&
    localX >= 0 &&
    localX <= ctx.layout.width &&
    localY >= 0 &&
    localY <= ctx.layout.height;
  stepHeroGhostCursorState(state.motion, {
    active,
    x: active ? localX : ctx.layout.width * 0.5,
    y: active ? localY : ctx.layout.height * 0.5,
  });

  state.materialLayer.setUniforms(
    createHeroGhostCursorUniforms(
      layer,
      createProgramOptions(layer, ctx, state.motion, params),
    ),
  );
  ctx.object.visible = true;
  surface.setVisible?.(true);
  surface.setOpacity?.(1);
}

function createProgramOptions(
  layer: HeroGhostLayer,
  ctx: WebGLEffectUpdateContext,
  motion: HeroGhostCursorState,
  params: { color?: string; brightness?: number },
) {
  return {
    width: ctx.layout.width,
    height: ctx.layout.height,
    pointerX: motion.pointerX,
    pointerY: motion.pointerY,
    pointerIntensity: motion.intensity,
    time: motion.reducedMotion ? 0 : ctx.time,
    color: params.color ?? "#b497cf",
    brightness: params.brightness ?? (layer === "background" ? 0.9 : 0.18),
    trailPoints: motion.trail,
  };
}
