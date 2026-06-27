import { defineWebGLEffect } from "@project/dom-webgl-runtime";

import { clampNumber, readTargetViewportProgress } from "./effectMath";

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

export const exampleImagePanEffect = defineWebGLEffect<ImagePanParams>({
  kind: "example.imagePan",
  source: "media/image",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "media" || ctx.source.type !== "image") {
      return;
    }

    const distance = clampNumber(params.distance, 0, 0.5, 0.16);
    const progress = Math.max(
      clampNumber(ctx.scrollProgress, 0, 1, 0),
      readTargetViewportProgress(ctx.layout),
    );
    ctx.source.image?.setTextureTransform({
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
    if (ctx.source.kind !== "media" || ctx.source.type !== "image") {
      return;
    }

    const maxScale = clampNumber(params.maxScale, 1, 2.4, 1.42);
    const phase = 0.5 + Math.sin(ctx.time / 800) * 0.5;
    const scale = 1 + (maxScale - 1) * phase;

    ctx.target?.setVisible(true);
    ctx.target?.setScale(scale, scale, 1);
  },
});

export const exampleImageKenBurnsEffect = defineWebGLEffect<ImageKenBurnsParams>({
  kind: "example.imageKenBurns",
  source: "media/image",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "media" || ctx.source.type !== "image") {
      return;
    }

    const distance = clampNumber(params.distance, 0, 0.36, 0.14);
    const maxScale = clampNumber(params.maxScale, 1, 1.8, 1.18);
    const phase = 0.5 + Math.sin(ctx.time / 1200) * 0.5;
    const scale = 1 + (maxScale - 1) * (0.35 + phase * 0.65);

    ctx.source.image?.setTextureTransform({
      repeatX: scale,
      repeatY: scale,
      offsetX: distance * phase,
      offsetY: distance * (1 - phase),
    });
    ctx.target?.setVisible(true);
    ctx.target?.setScale(1 + phase * 0.04, 1 + phase * 0.04, 1);
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
    if (ctx.source.kind !== "media" || ctx.source.type !== "video") {
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

function configureVideo(
  ctx: Parameters<typeof exampleVideoPlaybackEffect.update>[0],
  params: VideoPlaybackParams,
  state: VideoPlaybackState,
): void {
  if (ctx.source.kind !== "media" || ctx.source.type !== "video" || state.configured) {
    return;
  }

  ctx.source.video?.setMuted(true);
  ctx.source.video?.setPlaybackRate(clampNumber(params.playbackRate, 0.25, 2, 1));
  void ctx.source.video?.play();
  state.configured = true;
}
