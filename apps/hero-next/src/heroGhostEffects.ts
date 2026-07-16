import {
  defineWebGLEffect,
  type WebGLEffectLightsFacade,
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
import {
  resolveHeroRadialGeometry,
  resolveHeroTransitionVisual,
  type HeroViewport,
} from "./heroHoldTransition";
import { heroTransitionConfig } from "./heroTransitionConfig";
import {
  readHeroTransitionSignals,
  type HeroTransitionSignalReader,
} from "./heroTransitionSignals";

type HeroGhostProjectionParams = {
  depth: number;
  fov: number;
  overscan: number;
};

type HeroGhostBackgroundParams = HeroGhostProjectionParams & {
  kind: "hero.ghost.background";
};

type HeroGhostEffectState = {
  motion: HeroGhostCursorState;
  materialLayer: WebGLEffectMaterialLayerHandle | undefined;
  pointerLight: HeroPointerLightState;
};

export type HeroPointerLightState = {
  readonly reducedMotion: boolean;
  x: number;
  y: number;
  z: number;
  intensity: number;
};

type HeroPointerLightTargetInput = {
  readonly localX: number;
  readonly localY: number;
  readonly width: number;
  readonly height: number;
};

type HeroPointerLightInput = HeroPointerLightTargetInput & {
  readonly active: boolean;
  readonly delta: number;
};

type HeroGhostOverscanInput = {
  readonly width: number;
  readonly height: number;
  readonly viewportHeight: number;
  readonly depth: number;
  readonly fov: number;
  readonly overscan: number;
};

export const heroPointerLightKey = "hero.pointer-light";

const heroPointerLightPosition = [0, 0.365, 0.8] satisfies readonly [
  number,
  number,
  number,
];
const heroPointerLightIntensity = 10;
const heroPointerLightReducedMotionIntensity = 0.45;

export function createHeroPointerLightState(
  reducedMotion: boolean,
): HeroPointerLightState {
  return {
    reducedMotion,
    x: heroPointerLightPosition[0],
    y: heroPointerLightPosition[1],
    z: heroPointerLightPosition[2],
    intensity: reducedMotion ? heroPointerLightReducedMotionIntensity : 0,
  };
}

export function resolveHeroPointerLightTarget({
  localX,
  localY,
  width,
  height,
}: HeroPointerLightTargetInput): [number, number, number] {
  const normalizedX =
    width > 0 ? clamp((localX / width) * 2 - 1, -1, 1) : 0;
  const normalizedY =
    height > 0 ? clamp(1 - (localY / height) * 2, -1, 1) : 0;

  return [
    normalizedX * 1.05,
    heroPointerLightPosition[1] + normalizedY * 0.72,
    heroPointerLightPosition[2],
  ];
}

export function updateHeroPointerLight(
  lights: WebGLEffectLightsFacade | undefined,
  state: HeroPointerLightState,
  input: HeroPointerLightInput,
): void {
  if (state.reducedMotion) {
    state.x = heroPointerLightPosition[0];
    state.y = heroPointerLightPosition[1];
    state.z = heroPointerLightPosition[2];
    state.intensity = heroPointerLightReducedMotionIntensity;
  } else {
    const delta = clamp(input.delta, 0, 64);

    if (input.active) {
      const [targetX, targetY, targetZ] =
        resolveHeroPointerLightTarget(input);
      const positionDamping = 1 - Math.exp(-delta / 90);
      state.x += (targetX - state.x) * positionDamping;
      state.y += (targetY - state.y) * positionDamping;
      state.z += (targetZ - state.z) * positionDamping;
    }

    const targetIntensity = input.active ? heroPointerLightIntensity : 0;
    const intensityDamping =
      1 - Math.exp(-delta / (input.active ? 120 : 180));
    state.intensity +=
      (targetIntensity - state.intensity) * intensityDamping;
    if (state.intensity < 0.0001) {
      state.intensity = 0;
    }
  }

  lights?.point(heroPointerLightKey, {
    color: "#f0f0f0",
    intensity: state.intensity,
    distance: 1.8,
    decay: 3,
    position: [state.x, state.y, state.z],
    follow: "none",
  });
}

export function disposeHeroPointerLight(
  lights: WebGLEffectLightsFacade | undefined,
): void {
  lights?.remove(heroPointerLightKey);
}

export function resolveHeroGhostOverscanScale({
  width,
  height,
  viewportHeight,
  depth,
  fov,
  overscan,
}: HeroGhostOverscanInput): [number, number, number] {
  const verticalSpan = 2 * depth * Math.tan((fov * Math.PI) / 360);
  const unitsPerPixel = verticalSpan / Math.max(1, viewportHeight);

  return [
    width * unitsPerPixel * overscan,
    height * unitsPerPixel * overscan,
    1,
  ];
}

export function resolveHeroGhostProgramState(
  reader: HeroTransitionSignalReader,
  viewport: HeroViewport,
): {
  readonly baseBackgroundColor: string;
  readonly baseForegroundColor: string;
  readonly targetBackgroundColor: string;
  readonly targetForegroundColor: string;
  readonly radialOrigin: readonly [number, number];
  readonly radialRadiusPx: number;
  readonly radialEdgePx: number;
} {
  const snapshot = readHeroTransitionSignals(reader);
  const visual = resolveHeroTransitionVisual(snapshot);
  const radial = resolveHeroRadialGeometry(
    snapshot.coverage,
    snapshot.origin,
    viewport,
  );

  return {
    baseBackgroundColor: visual.committed.background,
    baseForegroundColor: visual.committed.foreground,
    targetBackgroundColor: visual.target.background,
    targetForegroundColor: visual.target.foreground,
    radialOrigin: [radial.origin.x, radial.origin.y],
    radialRadiusPx: radial.radiusPx,
    radialEdgePx: radial.edgeFeatherPx,
  };
}

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
  dispose(ctx, state) {
    state.materialLayer?.dispose();
    state.materialLayer = undefined;
    disposeHeroPointerLight(ctx.object.lights);
  },
});

export const heroGhostEffects = [heroGhostBackgroundEffect] as const;

function createEffectState(
  layer: HeroGhostLayer,
  ctx: WebGLEffectUpdateContext,
  _params: HeroGhostProjectionParams,
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
  const pointerLight = createHeroPointerLightState(reducedMotion);
  const materialLayer = ctx.object.surface?.createMaterialLayer({
    key: `hero.ghost.${layer}`,
    mode: "replace-source",
    program: createHeroGhostCursorMaterialProgram(
      layer,
      createProgramOptions(layer, ctx, motion),
    ),
  });

  return { motion, materialLayer, pointerLight };
}

function updateEffect(
  layer: HeroGhostLayer,
  ctx: WebGLEffectUpdateContext,
  state: HeroGhostEffectState,
  params: HeroGhostProjectionParams,
): void {
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
  updateHeroPointerLight(ctx.object.lights, state.pointerLight, {
    active,
    localX,
    localY,
    width: ctx.layout.width,
    height: ctx.layout.height,
    delta: ctx.delta,
  });

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
        createProgramOptions(layer, ctx, state.motion),
      ),
    });
  }

  ctx.object.scale.set(
    ...resolveHeroGhostOverscanScale({
      width: ctx.layout.width,
      height: ctx.layout.height,
      viewportHeight: ctx.layout.viewport.height,
      depth: params.depth,
      fov: params.fov,
      overscan: params.overscan,
    }),
  );

  state.materialLayer.setUniforms(
    createHeroGhostCursorUniforms(
      layer,
      createProgramOptions(layer, ctx, state.motion),
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
) {
  const programState = resolveHeroGhostProgramState(
    ctx.progress,
    ctx.layout.viewport,
  );

  return {
    width: ctx.layout.width,
    height: ctx.layout.height,
    pointerX: motion.pointerX,
    pointerY: motion.pointerY,
    pointerIntensity: motion.intensity,
    time: motion.reducedMotion ? 0 : ctx.time,
    ...programState,
    brightness:
      layer === "background"
        ? heroTransitionConfig.visual.ghostBrightness
        : 0.18,
    trailPoints: motion.trail,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
