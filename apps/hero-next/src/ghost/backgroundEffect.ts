import {
  defineWebGLEffect,
  type WebGLEffectMaterialLayerHandle,
  type WebGLEffectUpdateContext,
} from "@viselora/dom-webgl";

import {
  createHeroGhostCursorMaterialProgram,
  createHeroGhostCursorUniforms,
  type HeroGhostLayer,
} from "./cursorProgram";
import {
  createHeroGhostCursorState,
  stepHeroGhostCursorState,
  type HeroGhostCursorState,
} from "./cursorState";
import { readHeroChapterScrollState } from "../chapters/scrollState";
import {
  resolveHeroRadialGeometry,
  resolveHeroTransitionVisual,
} from "../transition/holdTransition";
import type { HeroViewport } from "../shared/viewport";
import { heroTransitionConfig } from "../transition/transitionConfig";
import {
  readHeroTransitionSignals,
  type HeroTransitionSignalReader,
} from "../transition/signals";
import {
  createHeroPointerLightState,
  disposeHeroPointerLight,
  updateHeroPointerLight,
  type HeroPointerLightState,
} from "./pointerLight";

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

type HeroGhostOverscanInput = {
  readonly width: number;
  readonly height: number;
  readonly viewportHeight: number;
  readonly depth: number;
  readonly fov: number;
  readonly overscan: number;
};

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
  readonly sceneOpacity: number;
} {
  const snapshot = readHeroTransitionSignals(reader);
  const chapter = readHeroChapterScrollState(reader);
  const visual = resolveHeroTransitionVisual(snapshot);
  const profileBodyActive =
    chapter.chapterId === "self" && chapter.domContentActive;
  const radial = resolveHeroRadialGeometry(
    snapshot.coverage,
    snapshot.origin,
    viewport,
  );

  return {
    baseBackgroundColor: profileBodyActive
      ? visual.committed.foreground
      : visual.committed.background,
    baseForegroundColor: profileBodyActive
      ? visual.committed.background
      : visual.committed.foreground,
    targetBackgroundColor: profileBodyActive
      ? visual.target.foreground
      : visual.target.background,
    targetForegroundColor: profileBodyActive
      ? visual.target.background
      : visual.target.foreground,
    radialOrigin: [radial.origin.x, radial.origin.y],
    radialRadiusPx: radial.radiusPx,
    radialEdgePx: radial.edgeFeatherPx,
    sceneOpacity: profileBodyActive || !chapter.domContentActive ? 1 : 0,
  };
}

export function resolveHeroPointerLightIntensityScale(
  reader: HeroTransitionSignalReader,
): number {
  return resolveChapterIntensityScale(reader, 0.04);
}

export function resolveHeroGhostCursorIntensityScale(
  reader: HeroTransitionSignalReader,
): number {
  return resolveChapterIntensityScale(reader, 0.1);
}

function resolveChapterIntensityScale(
  reader: HeroTransitionSignalReader,
  chapterIntensityScale: number,
): number {
  const chapter = readHeroChapterScrollState(reader);

  if (chapter.exitProgress > 0) {
    return lerp(chapterIntensityScale, 1, smoothstep(chapter.exitProgress));
  }

  return lerp(1, chapterIntensityScale, smoothstep(chapter.entryProgress));
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
    intensityScale: resolveHeroPointerLightIntensityScale(ctx.progress),
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

  const programOptions = createProgramOptions(layer, ctx, state.motion);
  state.materialLayer.setUniforms(
    createHeroGhostCursorUniforms(layer, programOptions),
  );
  const visible = programOptions.sceneOpacity > 0;
  ctx.object.visible = visible;
  surface.setVisible?.(visible);
  surface.setOpacity?.(1);
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function smoothstep(value: number): number {
  const safeValue = Math.max(0, Math.min(1, value));
  return safeValue * safeValue * (3 - 2 * safeValue);
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
    pointerIntensity:
      motion.intensity * resolveHeroGhostCursorIntensityScale(ctx.progress),
    time: motion.reducedMotion ? 0 : ctx.time,
    ...programState,
    brightness:
      layer === "background"
        ? heroTransitionConfig.visual.ghostBrightness
        : 0.18,
    trailPoints: motion.trail,
  };
}
