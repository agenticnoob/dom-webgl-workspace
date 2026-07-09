import {
  defineWebGLEffect,
  type WebGLEffectMaterialLayerHandle,
} from "@project/dom-webgl-runtime";

import { clampNumber, readTargetViewportProgress } from "./effectMath";
import { readTargetLocalPointer } from "./surfacePointer";

type ImagePanParams = {
  kind: "example.imagePan";
  distance?: number;
};

type ImageZoomParams = {
  kind: "example.imageZoom";
  maxScale?: number;
};

type ImageKenBurnsParams = {
  kind: "example.imageKenBurns";
  distance?: number;
  maxScale?: number;
};

type MediaPointerParallaxParams = {
  kind: "example.mediaPointerParallax";
  bleed?: number;
  strength?: number;
};

type ImageHoverRevealParams = {
  kind: "example.imageHoverReveal";
  revealSrc?: string;
  radius?: number;
  feather?: number;
  restoreMs?: number;
  roughness?: number;
};

type VideoPlaybackParams = {
  kind: "example.videoPlayback";
  playbackRate?: number;
};

type VideoDriftParams = {
  kind: "example.videoDrift";
  distance?: number;
};

type VideoPlaybackState = {
  configured: boolean;
};

type ImageHoverRevealState = {
  layer: WebGLEffectMaterialLayerHandle | undefined;
  revealPlaceholder: HTMLCanvasElement | undefined;
  revealImage: HTMLImageElement | undefined;
  revealReady: boolean;
  revealSrc: string | undefined;
  maskCanvas: HTMLCanvasElement | undefined;
  maskSize: { width: number; height: number } | undefined;
  previousPoint: ImageHoverRevealPoint | undefined;
  lastInteractionTime: number | undefined;
};

type ImageHoverRevealPoint = {
  x: number;
  y: number;
};

export const exampleImagePanEffect = defineWebGLEffect<ImagePanParams>({
  kind: "example.imagePan",
  source: "media/image",
  update(ctx, _state, params) {
    if (!ctx.object.texture) {
      return;
    }

    const distance = clampNumber(params.distance, 0, 0.5, 0.16);
    const progress = Math.max(
      clampNumber(ctx.scrollProgress, 0, 1, 0),
      readTargetViewportProgress(ctx.layout),
    );
    ctx.object.texture.setTransform({
      repeatX: 1.12,
      repeatY: 1.12,
      offsetX: distance * progress,
      offsetY: 0,
    });
  },
});

export const exampleImageZoomEffect = defineWebGLEffect<ImageZoomParams>({
  kind: "example.imageZoom",
  source: "media/image",
  update(ctx, _state, params) {
    if (!ctx.object.texture) {
      return;
    }

    const maxScale = clampNumber(params.maxScale, 1, 2.4, 1.42);
    const phase = 0.5 + Math.sin(ctx.time / 800) * 0.5;
    const scale = 1 + (maxScale - 1) * phase;

    ctx.object.visible = true;
    ctx.object.scale.set(scale, scale, 1);
  },
});

export const exampleImageKenBurnsEffect = defineWebGLEffect<ImageKenBurnsParams>({
  kind: "example.imageKenBurns",
  source: "media/image",
  update(ctx, _state, params) {
    if (!ctx.object.texture) {
      return;
    }

    const distance = clampNumber(params.distance, 0, 0.36, 0.14);
    const maxScale = clampNumber(params.maxScale, 1, 1.8, 1.18);
    const phase = 0.5 + Math.sin(ctx.time / 1200) * 0.5;
    const scale = 1 + (maxScale - 1) * (0.35 + phase * 0.65);

    ctx.object.texture.setTransform({
      repeatX: scale,
      repeatY: scale,
      offsetX: distance * phase,
      offsetY: distance * (1 - phase),
    });
    ctx.object.visible = true;
    ctx.object.scale.set(1 + phase * 0.04, 1 + phase * 0.04, 1);
  },
});

export const exampleImageHoverRevealEffect = defineWebGLEffect<
  ImageHoverRevealParams,
  ImageHoverRevealState
>({
  kind: "example.imageHoverReveal",
  source: "media/image",
  setup(ctx, params) {
    const state = createImageHoverRevealState();
    prepareImageHoverReveal(ctx, state, params);
    return state;
  },
  update(ctx, state, params) {
    prepareImageHoverReveal(ctx, state, params);
    updateImageHoverReveal(ctx, state, params);
  },
  dispose(_ctx, state) {
    disposeImageHoverReveal(state);
  },
});

export const exampleMediaPointerParallaxEffect =
  defineWebGLEffect<MediaPointerParallaxParams>({
    kind: "example.mediaPointerParallax",
    source: ["media/image", "media/video", "media/image-sequence"],
    update(ctx, _state, params) {
      if (!ctx.object.texture) {
        return;
      }

      const bleed = clampNumber(params.bleed, 0, 0.24, 0.08);
      const strength = clampNumber(params.strength, 0, 1, 0.72);
      const repeat = 1 - bleed;
      const centerOffset = bleed * 0.5;
      const maxOffset = centerOffset * strength;
      const pointer = readTargetLocalPointer({
        layout: ctx.layout,
        pointer: ctx.targetPointer,
      });
      const normalizedX = readNormalizedPointerAxis(pointer.x, ctx.layout.width);
      const normalizedY = readNormalizedPointerAxis(pointer.y, ctx.layout.height);

      ctx.object.texture.setTransform({
        repeatX: repeat,
        repeatY: repeat,
        offsetX: clampNumber(
          centerOffset + normalizedX * maxOffset,
          0,
          bleed,
          centerOffset,
        ),
        offsetY: clampNumber(
          centerOffset + normalizedY * maxOffset,
          0,
          bleed,
          centerOffset,
        ),
      });
      ctx.object.visible = true;
      ctx.object.opacity = 1;
    },
  });

export const exampleVideoPlaybackEffect = defineWebGLEffect<
  VideoPlaybackParams,
  VideoPlaybackState
>({
  kind: "example.videoPlayback",
  source: "media/video",
  setup(ctx, params) {
    const state = { configured: false };
    configureVideo(ctx, params, state);
    return state;
  },
  update(ctx, state, params) {
    configureVideo(ctx, params, state);
  },
});

export const exampleVideoDriftEffect = defineWebGLEffect<VideoDriftParams>({
  kind: "example.videoDrift",
  source: "media/video",
  update(ctx, _state, params) {
    if (!ctx.object.texture) {
      return;
    }

    const distance = clampNumber(params.distance, 0, 0.32, 0.12);
    const phase = 0.5 + Math.sin(ctx.time / 900) * 0.5;

    ctx.object.texture.setTransform({
      repeatX: 1.08,
      repeatY: 1.08,
      offsetX: distance * phase,
      offsetY: distance * (1 - phase) * 0.5,
    });
  },
});

function configureVideo(
  ctx: Parameters<typeof exampleVideoPlaybackEffect.update>[0],
  params: VideoPlaybackParams,
  state: VideoPlaybackState,
): void {
  if (!ctx.object.video || state.configured) {
    return;
  }

  ctx.object.video.setMuted(true);
  ctx.object.video.setPlaybackRate(clampNumber(params.playbackRate, 0.25, 2, 1));
  void ctx.object.video.play();
  state.configured = true;
}

function readNormalizedPointerAxis(value: number, size: number): number {
  if (size <= 0) {
    return 0;
  }

  return clampNumber((value / size - 0.5) * 2, -1, 1, 0);
}

function createImageHoverRevealState(): ImageHoverRevealState {
  return {
    layer: undefined,
    revealPlaceholder: undefined,
    revealImage: undefined,
    revealReady: false,
    revealSrc: undefined,
    maskCanvas: undefined,
    maskSize: undefined,
    previousPoint: undefined,
    lastInteractionTime: undefined,
  };
}

function prepareImageHoverReveal(
  ctx: Parameters<typeof exampleImageHoverRevealEffect.update>[0],
  state: ImageHoverRevealState,
  params: ImageHoverRevealParams,
): void {
  const texture = ctx.object.texture;
  if (!texture) {
    return;
  }

  const revealSrc = params.revealSrc ?? "/example/mask.png";
  if (!state.revealImage || state.revealSrc !== revealSrc) {
    const image = new Image();
    const placeholder = readImageHoverRevealPlaceholder(state);
    state.revealImage = image;
    state.revealReady = false;
    state.revealSrc = revealSrc;
    state.layer?.setUniforms({
      uRevealReady: false,
      uRevealTexture: { kind: "canvas-texture", source: placeholder },
    });
    image.onload = () => {
      state.revealReady = true;
      state.layer?.setUniforms({
        uRevealReady: true,
        uRevealTexture: { kind: "image-texture", source: image },
      });
      texture.invalidate();
    };
    image.src = revealSrc;
  }

  if (state.layer || !state.revealImage) {
    return;
  }

  const uvTransform = texture.shaderInputs.uvTransform;
  const maskCanvas = readImageHoverRevealMaskCanvas(state, ctx.layout);
  state.layer = texture.material.createMaterialLayer({
    key: "example.imageHoverReveal",
    mode: "replace-source",
    sourceTextureUniform: "uBaseTexture",
    program: {
      fragmentShader: imageHoverRevealFragmentShader,
      uniforms: {
        uRevealTexture: {
          kind: "canvas-texture",
          source: readImageHoverRevealPlaceholder(state),
        },
        uMaskTexture: {
          kind: "canvas-texture",
          source: maskCanvas,
        },
        uPointer: [ctx.layout.width * 0.5, ctx.layout.height * 0.5],
        uPointerActive: false,
        uRevealReady: false,
        uRadius: clampNumber(params.radius, 8, 360, 120),
        uFeather: clampNumber(params.feather, 1, 160, 36),
        uRoughness: readImageHoverRevealRoughness(params),
        uTargetSize: [ctx.layout.width, ctx.layout.height],
        uTrailOpacity: readImageHoverRevealTrailOpacity(ctx.time, state, params),
        uUvRepeat: [uvTransform.repeatX, uvTransform.repeatY],
        uUvOffset: [uvTransform.offsetX, uvTransform.offsetY],
      },
    },
  });
}

function updateImageHoverReveal(
  ctx: Parameters<typeof exampleImageHoverRevealEffect.update>[0],
  state: ImageHoverRevealState,
  params: ImageHoverRevealParams,
): void {
  const texture = ctx.object.texture;
  if (!texture || !state.layer) {
    return;
  }

  const pointer = readTargetLocalPointer({
    layout: ctx.layout,
    pointer: ctx.targetPointer,
  });
  const maskCanvas = updateImageHoverRevealMask(ctx.time, state, params, pointer, ctx.layout);
  const uvTransform = texture.shaderInputs.uvTransform;

  state.layer.setUniforms({
    uPointer: [pointer.x, pointer.y],
    uPointerActive: pointer.active,
    uRevealReady: state.revealReady,
    uRadius: clampNumber(params.radius, 8, 360, 120),
    uFeather: clampNumber(params.feather, 1, 160, 36),
    uRoughness: readImageHoverRevealRoughness(params),
    uTargetSize: [ctx.layout.width, ctx.layout.height],
    uMaskTexture: {
      kind: "canvas-texture",
      source: maskCanvas,
    },
    uTrailOpacity: readImageHoverRevealTrailOpacity(ctx.time, state, params),
    uUvRepeat: [uvTransform.repeatX, uvTransform.repeatY],
    uUvOffset: [uvTransform.offsetX, uvTransform.offsetY],
  });
  texture.invalidate();
  ctx.object.visible = true;
  ctx.object.opacity = 1;
}

function disposeImageHoverReveal(state: ImageHoverRevealState): void {
  state.layer?.dispose();
  state.layer = undefined;
  if (state.revealImage) {
    state.revealImage.onload = null;
  }
  state.revealImage = undefined;
  state.revealPlaceholder = undefined;
  state.revealReady = false;
  state.revealSrc = undefined;
  state.maskCanvas = undefined;
  state.maskSize = undefined;
  state.previousPoint = undefined;
  state.lastInteractionTime = undefined;
}

function updateImageHoverRevealMask(
  time: number,
  state: ImageHoverRevealState,
  params: ImageHoverRevealParams,
  pointer: ReturnType<typeof readTargetLocalPointer>,
  layout: { width: number; height: number },
): HTMLCanvasElement {
  const maskCanvas = readImageHoverRevealMaskCanvas(state, layout);
  if (!pointer.active) {
    state.previousPoint = undefined;
    if (readImageHoverRevealTrailOpacity(time, state, params) <= 0) {
      clearImageHoverRevealMask(state);
      state.lastInteractionTime = undefined;
    }
    return maskCanvas;
  }

  const currentPoint = { x: pointer.x, y: pointer.y };
  if (
    state.previousPoint &&
    Math.hypot(
      currentPoint.x - state.previousPoint.x,
      currentPoint.y - state.previousPoint.y,
    ) < imageHoverRevealMovementThreshold
  ) {
    return maskCanvas;
  }

  const context = readImageHoverRevealMaskContext(maskCanvas);
  const currentOpacity = readImageHoverRevealTrailOpacity(time, state, params);
  if (context && currentOpacity > 0 && currentOpacity < 1) {
    bakeImageHoverRevealMaskOpacity(context, maskCanvas, currentOpacity);
  } else if (state.lastInteractionTime !== undefined && currentOpacity <= 0) {
    clearImageHoverRevealMask(state);
  }

  state.lastInteractionTime = time;
  if (!context) {
    state.previousPoint = currentPoint;
    return maskCanvas;
  }

  drawImageHoverRevealStroke(
    context,
    state.previousPoint ?? currentPoint,
    currentPoint,
    params,
  );
  state.previousPoint = currentPoint;
  return maskCanvas;
}

function drawImageHoverRevealStroke(
  context: CanvasRenderingContext2D,
  from: ImageHoverRevealPoint,
  to: ImageHoverRevealPoint,
  params: ImageHoverRevealParams,
): void {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (distance === 0) {
    drawImageHoverRevealStamp(context, to.x, to.y, params);
    return;
  }

  const step = Math.max(6, readImageHoverRevealRadius(params) * 0.18);
  const count = Math.max(1, Math.ceil(distance / step));
  for (let index = 0; index <= count; index++) {
    const progress = index / count;
    drawImageHoverRevealStamp(
      context,
      from.x + (to.x - from.x) * progress,
      from.y + (to.y - from.y) * progress,
      params,
    );
  }
}

function drawImageHoverRevealStamp(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  params: ImageHoverRevealParams,
): void {
  const radius = readImageHoverRevealRadius(params);
  const feather = clampNumber(params.feather, 1, 160, 36);
  const roughness = readImageHoverRevealRoughness(params);
  const innerRadius = Math.max(1, radius - feather);

  context.save();
  context.globalCompositeOperation = "source-over";
  for (let ring = imageHoverRevealBrushRings; ring >= 1; ring--) {
    const progress = ring / imageHoverRevealBrushRings;
    const ringRadius = innerRadius + (radius - innerRadius) * progress;
    const alpha = ring === 1 ? 1 : Math.max(0.08, 1 - progress * 0.86);
    context.fillStyle = `rgba(255,255,255,${alpha})`;
    context.beginPath();
    for (let index = 0; index < imageHoverRevealBrushSegments; index++) {
      const angle = (Math.PI * 2 * index) / imageHoverRevealBrushSegments;
      const noisyRadius =
        ringRadius *
        (1 +
          Math.sin(x * 0.017 + y * 0.023 + index * 2.173 + ring * 0.911) *
            roughness *
            0.72);
      const pointX = x + Math.cos(angle) * noisyRadius;
      const pointY = y + Math.sin(angle) * noisyRadius;
      if (index === 0) {
        context.moveTo(pointX, pointY);
      } else {
        context.lineTo(pointX, pointY);
      }
    }
    context.closePath();
    context.fill();
  }
  context.restore();
}

function bakeImageHoverRevealMaskOpacity(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  opacity: number,
): void {
  context.save();
  context.globalCompositeOperation = "destination-in";
  context.globalAlpha = opacity;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();
}

function clearImageHoverRevealMask(state: ImageHoverRevealState): void {
  if (!state.maskCanvas) {
    return;
  }

  const context = readImageHoverRevealMaskContext(state.maskCanvas);
  if (context) {
    context.clearRect(0, 0, state.maskCanvas.width, state.maskCanvas.height);
    return;
  }

  state.maskCanvas.width = state.maskCanvas.width;
}

function readImageHoverRevealRestoreMs(
  params: ImageHoverRevealParams,
): number {
  return clampNumber(params.restoreMs, 250, 6000, 1800);
}

function readImageHoverRevealRadius(params: ImageHoverRevealParams): number {
  return clampNumber(params.radius, 8, 360, 120);
}

function readImageHoverRevealRoughness(
  params: ImageHoverRevealParams,
): number {
  return clampNumber(params.roughness, 0, 0.55, 0.24);
}

function readImageHoverRevealTrailOpacity(
  time: number,
  state: ImageHoverRevealState,
  params: ImageHoverRevealParams,
): number {
  if (!state.maskCanvas || state.lastInteractionTime === undefined) {
    return 0;
  }

  const restoreMs = readImageHoverRevealRestoreMs(params);
  const age = Math.max(0, time - state.lastInteractionTime);
  return clampNumber(1 - age / restoreMs, 0, 1, 0);
}

function readImageHoverRevealMaskCanvas(
  state: ImageHoverRevealState,
  layout: { width: number; height: number },
): HTMLCanvasElement {
  const width = Math.max(1, Math.round(layout.width));
  const height = Math.max(1, Math.round(layout.height));
  if (
    state.maskCanvas &&
    state.maskSize?.width === width &&
    state.maskSize.height === height
  ) {
    return state.maskCanvas;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  state.maskCanvas = canvas;
  state.maskSize = { width, height };
  state.previousPoint = undefined;
  state.lastInteractionTime = undefined;
  return canvas;
}

function readImageHoverRevealMaskContext(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D | null {
  if (typeof CanvasRenderingContext2D === "undefined") {
    return null;
  }

  try {
    return canvas.getContext("2d");
  } catch (_error: unknown) {
    return null;
  }
}

function readImageHoverRevealPlaceholder(
  state: ImageHoverRevealState,
): HTMLCanvasElement {
  if (state.revealPlaceholder) {
    return state.revealPlaceholder;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  state.revealPlaceholder = canvas;
  return canvas;
}

const imageHoverRevealFragmentShader = `
  uniform sampler2D uBaseTexture;
  uniform sampler2D uRevealTexture;
  uniform sampler2D uMaskTexture;
  uniform vec2 uPointer;
  uniform bool uPointerActive;
  uniform bool uRevealReady;
  uniform float uRadius;
  uniform float uFeather;
  uniform float uRoughness;
  uniform float uTrailOpacity;
  uniform vec2 uTargetSize;
  uniform vec2 uUvRepeat;
  uniform vec2 uUvOffset;
  varying vec2 vUv;

  void main() {
    vec2 sampledUv = vUv * uUvRepeat + uUvOffset;
    vec4 baseColor = texture2D(uBaseTexture, sampledUv);
    vec4 revealColor = texture2D(uRevealTexture, sampledUv);
    float mask = texture2D(uMaskTexture, vUv).a;
    mask *= (uRevealReady ? 1.0 : 0.0) * uTrailOpacity;
    gl_FragColor = mix(baseColor, revealColor, mask);
  }
`;

const imageHoverRevealBrushSegments = 18;
const imageHoverRevealBrushRings = 5;
const imageHoverRevealMovementThreshold = 2;
