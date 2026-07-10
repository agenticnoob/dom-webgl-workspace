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
  uniform float uHover;
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    float vignette = 1.0 - smoothstep(0.18, 0.72, distance(vUv, vec2(0.5)));
    gl_FragColor = vec4(uColor, uHover * vignette * 0.52);
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

    state.layer ??= material.createMaterialLayer({
      key: `${ctx.key}.hover-overlay`,
      mode: "overlay",
      program: {
        fragmentShader,
        uniforms: {
          uColor: params.color ?? [0.49, 0.83, 0.98],
          uHover: 0,
        },
      },
    });
    state.layer.setUniforms({
      uColor: params.color ?? [0.49, 0.83, 0.98],
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
