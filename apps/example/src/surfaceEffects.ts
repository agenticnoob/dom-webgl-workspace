import { defineWebGLEffect } from "@project/dom-webgl-runtime";

import { clampNumber } from "./effectMath";

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

type SurfaceFillState = {
  drawn: boolean;
  image: HTMLImageElement | undefined;
  imageSrc: string | undefined;
};

export const exampleSurfaceFillEffect = defineWebGLEffect<
  SurfaceFillParams,
  SurfaceFillState
>({
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
