import type {
  WebGLEffectCanvasSurfaceHandle,
  WebGLEffectUpdateContext,
} from "@project/dom-webgl-runtime";

export type SurfaceVideoBackgroundState = {
  video: HTMLVideoElement | undefined;
  videoSrc: string | undefined;
};

export function createSurfaceVideoBackgroundState(): SurfaceVideoBackgroundState {
  return {
    video: undefined,
    videoSrc: undefined,
  };
}

export function prepareSurfaceVideo(
  ctx: WebGLEffectUpdateContext,
  state: SurfaceVideoBackgroundState,
  videoSrc: string,
): void {
  if (ctx.source.kind !== "dom" || ctx.source.type !== "element") {
    return;
  }

  if (state.video && state.videoSrc === videoSrc) {
    return;
  }

  disposeSurfaceVideo(state);
  const video = createLoopingVideo(videoSrc, ctx.source.surface);
  state.video = video;
  state.videoSrc = videoSrc;
}

export function disposeSurfaceVideo(state: SurfaceVideoBackgroundState): void {
  if (!state.video) {
    return;
  }

  state.video.pause();
  state.video.removeAttribute("src");
  state.video.load();
  state.video = undefined;
  state.videoSrc = undefined;
}

function createLoopingVideo(
  videoSrc: string,
  surface: WebGLEffectCanvasSurfaceHandle | undefined,
): HTMLVideoElement {
  const video = document.createElement("video");
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = videoSrc;
  video.addEventListener("loadeddata", () => {
    surface?.invalidate();
  });
  video.addEventListener("timeupdate", () => {
    surface?.invalidate();
  });
  const playResult = video.play();
  playResult.catch((error: unknown) => {
    if (error instanceof DOMException) {
      return;
    }
    throw error;
  });
  return video;
}
