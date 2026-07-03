import {
  defineWebGLEffect,
  type WebGLEffectMaterialLayerHandle,
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
  drawPulseSurface,
} from "./surfaceEffectRenderers";
import {
  createGhostCursorMaterialProgram,
  createGhostCursorUniforms,
} from "./ghostCursorSurface";
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
import {
  createSurfaceWavesMaterialProgram,
  createSurfaceWavesUniforms,
} from "./wavesMaterial";

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

type ModelDarkSceneParams = {
  kind: "example.modelDarkScene";
};

type SurfaceFillState = {
  drawn: boolean;
  image: HTMLImageElement | undefined;
  imageSrc: string | undefined;
};

type SurfaceWavesState = {
  layer: WebGLEffectMaterialLayerHandle | undefined;
};

export const exampleSurfaceFillEffect = defineWebGLEffect<
  SurfaceFillParams,
  SurfaceFillState
>({
  kind: "example.surfaceFill",
  source: "dom/element",
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
  source: "dom/element",
  update(ctx, _state, params) {
    const surface = ctx.object.surface;
    if (!surface) {
      return;
    }

    const expansion = clampNumber(params.scale, 1, 1.6, 1.08) - 1;
    const opacity = clampNumber(params.opacity, 0.1, 1, 1);
    const pulse = 0.5 + Math.sin(ctx.time / 360) * 0.5;

    ctx.object.visible = true;
    surface.draw(({ context, width, height }) => {
      drawPulseSurface(context, width, height, pulse, opacity, expansion);
    });
    surface.setVisible?.(true);
    surface.setOpacity?.(1);
  },
});

export const exampleSurfaceVideoBackgroundEffect = defineWebGLEffect<
  SurfaceVideoBackgroundParams,
  SurfaceVideoBackgroundState
>({
  kind: "example.surfaceVideoBackground",
  source: "dom/element",
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
  source: "dom/element",
  setup(ctx) {
    const state = createSurfaceGhostCursorState(ctx);
    prepareGhostCursorLayer(ctx, state, {
      kind: "example.surfaceGhostCursor",
      trailLength: 32,
      color: "#b497cf",
      opacity: 0.9,
    });
    return state;
  },
  update(ctx, state, params) {
    const surface = ctx.object.surface;
    if (!surface) {
      return;
    }

    const pointer = readLocalPointer(ctx);
    const shouldUpdate = updateSurfaceGhostCursorState(state, pointer);

    prepareGhostCursorLayer(ctx, state, params);
    ctx.object.visible = true;
    if (shouldUpdate) {
      state.layer?.setUniforms(
        createGhostCursorUniforms({
          color: params.color ?? "#b497cf",
          opacity: clampNumber(params.opacity, 0.1, 1, 0.9),
          pointerActive: pointer.active,
          pointerIntensity: state.intensity,
          pointerX: state.pointerX,
          pointerY: state.pointerY,
          trailPoints: state.trail,
          time: ctx.time,
          trailLength: clampNumber(params.trailLength, 6, 64, 32),
          width: ctx.layout.width,
          height: ctx.layout.height,
        }),
      );
    }
    surface.setVisible?.(true);
    surface.setOpacity?.(1);
  },
  dispose(_ctx, state) {
    state.layer?.dispose();
    state.layer = undefined;
  },
});

export const exampleSurfaceWavesEffect = defineWebGLEffect<
  SurfaceWavesParams,
  SurfaceWavesState
>({
  kind: "example.surfaceWaves",
  source: "dom/element",
  setup() {
    return { layer: undefined };
  },
  update(ctx, state, params) {
    const surface = ctx.object.surface;
    if (!surface) {
      return;
    }

    const pointer = readLocalPointer(ctx);
    const wavesState = state ?? { layer: undefined };
    prepareWavesLayer(ctx, wavesState, params, pointer);
    ctx.object.visible = true;
    wavesState.layer?.setUniforms(createSurfaceWavesUniforms({
      lineColor: params.lineColor ?? "#172124",
      opacity: clampNumber(params.opacity, 0.1, 1, 0.82),
      pointerActive: pointer.active,
      pointerX: pointer.x,
      pointerY: pointer.y,
      time: ctx.time,
      width: ctx.layout.width,
      height: ctx.layout.height,
    }));
    surface.setVisible?.(true);
    surface.setOpacity?.(1);
  },
  dispose(_ctx, state) {
    state.layer?.dispose();
    state.layer = undefined;
  },
});

export const exampleModelDarkSceneEffect =
  defineWebGLEffect<ModelDarkSceneParams>({
    kind: "example.modelDarkScene",
    source: "dom/element",
    update(ctx) {
      const surface = ctx.object.surface;
      if (!surface) {
        return;
      }

      surface.draw(({ context, width, height }) => {
        drawModelDarkSceneSurface(context, width, height);
      });
      surface.setVisible?.(true);
      surface.setOpacity?.(1);
      ctx.object.visible = true;
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
  const surface = ctx.object.surface;
  if (!surface) {
    return;
  }

  const opacity = clampNumber(params.opacity, 0, 1, 0.76);
  const imageSrc = params.imageSrc ?? "/example/bg.png";
  prepareSurfaceImage(ctx, state, imageSrc);

  if (!state.drawn) {
    surface.draw(({ context, width, height }) => {
      context.clearRect(0, 0, width, height);
      drawCoverImage(context, state.image, width, height);
    });
    state.drawn = true;
  }

  surface.setVisible?.(true);
  surface.setOpacity?.(opacity);
  ctx.object.visible = true;
}

function drawModelDarkSceneSurface(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);
}

function prepareSurfaceImage(
  ctx: WebGLEffectUpdateContext,
  state: SurfaceFillState,
  imageSrc: string,
): void {
  const surface = ctx.object.surface;
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
  const surface = ctx.object.surface;
  if (!surface) {
    return;
  }

  const videoSrc = params.videoSrc ?? "/example/bg.mp4";
  prepareSurfaceVideo(ctx, state, videoSrc);
  const opacity = clampNumber(params.opacity, 0, 1, 0.84);

  surface.draw(({ context, width, height }) => {
    context.clearRect(0, 0, width, height);
    drawCoverImage(context, state.video, width, height);
  });
  surface.setVisible?.(true);
  surface.setOpacity?.(opacity);
  ctx.object.visible = true;
}

function readLocalPointer(ctx: WebGLEffectUpdateContext): TargetLocalPointer {
  return readTargetLocalPointer({
    layout: ctx.layout,
    pointer: ctx.targetPointer,
  });
}

function prepareGhostCursorLayer(
  ctx: WebGLEffectUpdateContext,
  state: SurfaceGhostCursorState,
  params: SurfaceGhostCursorParams,
): void {
  if (!ctx.object.surface || state.layer) {
    return;
  }

  state.layer = ctx.object.surface.createMaterialLayer({
    key: "example.surfaceGhostCursor",
    mode: "replace-source",
    sourceTextureUniform: "uSource",
    program: createGhostCursorMaterialProgram({
      color: params.color ?? "#b497cf",
      opacity: clampNumber(params.opacity, 0.1, 1, 0.9),
      pointerActive: false,
      pointerIntensity: 0,
      pointerX: ctx.layout.width * 0.5,
      pointerY: ctx.layout.height * 0.5,
      trailPoints: state.trail,
      time: ctx.time,
      trailLength: clampNumber(params.trailLength, 6, 64, 32),
      width: ctx.layout.width,
      height: ctx.layout.height,
    }),
  });
}

function prepareWavesLayer(
  ctx: WebGLEffectUpdateContext,
  state: SurfaceWavesState,
  params: SurfaceWavesParams,
  pointer: TargetLocalPointer,
): void {
  if (!ctx.object.surface || state.layer) {
    return;
  }

  state.layer = ctx.object.surface.createMaterialLayer({
    key: "example.surfaceWaves",
    mode: "replace-source",
    sourceTextureUniform: "uSource",
    program: createSurfaceWavesMaterialProgram({
      lineColor: params.lineColor ?? "#172124",
      opacity: clampNumber(params.opacity, 0.1, 1, 0.82),
      pointerActive: pointer.active,
      pointerX: pointer.x,
      pointerY: pointer.y,
      time: ctx.time,
      width: ctx.layout.width,
      height: ctx.layout.height,
    }),
  });
}
