import {
  defineWebGLEffect,
  type WebGLEffectMaterialLayerHandle,
} from "@viselora/dom-webgl";

type SurfacePulseParams = { kind: "viselora.surfacePulse"; color?: string };
type VideoBackgroundParams = { kind: "viselora.videoBackground" };
type ImageHoverOverlayParams = { kind: "viselora.imageHoverOverlay" };
type ModelGlowParams = {
  kind: "viselora.modelGlow";
  progressKey: string;
  clip: string;
  durationSeconds: number;
};
type ImageSequenceParams = {
  kind: "viselora.imageSequence";
  progressKey: string;
};
type HoverState = { layer: WebGLEffectMaterialLayerHandle | undefined };
type VideoState = { configured: boolean };

const hoverFragmentShader = `
  uniform float uHover;
  varying vec2 vUv;
  void main() {
    float edge = 1.0 - smoothstep(0.2, 0.8, distance(vUv, vec2(0.5)));
    gl_FragColor = vec4(0.49, 0.83, 0.98, uHover * edge * 0.5);
  }
`;

export const surfacePulseEffect = defineWebGLEffect<SurfacePulseParams>({
  kind: "viselora.surfacePulse",
  source: "dom/element",
  schedule: "frame",
  update(ctx, _state, params) {
    const surface = ctx.object.surface;
    if (!surface) return;
    const pulse = 0.5 + Math.sin(ctx.time / 420) * 0.5;
    const color = params.color ?? "#7dd3fc";
    ctx.object.material?.color.set(color);
    surface.draw(({ context, width, height }) => {
      context.clearRect(0, 0, width, height);
      context.globalAlpha = 0.3 + pulse * 0.5;
      context.fillStyle = color;
      context.beginPath();
      context.arc(width / 2, height / 2, Math.min(width, height) * (0.2 + pulse * 0.08), 0, Math.PI * 2);
      context.fill();
    });
    ctx.object.visible = true;
  },
});

export const videoBackgroundEffect = defineWebGLEffect<
  VideoBackgroundParams,
  VideoState
>({
  kind: "viselora.videoBackground",
  source: "media/video",
  schedule: "frame",
  setup() {
    return { configured: false };
  },
  update(ctx, state) {
    const drift = (Math.sin(ctx.time / 1800) + 1) * 0.015;
    if (ctx.object.video && !state.configured) {
      ctx.object.video.setMuted(true);
      ctx.object.video.setPlaybackRate(0.9);
      void ctx.object.video.play();
      state.configured = true;
    }
    ctx.object.texture?.setTransform({
      repeatX: 1.06,
      repeatY: 1.06,
      offsetX: drift,
      offsetY: 0.03 - drift,
    });
    ctx.object.visible = true;
  },
});

export const imageHoverOverlayEffect = defineWebGLEffect<
  ImageHoverOverlayParams,
  HoverState
>({
  kind: "viselora.imageHoverOverlay",
  source: "media/image",
  setup() {
    return { layer: undefined };
  },
  update(ctx, state) {
    const material = ctx.object.texture?.material;
    if (!material) return;
    state.layer ??= material.createMaterialLayer({
      key: `${ctx.key}.hover-overlay`,
      mode: "overlay",
      program: { fragmentShader: hoverFragmentShader, uniforms: { uHover: 0 } },
    });
    state.layer.setUniforms({ uHover: ctx.targetPointer.isInside ? 1 : 0 });
    ctx.object.visible = true;
  },
  dispose(_ctx, state) {
    state.layer?.dispose();
  },
});

export const modelGlowEffect = defineWebGLEffect<ModelGlowParams>({
  kind: "viselora.modelGlow",
  source: "model/glb",
  update(ctx, _state, params) {
    const progress = Math.min(1, Math.max(0, ctx.progress.get(params.progressKey)));
    ctx.object.animation?.scrub(params.clip, {
      progress,
      durationSeconds: params.durationSeconds,
    });
    ctx.object.material?.emissive.set("#f6c453", 0.4 + progress * 1.6);
    ctx.object.model?.meshes.forEach((mesh) => {
      mesh.material.emissive.set("#f6c453", 0.3 + progress * 1.2);
    });
    ctx.object.lights?.point(`${ctx.key}.glow`, {
      color: "#f6c453",
      intensity: 0.8 + progress * 2.2,
      distance: 420,
      follow: "object",
    });
    ctx.object.visible = true;
  },
  dispose(ctx) {
    ctx.object.lights?.remove(`${ctx.key}.glow`);
  },
});

export const imageSequenceEffect = defineWebGLEffect<ImageSequenceParams>({
  kind: "viselora.imageSequence",
  source: "media/image-sequence",
  update(ctx, _state, params) {
    const progress = Math.min(1, Math.max(0, ctx.progress.get(params.progressKey)));
    ctx.object.texture?.setTransform({
      repeatX: 1.02,
      repeatY: 1.02,
      offsetX: progress * 0.02,
    });
    ctx.object.visible = true;
  },
});

export const runtimeEffects = [
  surfacePulseEffect,
  videoBackgroundEffect,
  imageHoverOverlayEffect,
  modelGlowEffect,
  imageSequenceEffect,
] as const;
