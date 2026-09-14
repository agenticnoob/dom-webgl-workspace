import {
  defineWebGLEffect,
  defineWebGLSceneObjectEffect,
  type WebGLEffectMaterialShaderDefinition,
} from "@viselora/dom-webgl";
import {
  createTimelineFlightState,
  stepTimelineFlight,
  timelineFlightFrame,
} from "./flight";
import {
  timelinePanelMotion,
  timelineLanePosition,
  type TimelinePanel,
  type TimelineViewport,
} from "./track";

export type TimelineStageState = {
  visible: boolean;
  viewport: TimelineViewport;
};
export type TimelineTravelParams = {
  readonly kind: "recipe.timeline.travel";
  readonly progressKey: string;
  readonly stage: TimelineStageState;
  readonly panel: TimelinePanel;
  readonly panels: readonly TimelinePanel[];
  readonly side: "left" | "right";
};

export const timelineTravelEffect = defineWebGLEffect<TimelineTravelParams>({
  kind: "recipe.timeline.travel",
  source: "dom/element",
  schedule: "frame",
  update(ctx, _state, params) {
    const motion = timelinePanelMotion(
      ctx.progress.get(params.progressKey),
      params.panel,
      params.panels,
    );
    ctx.object.visible = params.stage.visible && motion.opacity > 0.001;
    ctx.object.opacity = motion.opacity;
    if (ctx.object.visible)
      ctx.object.position.set(
        ...timelineLanePosition(motion, params.side, params.stage.viewport),
      );
  },
});

const shaderKey = "recipe.timeline.fresnel";
const emissiveChunk = "#include <emissivemap_fragment>";
export const timelineFresnelShader = {
  key: shaderKey,
  uniforms: { timelineThrust: 0 },
  compile(draft) {
    if (
      draft.materialKind === "basic" ||
      !draft.fragmentShader.includes(emissiveChunk)
    )
      throw new Error(
        "PerspectiveTimeline needs a managed standard material with emissive support.",
      );
    draft.fragmentShader =
      `uniform float timelineThrust;\n${draft.fragmentShader}`.replace(
        emissiveChunk,
        `${emissiveChunk}\nfloat timelineRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.2);\ntotalEmissiveRadiance += vec3(0.62, 0.76, 1.0) * timelineRim * (0.22 + timelineThrust * 1.4);`,
      );
  },
} satisfies WebGLEffectMaterialShaderDefinition;

export type TimelineFlightParams = {
  readonly kind: "recipe.timeline.flight";
  readonly stage: TimelineStageState;
};
export const timelineFlightEffect = defineWebGLSceneObjectEffect<
  TimelineFlightParams,
  { disposed: boolean; flight: ReturnType<typeof createTimelineFlightState> }
>({
  kind: "recipe.timeline.flight",
  source: "mesh",
  schedule: "frame",
  setup(ctx) {
    if (!ctx.object.material?.shader)
      throw new Error(
        "PerspectiveTimeline needs the managed material shader facade.",
      );
    ctx.object.material.shader.onBeforeCompile(timelineFresnelShader);
    return { disposed: false, flight: createTimelineFlightState() };
  },
  update(ctx, state, params) {
    if (state.disposed) return;
    ctx.object.visible = params.stage.visible;
    stepTimelineFlight(state.flight, {
      delta: ctx.delta,
      scrollDelta: ctx.input.scroll.velocity,
      height: params.stage.viewport.height,
      active: params.stage.visible,
    });
    if (!params.stage.visible) return;
    const frame = timelineFlightFrame(state.flight, ctx.time);
    ctx.object.position.set(...frame.position);
    ctx.object.rotation.set(
      frame.rotation[0] + 0.2,
      frame.rotation[1] + 0.55,
      frame.rotation[2] + Math.PI,
    );
    ctx.object.scale.setScalar(frame.scale);
    ctx.object.material?.shader?.setUniforms(shaderKey, {
      timelineThrust: frame.glow,
    });
  },
  dispose(ctx, state) {
    if (state.disposed) return;
    state.disposed = true;
    ctx.object.material?.shader?.remove(shaderKey);
  },
});

export const perspectiveTimelineEffects = [
  timelineTravelEffect,
  timelineFlightEffect,
];
