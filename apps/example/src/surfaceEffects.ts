import {
  defineWebGLEffect,
  type WebGLEffectUpdateContext,
} from "@project/dom-webgl-runtime";

import { clampNumber } from "./effectMath";
import {
  createSurfaceGhostCursorState,
  updateSurfaceGhostCursorState,
  type SurfaceGhostCursorState,
} from "./ghostCursorState";
import {
  drawCoverImage,
  drawGhostCursorSurface,
  drawPulseSurface,
  drawWavesSurface,
} from "./surfaceEffectRenderers";
import {
  createSurfaceVideoBackgroundState,
  disposeSurfaceVideo,
  prepareSurfaceVideo,
  type SurfaceVideoBackgroundState,
} from "./surfaceVideo";
import {
  readTargetLocalPointer,
  type TargetLocalPointer,
} from "./surfacePointer";

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

type SurfaceVideoBackgroundParams = {
  kind: "example.surfaceVideoBackground";
  videoSrc?: string;
  opacity?: number;
};

type SurfaceGhostCursorParams = {
  kind: "example.surfaceGhostCursor";
  trailLength?: number;
  color?: string;
  opacity?: number;
};

type SurfaceWavesParams = {
  kind: "example.surfaceWaves";
  lineColor?: string;
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

export const exampleSurfaceVideoBackgroundEffect = defineWebGLEffect<
  SurfaceVideoBackgroundParams,
  SurfaceVideoBackgroundState
>({
  kind: "example.surfaceVideoBackground",
  source: "snapshot/element",
  setup(ctx, params) {
    const state = createSurfaceVideoBackgroundState();
    drawVideoBackgroundSurface(ctx, params, state);
    return state;
  },
  update(ctx, state, params) {
    drawVideoBackgroundSurface(ctx, params, state);
  },
  dispose(_ctx, state) {
    disposeSurfaceVideo(state);
  },
});

export const exampleSurfaceGhostCursorEffect = defineWebGLEffect<
  SurfaceGhostCursorParams,
  SurfaceGhostCursorState
>({
  kind: "example.surfaceGhostCursor",
  source: "snapshot/element",
  setup(ctx) {
    return createSurfaceGhostCursorState(ctx);
  },
  update(ctx, state, params) {
    if (ctx.source.kind !== "snapshot/element") {
      return;
    }

    const pointer = readLocalPointer(ctx);
    updateSurfaceGhostCursorState(state, pointer);
    ctx.target?.setVisible(true);
    ctx.source.surface?.draw(({ context, width, height }) => {
      drawGhostCursorSurface(context, width, height, {
        color: params.color ?? "#b497cf",
        opacity: clampNumber(params.opacity, 0.1, 1, 0.9),
        pointerActive: pointer.active,
        pointerIntensity: state.intensity,
        pointerX: state.pointerX,
        pointerY: state.pointerY,
        time: ctx.time,
        trailLength: clampNumber(params.trailLength, 6, 64, 32),
      });
    });
    ctx.source.surface?.setVisible?.(true);
    ctx.source.surface?.setOpacity?.(1);
  },
});

export const exampleSurfaceWavesEffect = defineWebGLEffect<SurfaceWavesParams>({
  kind: "example.surfaceWaves",
  source: "snapshot/element",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "snapshot/element") {
      return;
    }

    const pointer = readLocalPointer(ctx);
    ctx.target?.setVisible(true);
    ctx.source.surface?.draw(({ context, width, height }) => {
      drawWavesSurface(context, width, height, {
        lineColor: params.lineColor ?? "#172124",
        opacity: clampNumber(params.opacity, 0.1, 1, 0.82),
        pointerActive: pointer.active,
        pointerX: pointer.x,
        pointerY: pointer.y,
        time: ctx.time,
      });
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
  ctx: WebGLEffectUpdateContext,
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
  ctx: WebGLEffectUpdateContext,
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

function drawVideoBackgroundSurface(
  ctx: WebGLEffectUpdateContext,
  params: SurfaceVideoBackgroundParams,
  state: SurfaceVideoBackgroundState,
): void {
  if (ctx.source.kind !== "snapshot/element") {
    return;
  }

  const videoSrc = params.videoSrc ?? "/example/bg.mp4";
  prepareSurfaceVideo(ctx, state, videoSrc);
  const opacity = clampNumber(params.opacity, 0, 1, 0.84);

  ctx.source.surface?.draw(({ context, width, height }) => {
    context.clearRect(0, 0, width, height);
    drawCoverImage(context, state.video, width, height);
  });
  ctx.source.surface?.setVisible?.(true);
  ctx.source.surface?.setOpacity?.(opacity);
  ctx.target?.setVisible(true);
}

function readLocalPointer(ctx: WebGLEffectUpdateContext): TargetLocalPointer {
  return readTargetLocalPointer({
    layout: ctx.layout,
    pointer: ctx.pointer,
  });
}
