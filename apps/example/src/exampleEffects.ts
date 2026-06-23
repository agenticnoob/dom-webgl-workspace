import { defineWebGLEffect } from "@project/dom-webgl-runtime";

type SurfaceFillParams = {
  kind: "example.surfaceFill";
  color?: string;
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

export const exampleSurfaceFillEffect = defineWebGLEffect<SurfaceFillParams, { drawn: boolean }>({
  kind: "example.surfaceFill",
  source: "snapshot/element",
  setup(ctx, params) {
    const state = { drawn: false };
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

    const scale = clampNumber(params.scale, 1, 1.6, 1.08);
    const opacity = clampNumber(params.opacity, 0.1, 1, 0.84);
    const pulse = 0.5 + Math.sin(ctx.time / 520) * 0.5;
    const nextScale = 1 + (scale - 1) * pulse;

    ctx.target?.setVisible(true);
    ctx.target?.setScale(nextScale, nextScale, 1);
    ctx.target?.setOpacity(opacity);
    ctx.source.surface?.setVisible?.(true);
    ctx.source.surface?.setOpacity?.(opacity);
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

function drawSurface(
  ctx: Parameters<typeof exampleSurfaceFillEffect.update>[0],
  params: SurfaceFillParams,
  state: { drawn: boolean },
): void {
  if (ctx.source.kind !== "snapshot/element") {
    return;
  }

  const opacity = clampNumber(params.opacity, 0, 1, 0.76);
  if (!state.drawn) {
    const color = params.color ?? "#f6c453";
    ctx.source.surface?.draw(({ context, width, height }) => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = color;
      context.fillRect(0, 0, width, height);
    });
    state.drawn = true;
  }

  ctx.source.surface?.setVisible?.(true);
  ctx.source.surface?.setOpacity?.(opacity);
  ctx.target?.setVisible(true);
  ctx.target?.setOpacity(opacity);
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
