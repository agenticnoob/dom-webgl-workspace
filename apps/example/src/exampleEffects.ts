import { defineWebGLEffect } from "@project/dom-webgl-runtime";

type SurfaceFillParams = {
  kind: "example.surfaceFill";
  imageSrc?: string;
  opacity?: number;
};

type SurfacePulseParams = {
  kind: "example.surfacePulse";
  scale?: number;
  opacity?: number;
};

type TextWaveParams = {
  kind: "example.textWave";
  amplitude?: number;
};

type TextRevealParams = {
  kind: "example.textReveal";
  color?: string;
};

type ImagePanParams = {
  kind: "example.imagePan";
  distance?: number;
};

type ImageZoomParams = {
  kind: "example.imageZoom";
  maxScale?: number;
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

type ModelSpinParams = {
  kind: "example.modelSpin";
  speed?: number;
};

type ModelFloatParams = {
  kind: "example.modelFloat";
  amplitude?: number;
};

type SurfaceFillState = {
  drawn: boolean;
  image: HTMLImageElement | undefined;
  imageSrc: string | undefined;
};

export const exampleSurfaceFillEffect = defineWebGLEffect<SurfaceFillParams, SurfaceFillState>({
  kind: "example.surfaceFill",
  source: "snapshot/element",
  setup(ctx, params) {
    const state = createSurfaceFillState();
    drawSurface(ctx, params, state);
    return state;
  },
  update(ctx, state, params) {
    drawSurface(ctx, params, state);
  },
});

export const exampleSurfacePulseEffect = defineWebGLEffect<SurfacePulseParams>({
  kind: "example.surfacePulse",
  source: "snapshot/element",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "snapshot/element") {
      return;
    }

    const expansion = clampNumber(params.scale, 1, 1.6, 1.08) - 1;
    const opacity = clampNumber(params.opacity, 0.1, 1, 1);
    const pulse = 0.5 + Math.sin(ctx.time / 360) * 0.5;

    ctx.target?.setVisible(true);
    ctx.source.surface?.draw(({ context, width, height }) => {
      drawPulseSurface(context, width, height, pulse, opacity, expansion);
    });
    ctx.source.surface?.setVisible?.(true);
    ctx.source.surface?.setOpacity?.(1);
  },
});

export const exampleTextWaveEffect = defineWebGLEffect<TextWaveParams>({
  kind: "example.textWave",
  source: "snapshot/text",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "snapshot/text") {
      return;
    }

    const amplitude = clampNumber(params.amplitude, 0, 24, 6);
    const phase = ctx.time / 450;
    ctx.source.textLayer?.setGlyphs((glyphs) =>
      glyphs.map((glyph) => ({
        index: glyph.index,
        char: glyph.char,
        y: glyph.y + Math.sin(phase + glyph.index * 0.42) * amplitude,
        color: "#1d2a2e",
      })),
    );
  },
});

export const exampleTextRevealEffect = defineWebGLEffect<TextRevealParams>({
  kind: "example.textReveal",
  source: "snapshot/text",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "snapshot/text") {
      return;
    }

    const progress = clampNumber(ctx.scrollProgress, 0, 1, 0);
    const color = params.color ?? "#f6c453";

    ctx.source.textLayer?.setGlyphs((glyphs) => {
      const visibleCount = Math.ceil(glyphs.length * progress);

      return glyphs.map((glyph) => ({
        index: glyph.index,
        char: glyph.char,
        opacity: glyph.index < visibleCount ? 1 : 0.18,
        scaleX: glyph.index < visibleCount ? 1 : 0.82,
        scaleY: glyph.index < visibleCount ? 1 : 0.82,
        color,
      }));
    });
  },
});

export const exampleImagePanEffect = defineWebGLEffect<ImagePanParams>({
  kind: "example.imagePan",
  source: "image",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "image") {
      return;
    }

    const distance = clampNumber(params.distance, 0, 0.5, 0.16);
    ctx.source.image?.setTextureTransform({
      repeatX: 1.12,
      repeatY: 1.12,
      offsetX: distance * ctx.scrollProgress,
      offsetY: 0,
    });
  },
});

export const exampleImageZoomEffect = defineWebGLEffect<ImageZoomParams>({
  kind: "example.imageZoom",
  source: "image",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "image") {
      return;
    }

    const maxScale = clampNumber(params.maxScale, 1, 2.4, 1.42);
    const phase = 0.5 + Math.sin(ctx.time / 800) * 0.5;
    const scale = 1 + (maxScale - 1) * phase;

    ctx.target?.setVisible(true);
    ctx.target?.setScale(scale, scale, 1);
  },
});

export const exampleVideoPlaybackEffect = defineWebGLEffect<
  VideoPlaybackParams,
  VideoPlaybackState
>({
  kind: "example.videoPlayback",
  source: "video",
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
  source: "video",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "video") {
      return;
    }

    const distance = clampNumber(params.distance, 0, 0.32, 0.12);
    const phase = 0.5 + Math.sin(ctx.time / 900) * 0.5;

    ctx.source.video?.setTextureTransform({
      repeatX: 1.08,
      repeatY: 1.08,
      offsetX: distance * phase,
      offsetY: distance * (1 - phase) * 0.5,
    });
  },
});

export const exampleModelSpinEffect = defineWebGLEffect<ModelSpinParams>({
  kind: "example.modelSpin",
  source: "model/glb",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "model/glb") {
      return;
    }

    const speed = clampNumber(params.speed, 0, 2, 0.18);
    ctx.target?.setVisible(true);
    ctx.target?.setRotation(0, (ctx.time / 1000) * speed, 0);
  },
});

export const exampleModelFloatEffect = defineWebGLEffect<ModelFloatParams>({
  kind: "example.modelFloat",
  source: "model/glb",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "model/glb") {
      return;
    }

    const amplitude = clampNumber(params.amplitude, 0, 80, 28);
    const y = ctx.layout.top + ctx.layout.height / 2 + Math.sin(ctx.time / 700) * amplitude;

    ctx.target?.setVisible(true);
    ctx.target?.setPosition(ctx.layout.left + ctx.layout.width / 2, y, 0);
    ctx.target?.setRotation(Math.sin(ctx.time / 1000) * 0.18, ctx.time / 1800, 0);
  },
});

export const exampleEffects = [
  exampleSurfaceFillEffect,
  exampleSurfacePulseEffect,
  exampleTextWaveEffect,
  exampleTextRevealEffect,
  exampleImagePanEffect,
  exampleImageZoomEffect,
  exampleVideoPlaybackEffect,
  exampleVideoDriftEffect,
  exampleModelSpinEffect,
  exampleModelFloatEffect,
] as const;

function createSurfaceFillState(): SurfaceFillState {
  return {
    drawn: false,
    image: undefined,
    imageSrc: undefined,
  };
}

function drawSurface(
  ctx: Parameters<typeof exampleSurfaceFillEffect.update>[0],
  params: SurfaceFillParams,
  state: SurfaceFillState,
): void {
  if (ctx.source.kind !== "snapshot/element") {
    return;
  }

  const opacity = clampNumber(params.opacity, 0, 1, 0.76);
  const imageSrc = params.imageSrc ?? "/example/bg.png";
  prepareSurfaceImage(ctx, state, imageSrc);

  if (!state.drawn) {
    ctx.source.surface?.draw(({ context, width, height }) => {
      context.clearRect(0, 0, width, height);
      drawCoverImage(context, state.image, width, height);
    });
    state.drawn = true;
  }

  ctx.source.surface?.setVisible?.(true);
  ctx.source.surface?.setOpacity?.(opacity);
  ctx.target?.setVisible(true);
}

function prepareSurfaceImage(
  ctx: Parameters<typeof exampleSurfaceFillEffect.update>[0],
  state: SurfaceFillState,
  imageSrc: string,
): void {
  if (ctx.source.kind !== "snapshot/element") {
    return;
  }

  const surface = ctx.source.surface;
  if (state.image && state.imageSrc === imageSrc) {
    return;
  }

  const image = new Image();
  state.image = image;
  state.imageSrc = imageSrc;
  state.drawn = false;

  image.onload = () => {
    state.drawn = false;
    surface?.invalidate();
  };
  image.src = imageSrc;
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  width: number,
  height: number,
): void {
  if (!image || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    return;
  }

  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;

  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
}

function drawPulseSurface(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  pulse: number,
  opacity: number,
  expansion: number,
): void {
  context.clearRect(0, 0, width, height);
  const inset = Math.max(
    8,
    Math.min(width, height) * (0.035 + pulse * (0.04 + expansion * 0.12)),
  );
  const lineWidth = Math.max(3, Math.min(width, height) * 0.018);

  context.save();
  context.globalAlpha = (0.58 + pulse * 0.28) * opacity;
  context.fillStyle = "#d95f42";
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 1;
  context.strokeStyle = "#fff1b8";
  context.lineWidth = lineWidth;
  context.strokeRect(
    inset,
    inset,
    Math.max(1, width - inset * 2),
    Math.max(1, height - inset * 2),
  );
  context.globalAlpha = (0.64 + pulse * 0.36) * opacity;
  context.fillStyle = "#ffffff";
  context.fillRect(0, height * (0.18 + pulse * 0.5), width, lineWidth * 1.8);
  context.restore();
}

function configureVideo(
  ctx: Parameters<typeof exampleVideoPlaybackEffect.update>[0],
  params: VideoPlaybackParams,
  state: VideoPlaybackState,
): void {
  if (ctx.source.kind !== "video" || state.configured) {
    return;
  }

  ctx.source.video?.setMuted(true);
  ctx.source.video?.setPlaybackRate(clampNumber(params.playbackRate, 0.25, 2, 1));
  void ctx.source.video?.play();
  state.configured = true;
}

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

// ── Type-safe effect declarations demo ──────────────────────────────────────
// See docs/agent/package-usage.md#type-safe-effect-declarations for details.

import { createEffectDeclarations } from "@project/dom-webgl-runtime";

/**
 * Type map: maps every effect kind to its expected params shape.
 * Keep this in a shared module so definitions and declarations share the contract.
 */
export interface ExampleEffectParams {
  "example.surfaceFill": { imageSrc?: string; opacity?: number };
  "example.surfacePulse": { scale?: number; opacity?: number };
  "example.textWave": { amplitude?: number };
  "example.textReveal": { color?: string };
  "example.imagePan": { distance?: number };
  "example.imageZoom": { maxScale?: number };
  "example.videoPlayback": { playbackRate?: number };
  "example.videoDrift": { distance?: number };
  "example.modelSpin": { speed?: number };
  "example.modelFloat": { amplitude?: number };
}

/**
 * Type-safe declarations array.
 * Uncomment the `opcity` line below to see the compile-time error.
 */
export const typeSafeDeclarations = createEffectDeclarations<ExampleEffectParams>()([
  { kind: "example.surfaceFill", imageSrc: "/example/bg.png", opacity: 0.72 },
  { kind: "example.surfacePulse", scale: 1.36, opacity: 0.92 },
  { kind: "example.textWave", amplitude: 7 },
  { kind: "example.textReveal", color: "#d95f42" },
  { kind: "example.imagePan", distance: 0.2 },
  { kind: "example.imageZoom", maxScale: 1.36 },
  { kind: "example.videoPlayback", playbackRate: 0.8 },
  { kind: "example.videoDrift", distance: 0.12 },
  { kind: "example.modelSpin", speed: 0.25 },
  { kind: "example.modelFloat", amplitude: 24 },
  // ❌ Would TS-error:
  // { kind: "example.surfaceFill", opcity: 0.72 },
]);
