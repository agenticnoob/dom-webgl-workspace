import { describe, expect, test, vi } from "vitest";

import { createEffectContext } from "../test/effectContext";
import {
  exampleImagePanEffect,
  exampleImageZoomEffect,
  exampleVideoDriftEffect,
  exampleVideoPlaybackEffect,
} from "./mediaEffects";

describe("media example effects", () => {
  test("image pan applies a texture transform only to image sources", () => {
    const image = {
      setTextureTransform: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "image",
        element: document.createElement("img"),
        src: "/example/image.png",
        image,
      },
      scrollProgress: 0.5,
    });

    exampleImagePanEffect.update(context, undefined, {
      kind: "example.imagePan",
      distance: 0.2,
    });

    expect(exampleImagePanEffect.source).toBe("image");
    expect(image.setTextureTransform).toHaveBeenCalledWith({
      repeatX: 1.12,
      repeatY: 1.12,
      offsetX: 0.1,
      offsetY: 0,
    });
  });

  test("image zoom drives target scale for image sources", () => {
    const target = {
      setScale: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "image",
        element: document.createElement("img"),
        src: "/example/image.png",
        image: {},
      },
      target,
      time: 800,
    });

    exampleImageZoomEffect.update(context, undefined, {
      kind: "example.imageZoom",
      maxScale: 1.36,
    });

    expect(exampleImageZoomEffect.source).toBe("image");
    expect(target.setVisible).toHaveBeenCalledWith(true);
    expect(target.setScale).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 1);
  });

  test("video playback configures media once during setup", () => {
    const video = {
      play: vi.fn(),
      setMuted: vi.fn(),
      setPlaybackRate: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "video",
        element: document.createElement("video"),
        src: "/example/video.mp4",
        video,
      },
    });

    const state = exampleVideoPlaybackEffect.setup?.(context, {
      kind: "example.videoPlayback",
      playbackRate: 0.8,
    });
    if (!state) {
      throw new Error("Expected example.videoPlayback setup state");
    }
    exampleVideoPlaybackEffect.update(context, state, {
      kind: "example.videoPlayback",
      playbackRate: 0.8,
    });

    expect(exampleVideoPlaybackEffect.source).toBe("video");
    expect(video.setMuted).toHaveBeenCalledWith(true);
    expect(video.setPlaybackRate).toHaveBeenCalledWith(0.8);
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  test("video drift applies a texture transform to video sources", () => {
    const video = {
      setTextureTransform: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "video",
        element: document.createElement("video"),
        src: "/example/video.mp4",
        video,
      },
      time: 900,
    });

    exampleVideoDriftEffect.update(context, undefined, {
      kind: "example.videoDrift",
      distance: 0.12,
    });

    expect(exampleVideoDriftEffect.source).toBe("video");
    expect(video.setTextureTransform).toHaveBeenCalledWith({
      repeatX: 1.08,
      repeatY: 1.08,
      offsetX: expect.any(Number),
      offsetY: expect.any(Number),
    });
  });
});
