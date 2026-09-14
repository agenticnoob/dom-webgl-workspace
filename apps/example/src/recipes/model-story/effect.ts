import { defineWebGLSceneObjectEffect } from "@viselora/dom-webgl";

import { resolveModelStoryFrame } from "./frame";

export type ModelStoryFraming = {
  /** Center of the untransformed GLB, including its scene-node transforms. */
  readonly center: readonly [number, number, number];
  /** Width, height, depth of its untransformed bounding box, in GLB units. */
  readonly size: readonly [number, number, number];
};

export type ModelStoryVisualState = {
  aspect: number;
  reducedMotion: boolean;
  readonly setModelReady: (ready: boolean) => void;
};

type ModelStoryEffectParams = {
  readonly kind: "recipe.model-story.turn";
  readonly progressKey: string;
  readonly framing: ModelStoryFraming;
  readonly visual: ModelStoryVisualState;
};

const modelStoryTurnEffect = defineWebGLSceneObjectEffect<
  ModelStoryEffectParams,
  { disposed: boolean }
>({
  kind: "recipe.model-story.turn",
  source: "model/glb",
  schedule: "reactive",
  setup(_ctx, params) {
    params.visual.setModelReady(true);
    return { disposed: false };
  },
  update(ctx, state, params) {
    if (state.disposed) return;
    const { rotationY } = resolveModelStoryFrame(
      ctx.progress.get(params.progressKey),
      params.visual.reducedMotion,
    );
    const { position, scale } = resolveModelStoryTransform(
      rotationY,
      params.framing,
      params.visual.aspect,
    );
    ctx.object.rotation.set(0, rotationY, 0);
    ctx.object.scale.setScalar(scale);
    ctx.object.position.set(...position);
  },
  dispose(_ctx, state, params) {
    if (state.disposed) return;
    state.disposed = true;
    params.visual.setModelReady(false);
  },
});

/** Merge into the existing runtime's effects once, outside React render. */
export const modelStoryEffects = [modelStoryTurnEffect];

export function resolveModelStoryTransform(
  rotationY: number,
  framing: ModelStoryFraming,
  aspect: number,
) {
  const { center, size } = framing;
  // A fixed yaw envelope avoids breathing or cropping as the model changes angle.
  const viewHeight = 2 * 4.5 * Math.tan((35 * Math.PI) / 360);
  const scale =
    Math.min(
      viewHeight / size[1],
      (viewHeight * aspect) / Math.hypot(size[0], size[2]),
    ) * 0.78;
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return {
    scale,
    position: [
      -(center[0] * cosine + center[2] * sine) * scale,
      -center[1] * scale,
      -(-center[0] * sine + center[2] * cosine) * scale,
    ] satisfies readonly [number, number, number],
  };
}

export function createModelStoryEffectDeclaration(
  progressKey: string,
  framing: ModelStoryFraming,
  visual: ModelStoryVisualState,
): readonly ModelStoryEffectParams[] {
  if (
    !framing.size.every((value) => Number.isFinite(value) && value > 0) ||
    !framing.center.every(Number.isFinite)
  ) {
    throw new Error(
      "ModelStory framing needs a finite center and three positive dimensions.",
    );
  }
  return [{ kind: "recipe.model-story.turn", progressKey, framing, visual }];
}
