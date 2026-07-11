import {
  defineWebGLEffect,
  type WebGLEffectMaterialLayerHandle,
} from "@viselora/dom-webgl";

type ImageHoverParams = { kind: "story.imageHover" };
type ImageScrollParams = { kind: "story.imageScroll"; progressKey: string };
type HoverState = { layer: WebGLEffectMaterialLayerHandle | undefined };

const hoverFragmentShader = `
  uniform sampler2D uSourceTexture;
  uniform float uHover;
  varying vec2 vUv;

  void main() {
    vec4 source = texture2D(uSourceTexture, vUv);
    float edge = 1.0 - smoothstep(0.2, 0.8, distance(vUv, vec2(0.5)));
    vec3 tint = vec3(0.49, 0.83, 0.98);
    gl_FragColor = vec4(mix(source.rgb, tint, uHover * edge * 0.35), source.a);
  }
`;

export const imageHoverOverlayEffect = defineWebGLEffect<
  ImageHoverParams,
  HoverState
>({
  kind: "story.imageHover",
  source: "media/image",
  setup() {
    return { layer: undefined };
  },
  update(ctx, state) {
    const material = ctx.object.texture?.material;
    if (!material) return;
    if (!state.layer) {
      const layer = material.createMaterialLayer({
        key: `${ctx.key}.hover-overlay`,
        mode: "replace-source",
        sourceTextureUniform: "uSourceTexture",
        program: {
          fragmentShader: hoverFragmentShader,
          uniforms: { uHover: 0 },
        },
      });
      ctx.resources.addDisposable(() => layer.dispose());
      state.layer = layer;
    }
    state.layer.setUniforms({
      uHover: ctx.targetPointer.isInside ? 1 : 0,
    });
    ctx.object.visible = true;
  },
  dispose(_ctx, state) {
    state.layer?.dispose();
  },
});

export const imageScrollProgressEffect = defineWebGLEffect<ImageScrollParams>({
  kind: "story.imageScroll",
  source: "media/image",
  update(ctx, _state, params) {
    const progress = Math.min(1, Math.max(0, ctx.progress.get(params.progressKey)));
    ctx.object.texture?.setTransform({
      repeatX: 1.04,
      repeatY: 1.04,
      offsetX: progress * 0.025,
      offsetY: (1 - progress) * 0.015,
    });
    ctx.object.visible = true;
  },
});

export const runtimeEffects = [
  imageHoverOverlayEffect,
  imageScrollProgressEffect,
] as const;
