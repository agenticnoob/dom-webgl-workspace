// Optional verified recipe for 0.1.0-alpha.0. Read capability-status.md before use.
import { defineWebGLEffect } from "@viselora/dom-webgl";

type VideoBackgroundParams = {
  kind: "viselora.videoBackground";
  playbackRate?: number;
};

type VideoBackgroundState = { configured: boolean };

export const videoBackgroundEffect = defineWebGLEffect<
  VideoBackgroundParams,
  VideoBackgroundState
>({
  kind: "viselora.videoBackground",
  source: "media/video",
  schedule: "frame",
  setup() {
    return { configured: false };
  },
  update(ctx, state, params) {
    const video = ctx.object.video;
    const texture = ctx.object.texture;
    if (!video || !texture) {
      return;
    }

    if (!state.configured) {
      video.setMuted(true);
      video.setPlaybackRate(params.playbackRate ?? 1);
      void video.play();
      state.configured = true;
    }

    const drift = (Math.sin(ctx.time / 1800) + 1) * 0.015;
    texture.setTransform({
      repeatX: 1.06,
      repeatY: 1.06,
      offsetX: drift,
      offsetY: 0.03 - drift,
    });
    ctx.object.visible = true;
  },
});

export const videoBackgroundTarget = {
  key: "viselora.video-background",
  source: {
    kind: "media",
    type: "video",
    src: "/media/background.mp4",
    playback: { muted: true, loop: true, playsInline: true },
  },
  lifecycle: {
    hideWhenReady: true,
    hideMode: "self",
    offscreen: { strategy: "park", warmTtlMs: 15_000 },
  },
  effects: [{ kind: "viselora.videoBackground", playbackRate: 0.9 }],
} as const;
