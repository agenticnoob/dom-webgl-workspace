// Optional verified recipe for 0.1.0-alpha.1. Read capability-status.md before use.
import {
  defineWebGLEffect,
  type WebGLEffectMaterialLayerHandle,
} from "@viselora/dom-webgl";

type ImageHoverOverlayParams = {
  kind: "viselora.imageHoverOverlay";
  color?: readonly [number, number, number];
};

type ImageHoverOverlayState = {
  layer: WebGLEffectMaterialLayerHandle | undefined;
};

const fragmentShader = `
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
  ImageHoverOverlayParams,
  ImageHoverOverlayState
>({
  kind: "viselora.imageHoverOverlay",
  source: "media/image",
  setup() {
    return { layer: undefined };
  },
  update(ctx, state, params) {
    const material = ctx.object.texture?.material;
    if (!material) {
      return;
    }

    if (!state.layer) {
      const layer = material.createMaterialLayer({
        key: `${ctx.key}.hover-overlay`,
        mode: "replace-source",
        sourceTextureUniform: "uSourceTexture",
        program: {
          fragmentShader,
          uniforms: {
            uHover: 0,
          },
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

export const imageHoverOverlayTarget = {
  key: "viselora.image-hover",
  source: { kind: "media", type: "image", src: "/media/product.webp" },
  pointer: { hover: true },
  lifecycle: {
    hideWhenReady: true,
    hideMode: "self",
    offscreen: { strategy: "restore-dom" },
  },
  effects: [{ kind: "viselora.imageHoverOverlay" }],
} as const;
